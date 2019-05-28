const express = require('express');
const app = express();
const router = express.Router();
const path = __dirname + '/views/';
const port = 8080;

//filesystem
const fs = require('fs');

//eosjs
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const fetch = require('node-fetch');                                    // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
//load custom config file
const config = require(__dirname + '/config.json');
const signatureProvider = new JsSignatureProvider([config.privateKey_eos]);
const rpc = new JsonRpc('http://' + config.Nodeos.ip + ':' + config.Nodeos.port, { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

//manipulate html
const jsdom = require("jsdom");
const jquery = require("jquery");

//mongodb
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const url_mongo = 'mongodb://' + config.MongoDB.ip + ':' + config.MongoDB.port;

//crypto
var crypto = require('crypto');


router.use(function (req,res,next) {
  console.log('/' + req.method);
  next();
});

//GET ENDPOINTS: MANAGE ROUTING
router.get('/', 				function(req,res){ res.redirect('/home'); });
router.get('/home', 			function(req,res){ getPageHome(res); });
router.get('/report', 			function(req,res){ getPageReport(res); });
router.get('/view-blockchain', 	function(req,res){ getPageViewBlockchain(res); });
router.get('/view-database', 	function(req,res){ getPageViewDatabase(res); });
router.get('/vote', 			function(req,res){ getPageVote(res); });
router.get('/orders', 			function(req,res){ getPageOrders(res); });
router.get('/transfer', 		function(req,res){ getPageTransfer(res); });
router.get('/blame', 			function(req,res){ getPageBlame(res); });
router.get('/mypage', 			function(req,res){ getPageMypage(res); });
router.get('/about', 			function(req,res){ getPageAbout(res); });

app.use(express.static(path));
app.use('/', router);

app.listen(port, function () { console.log('App listening on port 8080!'); });


//POST ENDPOINTS: MANAGE FORMS
app.use(express.urlencoded({extended: true})); 
app.post('/report', (req,res) => {
	console.log(req.body);
	try {
		var isIncident = true; if (req.body.itemType == "datamining") { isIncident = false; }
		var title, description, industry, data, ancestor, price, reward, bsig;
		if(isIncident) {
			title		= req.body.incidentTitle;
			description = req.body.incidentDesc;
			data 		= req.body.incidentData;
			ancestor 	= req.body.incidentAncestor;
			price 		= req.body.incidentPrice;
			reward		= req.body.incidentReward;
			industry	= req.body.incidentIndustry;
			bsig 		= req.body.incidentBSIG;
		} else {
			title		= req.body.dataminingTitle;
			description = req.body.dataminingDesc;
			data 		= req.body.dataminingData;
			ancestor 	= req.body.dataminingAncestor;
			price 		= req.body.dataminingPrice;
			reward		= req.body.dataminingReward;
			industry	= req.body.dataminingIndustry;
			bsig 		= req.body.dataminingBSIG;
		}

		//encrypt data
		var fileKey = crypto.randomBytes(32);
		var encryptedFileKey = encryptRSA(fileKey, config.publicKey_mongo);
		var { iv, encryptedData } = encryptAES(data, fileKey);
		var hashEncryptedData = hashSHA256(encryptedData);

		var encryptedFileKeyBSI;
		if(bsig) { encryptedFileKeyBSI = encryptRSA(fileKey, config.publicKey_mongo_BSI); }

		//decrypt data
		var decryptedFileKey = decryptRSA(encryptedFileKey, config.privateKey_mongo);
		var decryptedData = decryptAES(encryptedData, decryptedFileKey, iv);

		if(decryptedData != data) {
			throw "Fehlerhafter Verschlüsselung";
		}

		var report_db_promise = databaseTransaction_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, iv, isIncident, title, description, industry, bsig);
		report_db_promise.then( function(result) {

			//var report_chain_promise = chainTransaction_report(encryptedData, ancestor, isIncident, price, reward);
			var report_chain_promise = chainTransaction_report(hashEncryptedData, ancestor, isIncident, price, reward);
			report_chain_promise.then( function(result) {
				getPageReport(res, false, true);

			}, function(err) { getPageReport(res, err); });
		}, function(err) { getPageReport(res, err); });
		

	} catch (e) {
		getPageReport(res, "FEHLER: Meldung war nicht erfolgreich. Verschlüsselung oder Blockchain/Datenbank Transaktion schlug fehl.", true);
	}
});
app.post('/mypage', (req,res) => {
	console.log(req.body);
	if (req.body.itemType == "calc_keypair") { 
		const passphrase = getCryptoRandom(10);
		const { generateKeyPairSync } = require('crypto');
		const { publicKey, privateKey } = generateKeyPairSync('rsa', {
			modulusLength: 4096,
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem'
			},
			privateKeyEncoding: {
				type: 'pkcs8',
				format: 'pem',
				cipher: 'aes-256-cbc',
				passphrase: passphrase
			}
		});
		config.privateKey_mongo = privateKey;
		config.publicKey_mongo = publicKey;
		config.passphrase_mongo = passphrase;
		fs.writeFileSync(__dirname + '/config.json', JSON.stringify(config, null, 2));

		chainTransaction_updatepk(publicKey).then(function(result) {
			getPageMypage(res, null, true);
		}, function(err) { 
			getPageMypage(res, err, false); 
		});
	}
});
app.post('/transfer', (req,res) => {
	var promise = chainTransaction_transfer(req.body.to, req.body.amount);
	promise.then( function(result) {
		getPageTransfer(res);
	}, function(err) { 
		getPageTransfer(res, err);
	});
});
app.post('/blame', (req,res) => {
	var promise
	if (req.body.freeze == "freeze") {
		promise = chainTransaction_blame(req.body.blamed, req.body.reason, true);
	} else if (req.body.freeze == "unfreeze") {
		promise = chainTransaction_blame(req.body.blamed, req.body.reason, false);
	} else if (req.body.hasOwnProperty("confirmation-btn")) {
		promise = chainTransaction_voteb(req.body.key, true);
	} else if (req.body.hasOwnProperty("rejection-btn")) {
		promise = chainTransaction_voteb(req.body.key, false);
	}

	promise.then( function(result) {
		getPageBlame(res, null, true);
	}, function(err) { 
		getPageBlame(res, err, false);
	});
});
app.post('/view-blockchain', (req,res) => {

	if(req.body.hasOwnProperty("setvoters-btn")) {
		var selectedVoters = chainTransaction_selectvoter(req.body.key);
		selectedVoters.then( function(result) {

			var hash = req.body.hash;
	        var db_item_entry_raw = databaseQuery_item_byID(hash);
	        db_item_entry_raw.then( function(result) {
				var encryptedFileKeys = result[0].fileKeys;
				var encryptedFileKey_user;
				for (var i = 0; i < encryptedFileKeys.length; i++){
					if (encryptedFileKeys[i].user != config.user) { continue; }
					encryptedFileKey_user = encryptedFileKeys[i].encryptedFileKey;
					break;
				}
				var decryptedFileKey = decryptRSA(encryptedFileKey_user, config.privateKey_mongo);

				var applications = chainQuery_applications();
				applications.then( function(result) {
					var applicants = [];
					for(var i = 0; i < result.rows.length; i++) {
		            	var row = result.rows[i];
		            	if(row.itemKey == req.body.key && row.active == 1) {
		            		var applicant = JSON.stringify(row.applicant).substring(1, JSON.stringify(row.applicant).length-1);
		            		applicants.push(applicant);
		            	}
		            }
		            console.log(applicants.toString());

		            var users = chainQuery_users();
					users.then( function(result) {
						applicants.forEach(function(element) {
							for(var i = 0; i < result.rows.length; i++) {
			            		var row = result.rows[i];
			            		if(row.user == element) {
			            			var encryptedFileKey_applicant = encryptRSA(decryptedFileKey, row.publicKey);
			            			console.log("\n\napplicant: " + element + "\n encryptedFileKey_applicant: " + encryptedFileKey_applicant);
			            			databaseTransaction_addEncryptedFileKey(hash, element, encryptedFileKey_applicant);
			            		}
		            		}
						});				
						getPageViewBlockchain(res, false, true);
		            }, function(err) { getPageViewBlockchain(res, err); });
				}, function(err) { getPageViewBlockchain(res, err); });
			}, function(err) { getPageViewBlockchain(res, err); });
		}, function(err) { getPageViewBlockchain(res, err); });

	} else {
		var promise;
		if(req.body.hasOwnProperty("apply-btn")) {
			promise = chainTransaction_apply(req.body.key);
		} else if(req.body.hasOwnProperty("vote-btn")) { 
			promise = chainTransaction_vote(req.body.key, req.body.overall, req.body.description, req.body.service, req.body.quality);
		} else if(req.body.hasOwnProperty("order-btn")) {
			promise = chainTransaction_buy(req.body.key);
		} else if(req.body.hasOwnProperty("price-btn")) {
			promise = chainTransaction_updateprice(req.body.key, req.body.price);
		}
		promise.then( function(result) {
			getPageViewBlockchain(res, false, true);
		}, function(err) { 
			getPageViewBlockchain(res, err);
		});
	}
});
app.post('/orders', (req,res) => {

	if (req.body.hasOwnProperty("decrypt-btn")) {

		// 1. Download Incident from EOS with itemKey -> Getting Hash
		// 2. Download Incident from DB  with hash 	  -> Getting encrypted FileKey of Seller
		// 3. Decrypt fileKey 						  -> Getting decrypted FileKey
		// 4. Download public Key from EOS with user  -> Getting public key of buyer
		// 5. Encrypt FileKey with public key of buyer-> Getting encrypted FileKey of Buyer
		// 6. Modify Incident in DB with encrypted    -> Store encrypted FileKey of Buyer at the DB
		// 7. Modify EOS state 					      -> Update Metadata

		//1.
		var item = chainQuery_items_byKey(req.body.itemKey);
		item.then( function(result) {
			var hash = JSON.stringify(result.rows[0].hash).substring(1, JSON.stringify(result.rows[0].hash).length-1);
			//2.
			var db_item_entry_raw = databaseQuery_item_byID(hash);
			db_item_entry_raw.then( function(result) {
				var encryptedFileKeys = result[0].fileKeys;
				var encryptedFileKey_user;
				for (var i = 0; i < encryptedFileKeys.length; i++){
					if (encryptedFileKeys[i].user != config.user) { continue; }
					encryptedFileKey_user = encryptedFileKeys[i].encryptedFileKey;
					break;
				}
				//3.
				var decryptedFileKey = decryptRSA(encryptedFileKey_user, config.privateKey_mongo);
				//4.
				var buyer_entry_eos = chainQuery_users_byUser(req.body.buyer);
				buyer_entry_eos.then( function(result) {
					var publicKey_buyer = result.rows[0].publicKey;
					//5. 
					var encryptedFileKey_buyer = encryptRSA(decryptedFileKey, publicKey_buyer);
					//6.
					var db_transaction = databaseTransaction_addEncryptedFileKey(hash, req.body.buyer, encryptedFileKey_buyer);
					db_transaction.then( function(result) {
						//7.
						var set_chain_state = chainTransaction_sent(req.body.orderKey);
						set_chain_state.then( function(result) {
							getPageOrders(res, null, true);

						}, function(err) { getPageOrders(res, err, false); });
					}, function(err) { getPageOrders(res, err, false); });
				}, function(err) { getPageOrders(res, err, false); });
			}, function(err) { getPageOrders(res, err, false); });
		}, function(err) { getPageOrders(res, err, false); });
		
		getPageOrders(res, null, true);
	} else {
		var promise;
		if (req.body.hasOwnProperty("confirmation-btn")) {
			promise = chainTransaction_received(req.body.key, true);
		} else if (req.body.hasOwnProperty("rejection-btn")) {
			promise = chainTransaction_received(req.body.key, false);
		}

		promise.then( function(result) {
			getPageOrders(res, null, true);
		}, function(err) { 
			getPageOrders(res, err, false);
		});
	}
});


//ASSEMBLE PAGES
function getPageHome(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var home 		= fs.readFileSync(path + 'home.html', 'utf8');
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + home + '</body></html>');
}
function getPageReport(res, err, done) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var report 		= report = fs.readFileSync(path + 'report.html', 'utf8');

	if(err) {
		var message = "<div class='label-danger'>Meldung fehlgeschlagen</div>" + err;
		var report_error_dom = new jsdom.JSDOM(report);
		var $ = jquery(report_error_dom.window);
		$('p.error').html(message);
		report = report_error_dom.serialize();
	}
	if(done) {
		var message = "<div class='label-ok'>Meldung erfolgreich</div>";
		var report_error_dom = new jsdom.JSDOM(report);
		var $ = jquery(report_error_dom.window);
		$('p.error').html(message);
		report = report_error_dom.serialize()
	}

	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + report + '</body></html>');
}
function getPageViewBlockchain(res, err, done) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var view 		= fs.readFileSync(path + 'view-blockchain.html', 'utf8');

	if(err) {
		var message = "<div class='label-danger'>Interaktion fehlgeschlagen</div>" + err;
		var view_error_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_error_dom.window);
		$('p.error').html(message);
		view = view_error_dom.serialize();
	}
	if(done) {
		var message = "<div class='label-ok'>Interaktion erfolgreich</div>";
		var view_error_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_error_dom.window);
		$('p.error').html(message);
		view = view_error_dom.serialize()
	}


	var items = chainQuery_items();
	items.then( function(result) {

		//assemble table
		var table = '<table class="table table-hover table-dark">';
        table += '<tr><th>#</th><th>Hash</th><th>Typ</th><th>#-Link</th><th>Reporter</th><th>Rating</th><th>Preis</th><th>Belohnung</th><th>Status</th><th>Votes</th><th>BSI-OK</th><th>Aktion</th></tr>'
        for(var i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            var text = ""; var label = "";
            table += '<tr>';

			var state = "accepted";
			if (JSON.stringify(row.appliable) == 1) {
				state = "application";
			}
			if (JSON.stringify(row.setvoters) == 1) {
				state = "setvoters";
			}
			if (JSON.stringify(row.voteable) == 1) { 
				state = "voting"; 
			}
			if (JSON.stringify(row.rating) == 0 && JSON.stringify(row.appliable) == 0 && JSON.stringify(row.setvoters) == 0 && JSON.stringify(row.voteable) == 0) { 
				state = "failed"; 
			}


            //key
            table += '<td>' + JSON.stringify(row.key) + '</td>';
            //hash
            var hash = JSON.stringify(row.hash).substring(1, JSON.stringify(row.hash).length-1);
            table += '<td>' + hash.slice(0, hash.length/2) + '<br>' + hash.slice(hash.length/2) + '</td>';
            //Typ
            text = "Vorfall"; label = 'class="label-primary"';
            if (JSON.stringify(row.incident) == 0) { text = "<b>Datenanalyse</b>"; label = 'class="label-secondary"'; }
            table += '<td><div ' + label + '>' + text + '</div></td>';            
            //parent Link
            table += '<td>' + JSON.stringify(row.parentLink) + '</td>';
            //reporter
            table += '<td>' + JSON.stringify(row.reporter).substring(1, JSON.stringify(row.reporter).length-1) + '</td>';

            //rating
            label = 'class="label-attention"'; 
            text = 'schwebend';
            if (state == "accepted") {
            	label = 'class="label-ok"'; 
            	var rating 		= JSON.stringify(row.rating).substring(1, JSON.stringify(row.rating).length-1);

            	var quality 	= rating.substring(JSON.stringify(row.rating).length-5, JSON.stringify(row.rating).length); 
            	var service 	= rating.substring(JSON.stringify(row.rating).length-8, JSON.stringify(row.rating).length-5); 
            	var description = rating.substring(JSON.stringify(row.rating).length-11, JSON.stringify(row.rating).length-8);
            	var overall 	= rating.substring(JSON.stringify(row.rating).length-14, JSON.stringify(row.rating).length-11);
            	text = 'Gesamt: ' + overall + '<br>Beschreibung: ' + description + '<br>Service: ' + service + '<br>Qualität: ' + quality; 
            }
            if (state == "failed") { 
            	label = 'class="label-danger"'; 
            	text = "Flop"; 
            }
            table += '<td><div ' + label + '>' + text + '</div></td>';

            //price
            table += '<td><div class="label-primary">' + JSON.stringify(row.price) + '</div></td>';
            //reward
            table += '<td><div class="label-primary">' + JSON.stringify(row.reward) + '</div></td>';

            //Status
            if (state == "accepted" || "failed") {
            	text = "Abgeschlossen"; label = 'class="label-secondary"';
            }
            if (state == "application") {
            	text = "Bewerbung"; label = 'class="label-ok"';
            }
            if (state == "setvoters") {
            	text = "Planung Voting "; label = 'class="label-primary"';
            }
            if (state == "voting") {
            	text = "Voting "; label = 'class="label-attention"';
            }
            table += '<td><div ' + label + '>' + text + '</div></td>';

            //Confirmations/Votes
            table += '<td>' + JSON.stringify(row.confirmations) + "/" + JSON.stringify(row.votes) + '</td>';
            //BSI-OK
            text = "OK"; label = 'class="label-ok"';
            if (JSON.stringify(row.approval) == 0) { text = "<b>Keine Bewertung</b>"; label = 'class="label-attention"'; }
            table += '<td><div ' + label + '>' + text + '</div></td>';

            //ACTION BUTTON
            table += '<td>';
            if (state == "failed") {
            	table += '<div class="label-danger">Mangelhaftes Rating</div>';
            } else {
            	table += '<form action="/view-blockchain" method="post">';
		        table += '<input id="key" name="key" type="hidden" value="' + JSON.stringify(row.key) + '" />';
            	if (JSON.stringify(row.reporter).substring(1, JSON.stringify(row.reporter).length-1) == config.user) {
	            	if(state == "setvoters") {
	            		table += '<input id="hash" name="hash" type="hidden" value="' + hash + '" />';
	            		table += '<input name="setvoters-btn" class="btn btn-success btn-sm btn-block" type="submit" value="Voting planen" style="margin-bottom:5px">';
	            	}
            		table += '<input id="price" name="price" type="number" min=0 max=1000 value=10 /> ';
	            	table += '<input name= "price-btn" class="btn btn-danger btn-sm" type="submit" value="Preis setzen">';
            	} else {
            		if(state == "accepted") {
            			table += '<input name="order-btn" class="btn btn-primary btn-sm btn-block" type="submit" value="Bestellen">';
            		} else if (state == "voting") {
		            	table += '<label>Gesamt</label><input id="overall" name="overall" type="number" min=0 max=99 value=10 style="float:right;" /><br>';
		            	table += '<label>Beschreibung</label><input id="description" name="description" type="number" min=0 max=99 value=10 style="float:right;" /><br>';
		            	table += '<label>Service</label><input id="service" name="service" type="number" min=0 max=99 value=10 style="float:right;" /><br>';
		            	table += '<label>Qualität</label><input id="quality" name="quality" type="number" min=0 max=99 value=10 style="float:right;" />';
		            	table += '<input name="vote-btn" class="btn btn-primary btn-sm btn-block" type="submit" value="Voten">';
		            } else if (state == "application") { 
		            	table += '<input name="apply-btn" class="btn btn-success btn-sm btn-block" type="submit" value="Bewerben">';
		            }            	
		        }
            	table += '</form>';
            }
            table += '</td>';
          
            table += '</tr>';
        }
        table += '</table>';

        //place table;
		var view_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_dom.window);
		$('p.items').html(table);
		view = view_dom.serialize();

		//send page to user
		res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + view + '</body></html>');
	}, function(err) { console.log(err); });
}
function getPageViewDatabase(res, err, done) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var view 		= fs.readFileSync(path + 'view-database.html', 'utf8');
	var items 		= databaseQuery_item();

	if(err) {
		var message = "<div class='label-danger'>Bestellung fehlgeschlagen</div>"+err;
		var view_error_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_error_dom.window);
		$('p.error').html(message);
		view = view_error_dom.serialize();
	}
	if(done) {
		var message = "<div class='label-ok'>Bestellung erfolgreich</div>";
		var view_error_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_error_dom.window);
		$('p.error').html(message);
		view = view_error_dom.serialize()
	}

	items.then( function(result) {
		//assemble table
		var table = '<table class="table table-hover table-dark">';
		table += '<tr><th>Titel</th><th>Beschreibung</th><th>Branche</th><th>Hash</th><th>Typ</th><th>Daten</th></tr>';
		for(var i = 0; i < result.length; i++) {
			var row = result[i];
			//console.log(row);
			var text = ""; var label = "";

			var encryptedFileKey, encryptedData, iv, decryptedFileKey, decryptedData;
			var owned = false;
			for(var k = 0; k < row.fileKeys.length; k++) {
				if (config.user == row.fileKeys[k].user) {
					var owned = true;
					encryptedFileKey = JSON.stringify(row.fileKeys[k].encryptedFileKey);

					encryptedData = JSON.stringify(row.encryptedData).substring(1, JSON.stringify(row.encryptedData).length-1); //LITERALS!
					iv = JSON.stringify(row.init_vector).substring(1, JSON.stringify(row.init_vector).length-1); //LITERALS!

					decryptedFileKey = decryptRSA(encryptedFileKey, config.privateKey_mongo);
					decryptedData = decryptAES(encryptedData, decryptedFileKey, iv);

					break;
				}
			}

           	table += '<tr>';
           	//TITEL
			table += '<td>' + JSON.stringify(row.title).substring(1, JSON.stringify(row.title).length-1); + '</td>';
			//BESCHREIBUNG
			table += '<td>' + JSON.stringify(row.description).substring(1, JSON.stringify(row.description).length-1); + '</td>';
			//BRANCHE
			table += '<td>' + JSON.stringify(row.industry).substring(1, JSON.stringify(row.industry).length-1); + '</td>';
           	//HASH
            var hash = JSON.stringify(row._id).substring(1, JSON.stringify(row._id).length-1);
           	table += '<td>' + hash.slice(0, hash.length/2) + '<br>' + hash.slice(hash.length/2) + '</td>';

           	//TYP
            text = "Vorfall"; label = 'class="label-primary"';
            if (!row.itemType) { text = "<b>Datenanalyse</b>"; label = 'class="label-secondary"'; }
           	table += '<td><div ' + label + '>' + text + '</td>';

           	//DATEN
            if (owned) { 
            	table += '<td>' + decryptedData + '</td>';
            } else {
            	table += '<td><div class="label-danger">Nicht in Besitz</td>';            	
            }
			table += '</tr>';
		}
		table += '</table>';

		//place table;
		var view_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_dom.window);
		$('p.items').html(table);
		view = view_dom.serialize();

		//send page to user
		res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + view + '</body></html>');
	}, function(err) { console.log(err); });
}
function getPageVote(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var vote 		= fs.readFileSync(path + 'vote.html', 'utf8');
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + vote + '</body></html>');
}
function getPageOrders(res, err, done) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var orders 		= fs.readFileSync(path + 'orders.html', 'utf8');

	if(err) {
		var message = "<div class='label-danger'>Interaktion fehlgeschlagen</div>"+err;
		var orders_error_dom = new jsdom.JSDOM(orders);
		var $ = jquery(orders_error_dom.window);
		$('p.error').html(message);
		orders = orders_error_dom.serialize();
	}
	if(done) {
		var message = "<div class='label-ok'>Interaktion erfolgreich</div>";
		var orders_error_dom = new jsdom.JSDOM(orders);
		var $ = jquery(orders_error_dom.window);
		$('p.error').html(message);
		orders = orders_error_dom.serialize()
	}

	var order_items = chainQuery_orders();
	order_items.then( function(result) {

		//assemble table_torelease
		var table_torelease = '<table>';
        table_torelease += '<tr><th>#</th><th>ItemLink</th><th>Käufer</th><th>Info/Aktion</th></tr>'
        for(var i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            var text = ""; var label = "";

			//only take the orders assigned to the user
        	if(JSON.stringify(row.seller).substring(1, JSON.stringify(row.seller).length-1) != config.user) {
        		continue;
        	}

            table_torelease += '<tr>';

            //key
            table_torelease += '<td>' + JSON.stringify(row.key) + '</td>';
            //itemkey
            table_torelease += '<td>' + JSON.stringify(row.itemKey) + '</td>';
			//buyer
            table_torelease += '<td>' + JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length-1) + '</td>';

            //ACTION BUTTON
            if (JSON.stringify(row.sent) == 0) {
				table_torelease += '<td>';
	            table_torelease += '<form action="/orders" method="post">';
	            table_torelease += '<input id="buyer" name="buyer" type="hidden" value="' + JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length-1) + '" />';
	            table_torelease += '<input id="itemKey" name="itemKey" type="hidden" value="' + JSON.stringify(row.itemKey) + '" />';
	            table_torelease += '<input id="orderKey" name="orderKey" type="hidden" value="' + JSON.stringify(row.key) + '" />';
	            table_torelease += '<input name="decrypt-btn" class="btn btn-primary btn-sm btn-block" type="submit" value="Auftrag erfüllen" />';
				table_torelease += '</form>';
				table_torelease += '</td>';
            } else {
            	if (JSON.stringify(row.received) == 0) {
            		table_torelease += '<td><div class="label-attention">Bestätigung ausstehend</div></td>';
            	} else {
            		table_torelease += '<td><div class="label-ok">Erledigt</div></td>';
            	}
            }

            table_torelease += '</tr>';
        }
        table_torelease += '</table>';

		//assemble table_myOrders
		var table_myOrders = '<table>';
        table_myOrders += '<tr><th>#</th><th>ItemLink</th><th>Käufer</th><th>Erhalten?</th></tr>'
        for(var i = 0; i < result.rows.length; i++) {
			var row = result.rows[i];

			//only take the orders assigned to the user
        	if(JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length-1) != config.user) {
        		continue;
        	}

            var text = ""; var label = "";
            table_myOrders += '<tr>';

            //key
            table_myOrders += '<td>' + JSON.stringify(row.key) + '</td>';
            //itemkey
            table_myOrders += '<td>' + JSON.stringify(row.itemKey) + '</td>';
			//buyer
            table_myOrders += '<td>' + JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length-1) + '</td>';

            //ACTION BUTTON
            if (JSON.stringify(row.received) == 0) {
				table_myOrders += '<td>';
	            table_myOrders += '<form action="/orders" method="post">';
	            table_myOrders += '<input id="key" name="key" type="hidden" value="' + JSON.stringify(row.key) + '" />';
	            table_myOrders += '<input name="confirmation-btn" class="btn btn-success btn" type="submit" value="Ja"> ';
	            table_myOrders += '<input name="rejection-btn" class="btn btn-danger btn" type="submit" value="Nein">';
				table_myOrders += '</form>';
				table_myOrders += '</td>';
            } else {
            	table_myOrders += '<td><div class="label-ok">Ja</div></td>';
            }


            table_myOrders += '</tr>';
        }
        table_myOrders += '</table>';

        //place tables
		var orders_dom = new jsdom.JSDOM(orders);
		var $ = jquery(orders_dom.window);
		$('p.allOrders').html(table_torelease);
		$('p.myOrders').html(table_myOrders);
		orders = orders_dom.serialize();

		//send page to user
		res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + orders + '</body></html>');
	}, function(err) { console.log(err); });
}
function getPageTransfer(res, err) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var transfer 	= fs.readFileSync(path + 'transfer.html', 'utf8');

	if(err) {
		var message = "<div class='label-danger'>Überweisung fehlgeschlagen</div>"+err;
		var transfer_error_dom = new jsdom.JSDOM(transfer);
		var $ = jquery(transfer_error_dom.window);
		$('p.error').html(message);
		transfer = transfer_error_dom.serialize();
	}

	var users = chainQuery_users();
	users.then( function(result) {

		//assemble table
		var table = '<table>';
        table += '<tr><th>User</th><th>Kontostand</th><th>Status</th><th>Verifikator</th><th>Beschwerden</th><th>Eingefroren</th></tr>'
        for(var i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            var text = ""; var label = "";
            table += '<tr>';

            //user
            table += '<td>' + JSON.stringify(row.user).substring(1, JSON.stringify(row.user).length-1) + '</td>';
            //Kontostand
            table += '<td>' + JSON.stringify(row.balance) + '</td>';
            //Status
            table += '<td>R: ' + JSON.stringify(row.statusR) + '<br>V: ' + JSON.stringify(row.statusV) + '</td>';
            //Verifikator
            text = "Ja"; label = 'class="label-ok"';
            if (JSON.stringify(row.verificator) == 0) { text = "Nein"; label = 'class="label-danger"'; }
            table += '<td><div ' + label + '>' + text + '</div></td>';
            //Beschwerden
            table += '<td>' + JSON.stringify(row.blames) + '</td>';
            //Eingefroren
            text = "Nein"; label = 'class="label-ok"';
            if (JSON.stringify(row.frozen) == 1) { text = "Ja"; label = 'class="label-danger"'; }
            table += '<td><div ' + label + '>' + text + '</div></td>';
        }

		//place table;
		var transfer_dom = new jsdom.JSDOM(transfer);
		var $ = jquery(transfer_dom.window);
		$('p.users').html(table);
		transfer = transfer_dom.serialize();

		res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + transfer + '</body></html>');
	}, function(err) { console.log(err); });
}
function getPageBlame(res, err, done) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var blame 		= fs.readFileSync(path + 'blame.html', 'utf8');

	if(err) {
		var message = "<div class='label-danger'>Interaktion fehlgeschlagen</div>"+err;
		var blame_error_dom = new jsdom.JSDOM(blame);
		var $ = jquery(blame_error_dom.window);
		$('p.error').html(message);
		blame = blame_error_dom.serialize();
	}
	if(done) {
		var message = "<div class='label-ok'>Interaktion erfolgreich</div>";
		var blame_error_dom = new jsdom.JSDOM(blame);
		var $ = jquery(blame_error_dom.window);
		$('p.error').html(message);
		blame = blame_error_dom.serialize()
	}

	var blamings = chainQuery_blamings();
	blamings.then( function(result) {
		//assemble table
		var table = '<table>';
        table += '<tr><th>#</th><th>Beschuldiger</th><th>Beschuldigter</th><th>Typ</th><th>Voteable</th><th>Begründung</th><th>Votes</th><th>Aktion</th></tr>';
        for(var i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            var text = ""; var label = "";
            table += '<tr>';

            //key
            table += '<td>' + JSON.stringify(row.key) + '</td>';
            //blamer
            table += '<td>' + JSON.stringify(row.blamer).substring(1, JSON.stringify(row.blamer).length-1) + '</td>';
            //blamed
            table += '<td>' + JSON.stringify(row.blamed).substring(1, JSON.stringify(row.blamed).length-1) + '</td>';
            //typ
            text = "Sperrung"; label = 'class="label-danger"';
            if (JSON.stringify(row.freeze) == 0) { text = "Entsperrung"; label = 'class="label-ok"'; }
            table += '<td><div ' + label + '>' + text + '</div></td>'; 
            //voteable
            text = "Offen"; label = 'class="label-primary"';
            if (JSON.stringify(row.voteable) == 0) { text = "<b>Abgeschlossen</b>"; label = 'class="label-secondary"'; }
            table += '<td><div ' + label + '>' + text + '</div></td>';           
            //reason
            table += '<td>' + JSON.stringify(row.reason).substring(1, JSON.stringify(row.reason).length-1) + '</td>';
            //confirmations/votes
            table += '<td>' + JSON.stringify(row.confirmations) + "/" + JSON.stringify(row.votes) + '</td>';

            //ACTION BUTTON
            if (JSON.stringify(row.voteable) == 1) {
				table += '<td>';
	            table += '<form action="/blame" method="post">';
	            table += '<input id="key" name="key" type="hidden" value="' + JSON.stringify(row.key) + '" />';
	            table += '<input name="confirmation-btn" class="btn btn-success btn" type="submit" value="Richtig"> ';
	            table += '<input name="rejection-btn" class="btn btn-danger btn" type="submit" value="Falsch">';
				table += '</form>';
				table += '</td>';
            }

            table += '</tr>';
        }
        table += '</table>';

        //place table;
		var blame_dom = new jsdom.JSDOM(blame);
		var $ = jquery(blame_dom.window);
		$('p.blamings').html(table);
		blame = blame_dom.serialize();

		//send page to user
		res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + blame + '</body></html>');
	}, function(err) { console.log(err); });
}
function getPageMypage(res, err, done) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var mypage 		= fs.readFileSync(path + 'mypage.html', 'utf8');

	if(err) {
		var message = "<div class='label-danger'>Schlüsselgenerierung fehlgeschlagen</div>"+err;
		var mypage_error_dom = new jsdom.JSDOM(mypage);
		var $ = jquery(mypage_error_dom.window);
		$('p.error').html(message);
		mypage = mypage_error_dom.serialize();
	}
	if(done) {
		var message = "<div class='label-ok'>Schlüsselgenerierung erfolgreich</div>";
		var mypage_error_dom = new jsdom.JSDOM(mypage);
		var $ = jquery(mypage_error_dom.window);
		$('p.error').html(message);
		mypage = mypage_error_dom.serialize()
	}

	var account		= `<table>
			<tr><td>EOSIO User</td><td>` + config.user + `</tr>
			<tr><td>EOSIO Public Key</td><td>` + config.publicKey_eos.substr(0,5) + `...</tr>
			<tr><td>EOSIO Private Key</td><td>` + config.privateKey_eos.substr(0,5) + `...</tr>
			<tr><td>MongoDB Public Key</td><td>` + config.publicKey_mongo.substr(27, 5) + `...</tr>
			<tr><td>MongoDB Private Key</td><td>` + config.privateKey_mongo.substr(38,5) + `...</tr>
			<tr><td>MongoDB Passphrase</td><td>` + config.passphrase_mongo.substr(0,3) + `...</tr></table>`;
	var endpoints 	= `<table>
			<tr><th>Container</th><th>IP und Port</th><th>Version</th></tr>
			<tr><td>Nodeos</td><td>` + config.Nodeos.ip + ':' + config.Nodeos.port + `</td><td>` + config.Nodeos.version + `</td></tr>
			<tr><td>Keosd</td><td>` + config.Kesod.ip + ':' + config.Kesod.port + `</td><td>` + config.Kesod.version + `</td></tr>
			<tr><td>MongoDB</td><td>` + config.MongoDB.ip + ':' + config.MongoDB.port + `</td><td>` + config.MongoDB.version + `</td></tr></table>`;
	
	var mypage_dom = new jsdom.JSDOM(mypage);
	var $ = jquery(mypage_dom.window);
	$('p.account').html(account);
	$('p.endpoints').html(endpoints);
	mypage = mypage_dom.serialize();

	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + mypage + '</body></html>');
}
function getPageAbout(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var about 		= fs.readFileSync(path + 'about.html', 'utf8');
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + about + '</body></html>');
}



//DATABASE QUERY
function databaseQuery_item() {
	return new Promise(function(resolve, reject) {
		MongoClient.connect(url_mongo, { useNewUrlParser: true }, function(err, client) {
			assert.equal(null, err);
			console.log("Connected successfully to MongoDB Container");
			const db = client.db('reporting');
			const collection = db.collection('item');
			collection.find({}).toArray( function(err, docs) { 
				assert.equal(err, null);
				resolve(docs);
			});
			client.close();
		});
	});
}
function databaseQuery_item_byID(key) {
	return new Promise(function(resolve, reject) {
		MongoClient.connect(url_mongo, { useNewUrlParser: true }, function(err, client) {
			assert.equal(null, err);
			console.log("Connected successfully to MongoDB Container");
			const db = client.db('reporting');
			const collection = db.collection('item');
			collection.find({ _id: key }).toArray( function(err, docs) { 
				assert.equal(err, null);
				resolve(docs);
			});
			client.close();
		});
	});
}
function databaseQuery_publicKey_byUser(user) {
	return new Promise(function(resolve, reject) {
		MongoClient.connect(url_mongo, { useNewUrlParser: true }, function(err, client) {
			assert.equal(null, err);
			console.log("Connected successfully to MongoDB Container");
			const db = client.db('reporting');
			const collection = db.collection('publicKey');
			collection.find({ user: user }).toArray( function(err, docs) { 
				assert.equal(err, null);
				resolve(docs);
			});
			client.close();
		});
	});
}


//DATABASE TRANSACTIONS
function databaseTransaction_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, init_vector, isIncident, title, description, industry, bsig) {
	return new Promise(function(resolve, reject) {
		MongoClient.connect(url_mongo, { useNewUrlParser: true }, function(err, client) {
			assert.equal(null, err);
			console.log("Connected successfully to MongoDB Container");
			const db = client.db('reporting');
			const collection = db.collection('item');
			if(bsig) {
				collection.insertOne({
					_id:hashEncryptedData, encryptedData:encryptedData,
					fileKeys: [ { encryptedFileKey:encryptedFileKey, user:config.user }, { encryptedFileKey:encryptedFileKeyBSI, user:"bsi" } ], init_vector:init_vector,
					itemType:isIncident, title:title,  description:description, industry:industry
				},
					function(err, result) {
						assert.equal(err, null);
						assert.equal(1, result.result.n);
						assert.equal(1, result.ops.length);
						console.log("Inserted 1 document into the item collection");
						resolve(result);
					}
				);
			} else {
				collection.insertOne({
					_id:hashEncryptedData, encryptedData:encryptedData,
					fileKeys: [ { encryptedFileKey:encryptedFileKey, user:config.user } ], init_vector:init_vector,
					itemType:isIncident, title:title, description:description, industry:industry
				},
					function(err, result) {
						assert.equal(err, null);
						assert.equal(1, result.result.n);
						assert.equal(1, result.ops.length);
						console.log("Inserted 1 document into the item collection");
						resolve(result);
					}
				);
			}

		  client.close();
		});
	});
}
function databaseTransaction_addEncryptedFileKey(hash, user, encryptedFileKey) {
	return new Promise(function(resolve, reject) {
		MongoClient.connect(url_mongo, { useNewUrlParser: true }, function(err, client) {
			assert.equal(null, err);
			console.log("Connected successfully to MongoDB Container");
			const db = client.db('reporting');
			const collection = db.collection('item');
			collection.updateOne({ _id: hash }, { $push: {fileKeys: {encryptedFileKey: encryptedFileKey, user: user} } },
				function(err, result) {
					assert.equal(err, null);
					assert.equal(1, result.result.n);
					console.log("Inserted 1 encryptedFileKey into the items collection");
					resolve(result);
				}
			);
		  client.close();
		});
	});
}





//CHAIN QUERY
async function chainQuery_applications() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "application",
		"limit": 100
	});
}
async function chainQuery_blamings() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "blaming",
		"reverse": true
	});
}
async function chainQuery_items() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "item",
		"reverse": true
	});
}
async function chainQuery_items_byKey(key) {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "item",
		"lower_bound": key,
		"upper_bound": key,
		"limit": 1,
		"reverse": true
	});
}
/*async function chainQuery_items_byHash(hash) {
	secondary index does not work: https://github.com/EOSIO/eos/pull/6591
}*/
async function chainQuery_orders() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "order"
	});
}
async function chainQuery_users() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "users"
	});
}
async function chainQuery_users_byUser(user) {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "users",
		"lower_bound": user,
		"limit": 1
	});
}
async function chainQuery_votings() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "voting"
	});
}
async function chainQuery_votingbs() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "votingb"
	});
}



//CHAIN TRANACTIONS
function chainTransaction_apply(itemKey) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'apply',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        itemKey: itemKey,
	        applicant: config.user,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_approve(itemKey) {
  	(async () => {
	  const result = await api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'approve',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        itemKey: itemKey,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
	})();
}
function chainTransaction_blame(blamed, reason, freeze) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'blame',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        blamer: config.user,
	        blamed: blamed,
	        reason: reason,
	        freeze: freeze,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_buy(itemKey) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'buy',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        itemKey: itemKey,
	        buyer: config.user,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
}
function chainTransaction_enrol() {
  	(async () => {
	  const result = await api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'enrol',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        user: config.user,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
	})();
}
function chainTransaction_init() {
  	(async () => {
	  const result = await api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'init',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
	})();
}
function chainTransaction_received(orderKey, done) {
  	return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'received',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        buyer: config.user,
	        orderKey: orderKey,
	        done: done,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
}
function chainTransaction_report(hash, ancestor, incident, price, reward) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'report',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        reporter: config.user,
	        hash: hash,
	        parentLink: ancestor,
	        isIncident: incident,
	        price: price,
	        reward: reward,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_selectvoter(itemKey) {
	var nonce = parseInt("0x"+getCryptoRandom(5));
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'selectvoter',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        reporter: config.user,
	        itemKey: itemKey,
	        nonce: nonce,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_sent(orderKey) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'sent',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        seller: config.user,
	        orderKey: orderKey,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_transfer(to, amount) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'transfer',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        from: config.user,
	        to: to,
	        amount: amount,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
}
function chainTransaction_updatepk(publicKey) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'updatepk',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        user: config.user,
	        publicKey: publicKey,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_updateprice(itemKey, price) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'updateprice',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        reporter: config.user,
	        itemKey: itemKey,
	        price: price,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_vote(itemKey, overall, description, service, quality) {
	  return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'vote',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        itemKey: itemKey,
	        voter: config.user,
	        overall: overall,
	        description: description,
	        service: service,
	        quality: quality,
		  },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}
function chainTransaction_voteb(blameKey, value) {
	return api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'voteb',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        blameKey: blameKey,
	        voter: config.user,
	        value: value,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
}





//CRYPTO
function getCryptoRandom(size){
	const buf = Buffer.alloc(size);
	return crypto.randomFillSync(buf).toString('hex');
}
function hashSHA256(text) {
	return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}
function encryptAES(text, key) {
	const iv = crypto.randomBytes(16);
	//ISO/IEC 10116:2017
	let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
}
function decryptAES(text, key, init_vector) {
	let iv 				= Buffer.from(init_vector, 'hex');
	let encryptedText   = Buffer.from(text, 'hex');
	let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
	let decrypted = decipher.update(encryptedText);
	decrypted = Buffer.concat([decrypted, decipher.final()]);
	return decrypted.toString();
}
function encryptRSA(toEncrypt, publicKey) {
  const buffer = Buffer.from(toEncrypt, 'utf8')
  const encrypted = crypto.publicEncrypt(publicKey, buffer)
  return encrypted.toString('base64')
}
function decryptRSA(toDecrypt, privateKey) {
  const buffer = Buffer.from(toDecrypt, 'base64')
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      passphrase: config.passphrase_mongo,
    },
    buffer,
  )
  return decrypted
}