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
const rpc = new JsonRpc('http://' + config.EOSIO.ip + ':' + config.EOSIO.ports[0], { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

//manipulate html
const jsdom = require("jsdom");
const jquery = require("jquery");

//mongodb
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const url_mongo = 'mongodb://' + config.MongoDB.ip + ':' + config.MongoDB.ports[0];

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
router.get('/buy', 				function(req,res){ getPageBuy(res); });
router.get('/view-blockchain', 	function(req,res){ getPageViewBlockchain(res); });
router.get('/view-database', 	function(req,res){ getPageViewDatabase(res); });
router.get('/vote', 			function(req,res){ getPageVote(res); });
router.get('/blame', 			function(req,res){ getPageBlame(res); });
router.get('/mypage', 			function(req,res){ getPageMypage(res); });
router.get('/about', 			function(req,res){ getPageAbout(res); });

app.use(express.static(path));
app.use('/', router);

app.listen(port, function () { console.log('App listening on port 8080!'); });


//POST ENDPOINTS: MANAGE FORMS
app.use(express.urlencoded({extended: true})); 
//REPORT INCIDENT
app.post('/report', (req,res) => {
	console.log(req.body);
	try {
		var isIncident = true; if (req.body.itemType == "datamining") { isIncident = false; }
		var data, ancestor;
		if(isIncident) {
			data 		= req.body.incidentData;
			ancestor 	= req.body.incidentAncestor;
		} else {
			data 		= req.body.dataminingData;
			ancestor 	= req.body.dataminingAncestor;
		}

		//encrypt data
		var fileKey = crypto.randomBytes(32);
		//var fileKey_base64 = Buffer.from(fileKey, 'utf8').toString('base64');publicKey_mongo_BSI
		var encryptedFileKey = encryptRSA(fileKey, config.publicKey_mongo);
		var encryptedFileKeyBSI = encryptRSA(fileKey, config.publicKey_mongo_BSI);
		var { iv, encryptedData } = encryptAES(data, fileKey);
		var hashEncryptedData = hashSHA256(encryptedData);

		/*console.log("fileKey: " + fileKey);
		console.log("fileKey_base64: " + fileKey_base64);
		console.log("encryptedFileKey: " + encryptedFileKey);
		console.log("iv: " + iv);
		console.log("encryptedData: " + encryptedData);
		console.log("hashEncryptedData: " + hashEncryptedData);

		console.log("-------------");*/

		//decrypt data
		var decryptedFileKey = decryptRSA(encryptedFileKey, config.privateKey_mongo);
		//var decryptedFileKey_base64 = Buffer.from(decryptedFileKey, 'base64').toString('base64');
		var decryptedData = decryptAES(encryptedData, decryptedFileKey, iv);

		/*console.log("decryptedFileKey: " + decryptedFileKey);
		console.log("decryptedFileKey_base64: " + decryptedFileKey_base64);
		console.log("decryptedData: " + decryptedData);*/

		if(decryptedData != data) {
			throw "Fehlerhafter Verschlüsselung";
		}

		databaseTransaction_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, iv, isIncident);
		chainTransaction_report(hashEncryptedData, ancestor, isIncident);

		getPageReport(res, "Meldung erfolgreich.", false);
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
	}
	getPageMypage(res);
});





//ASSEMBLE PAGES
function getPageHome(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var home 		= fs.readFileSync(path + 'home.html', 'utf8');
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + home + '</body></html>');
}
function getPageReport(res, message, error) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var report 		= report = fs.readFileSync(path + 'report.html', 'utf8');
	if ( message ) { 
		var errorColor = ""; if (error) { errorColor = 'style="background-color:red;"'; }
		report = report + '<div class="jumbotron text-center" ' + errorColor + ' ><h1>' + message + '</h1></div>'; 
	}
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + report + '</body></html>');
}
function getPageBuy(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var buy 		= fs.readFileSync(path + 'buy.html', 'utf8');
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + buy + '</body></html>');
}
function getPageViewBlockchain(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var view 		= fs.readFileSync(path + 'view-blockchain.html', 'utf8');

	var items = chainQuery_items();
	items.then( function(result) {

		//assemble table
		var table = '<table>';
        table += '<tr><th>#</th><th>Hash</th><th>Vorgänger</th><th>Reporter</th><th>Rating</th><th>Voteable</th><th>Votes</th><th>BSI-OK</th><th>Typ</th></tr>'
        for(var i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            var text = ""; var label = "";
            table = table + '<tr>';

            table = table + '<td>' + JSON.stringify(row.key) + '</td>';
            table = table + '<td>' + JSON.stringify(row.hash) + '</td>';
            table = table + '<td>' + JSON.stringify(row.parentLink) + '</td>';
            table = table + '<td>' + JSON.stringify(row.reporter) + '</td>';

            //rating
            label = 'class="label-ok"';
            if (JSON.stringify(row.rating) == 0 || JSON.stringify(row.voteable) == 1) { 
                label = 'class="label-attention"'; 
                if (JSON.stringify(row.voteable) == 0) { label = 'class="label-danger"'; }
            }
            table = table + '<td><div ' + label + '>' + JSON.stringify(row.rating) + '</td>';

            //Voteable
            text = "Offen"; label = 'class="label-primary"';
            if (JSON.stringify(row.voteable) == 0) { text = "<b>Abgeschlossen</b>"; label = 'class="label-secondary"'; }
            table = table + '<td><div ' + label + '>' + text + '</div></td>';
            
            //Confirmations/Votes
            table = table + '<td>' + JSON.stringify(row.confirmations) + "/" + JSON.stringify(row.votes) + '</td>';

            //BSI-OK
            text = "OK"; label = 'class="label-ok"';
            if (JSON.stringify(row.approval) == 0) { text = "<b>Keine Bewertung</b>"; label = 'class="label-attention"'; }
            table = table + '<td><div ' + label + '>' + text + '</div></td>';

            //Typ
            text = "Vorfall"; label = 'class="label-primary"';
            if (JSON.stringify(row.incident) == 0) { text = "<b>Datenanalyse</b>"; label = 'class="label-secondary"'; }
            table = table + '<td><div ' + label + '>' + text + '</div></td>';
            
            table = table + '</tr>';
        }
        table = table + '</table>';

        //place table;
		var view_dom = new jsdom.JSDOM(view);
		var $ = jquery(view_dom.window);
		$('p.items').html(table);
		view = view_dom.serialize();

		//send page to user
		res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + view + '</body></html>');
	}, function(err) { console.log(err); });
}
function getPageViewDatabase(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var view 		= fs.readFileSync(path + 'view-database.html', 'utf8');
	var items 		= databaseQuery_item();

	items.then( function(result) {
		//assemble table
		var table = '<table>';
		table += '<tr><th>Hash</th><th>Typ</th><th>Daten</th></tr>';
		for(var i = 0; i < result.length; i++) {
			var row = result[i];
			var text = ""; var label = "";

			var encryptedFileKey;
			var owned = false;
			for(var k = 0; k < row.fileKeys.length; k++) {
				if (config.user == row.fileKeys[k].user) {
					var owned = true;
					encryptedFileKey = JSON.stringify(row.fileKeys[k].encryptedFileKey);
					break;
				}
			}

			var encryptedData = JSON.stringify(row.encryptedData).substring(1, JSON.stringify(row.encryptedData).length-1); //LITERALS!
			var iv = JSON.stringify(row.init_vector).substring(1, JSON.stringify(row.init_vector).length-1); //LITERALS!

			var decryptedFileKey = decryptRSA(encryptedFileKey, config.privateKey_mongo);
			var decryptedData = decryptAES(encryptedData, decryptedFileKey, iv);

           	table += '<tr>';
           	//HASH
           	table += '<td>' + JSON.stringify(row._id) + '</td>';

           	//TYP
            text = "Vorfall"; label = 'class="label-primary"';
            if (!row.itemType) { text = "<b>Datenanalyse</b>"; label = 'class="label-secondary"'; }
           	table += '<td><div ' + label + '>' + text + '</td>';

           	//IN BESITZ
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
function getPageBlame(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var blame 		= fs.readFileSync(path + 'blame.html', 'utf8');
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + blame + '</body></html>');
}
function getPageMypage(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var mypage 		= fs.readFileSync(path + 'mypage.html', 'utf8');
	var account		= `<table>
			<tr><td>EOSIO User</td><td>` + config.user + `</tr>
			<tr><td>EOSIO Public Key</td><td>` + config.publicKey_eos.substr(0,5) + `...</tr>
			<tr><td>EOSIO Private Key</td><td>` + config.privateKey_eos.substr(0,5) + `...</tr>
			<tr><td>MongoDB Public Key</td><td>` + config.publicKey_mongo.substr(27, 5) + `...</tr>
			<tr><td>MongoDB Private Key</td><td>` + config.privateKey_mongo.substr(38,5) + `...</tr>
			<tr><td>MongoDB Passphrase</td><td>` + config.passphrase_mongo.substr(0,3) + `...</tr></table>`;
	var endpoints 	= `<table>
			<tr><th>Container</th><th>IP und Port</th><th>Version</th></tr>
			<tr><td>EOSIO</td><td>` + config.EOSIO.ip + ':' + config.EOSIO.ports[0] + ',<br>' + config.EOSIO.ip + ':' + config.EOSIO.ports[1] + `</td><td>` + config.EOSIO.version + `</td></tr>
			<tr><td>MongoDB</td><td>` + config.MongoDB.ip + ':' + config.MongoDB.ports[0] + `</td><td>` + config.MongoDB.version + `</td></tr></table>`;
	
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
		MongoClient.connect(url_mongo, function(err, client) {
			assert.equal(null, err);
			console.log("Connected successfully to MongoDB Container");
			const db = client.db('reporting');
			const collection = db.collection('item');
			collection.find({}).toArray( function(err, docs) { 
				assert.equal(err, null);
				console.log("Found the following records");
				console.log(docs);
				resolve(docs);
			});
			client.close();
		});
	});
}


//DATABASE TRANSACTIONS
function databaseTransaction_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, init_vector, isIncident) {
	MongoClient.connect(url_mongo, function(err, client) {
		assert.equal(null, err);
		console.log("Connected successfully to MongoDB Container");
		const db = client.db('reporting');
		const collection = db.collection('item');
		collection.insertOne({
			_id:hashEncryptedData,
			encryptedData:encryptedData,
			fileKeys: [
				{
					encryptedFileKey:encryptedFileKey,
					user:config.user
				},
				{
					encryptedFileKey:encryptedFileKeyBSI,
					user:"bsi"
				}
			],
			init_vector:init_vector,
			itemType:isIncident
		},
			function(err, result) {
				assert.equal(err, null);
				assert.equal(1, result.result.n);
				assert.equal(1, result.ops.length);
				console.log("Inserted 1 document into the item collection");
			}
		);
	  client.close();
	});
}




//CHAIN QUERY
async function chainQuery_blamings() {
	return await rpc.get_table_rows({
		"json": true,
		"code": "reporting",
		"scope": "reporting",
		"table": "blaming"
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
  	(async () => {
	  const result = await api.transact({
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
	  console.dir(result);
	})();
}
function chainTransaction_buy(itemKey) {
  	(async () => {
	  const result = await api.transact({
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
	})();
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
function chainTransaction_received(itemKey, done) {
  	(async () => {
	  const result = await api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'received',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        buyer: config.user,
	        itemKey: itemKey,
	        done: done,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
	})();
}
function chainTransaction_report(data, ancestor, incident) {
  	(async () => {
	  const result = await api.transact({
	    actions: [{
	      account: 'reporting',
	      name: 'report',
	      authorization: [{
	        actor: config.user,
	        permission: 'active',
	      }],
	      data: {
	        reporter: config.user,
	        hash: data,
	        parentLink: ancestor,
	        isIncident: incident,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
	})();
}
function chainTransaction_transfer(to, amount) {
  	(async () => {
	  const result = await api.transact({
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
	})();
}
function chainTransaction_vote(itemKey, merit) {
  	(async () => {
	  const result = await api.transact({
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
	        merit: merit,
	      },
	    }]
	  }, {
	    blocksBehind: 3,
	    expireSeconds: 30,
	  });
	  console.dir(result);
	})();
}
function chainTransaction_voteb(blameKey, value) {
  	(async () => {
	  const result = await api.transact({
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
	  console.dir(result);
	})();
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