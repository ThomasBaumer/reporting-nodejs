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
const signatureProvider = new JsSignatureProvider([config.privateKey]);
const rpc = new JsonRpc('http://' + config.EOSIO.ip + ':' + config.EOSIO.ports[0], { fetch });
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

//manipulate html
const jsdom = require("jsdom");
const jquery = require("jquery");

//mongodb
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const url_mongo = 'mongodb://' + config.MongoDB.ip + ':' + config.MongoDB.ports[0];;


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
	const itemType = req.body.itemType;
	if(itemType == "incident") {
		const data = req.body.incidentData;
		const ancestor = req.body.incidentAncestor;
		databaseTransaction_report(data, true);
		chainTransaction_report(data, ancestor, true);
		getPageReport(res, "Der Vorfall wurde erfolgreich gemeldet.", false);
	} else if (itemType == "datamining") {
		const data = req.body.dataminingData;
		const ancestor = req.body.dataminingAncestor;
		databaseTransaction_report(data, false);
		chainTransaction_report(data, ancestor, false);
		getPageReport(res, "Die Datenanalyse wurde erfolgreich gemeldet.", false);
	} else {
		getPageReport(res, "FEHLER: Benutzen sie bitte das Formular um die Meldung zu vollziehen.", true);
	}
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
	res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + view + '</body></html>');
}
function getPageViewDatabase(res) {
	var head 		= fs.readFileSync(path + 'head.html', 'utf8');
	var navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
	var view 		= fs.readFileSync(path + 'view-database.html', 'utf8');
	var items 		= databaseQuery_item();

	items.then( function(result) {
		//assemble table
		var table = '<table>';
		table += '<tr><th>Hash</th><th>Im Besitz</th><th>Daten</th><th>Typ</th></tr>';
		for(var i = 0; i < result.length; i++) {
			var row = result[i];
			var text = ""; var label = "";

           	table += '<tr>';
           	table += '<td>' + JSON.stringify(row._id) + '</td>';

           	text = "Nein"; label = 'class="label-danger"';
            if (/* crazy file key logic */ false) { text = "Ja"; label = 'class="label-ok"'; }
           	table += '<td><div ' + label + '>' + text + '</td>';

			//TODO crazy encrpytion logic
           	table += '<td>' + JSON.stringify(row.data) + '</td>';

            text = "Vorfall"; label = 'class="label-primary"';
            if (JSON.stringify(row.itemType) == 0) { text = "<b>Datenanalyse</b>"; label = 'class="label-secondary"'; }
           	table += '<td><div ' + label + '>' + text + '</td>';
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
			<tr><td>User</td><td>` + config.user + `</tr>
			<tr><td>Public Key</td><td>` + config.publicKey + `</tr>
			<tr><td>Private Key</td><td>` + config.privateKey + `</tr></table>`;
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
function databaseTransaction_report(data, incident) {
	MongoClient.connect(url_mongo, function(err, client) {
		assert.equal(null, err);
		console.log("Connected successfully to MongoDB Container");
		const db = client.db('reporting');
		const collection = db.collection('item');
		collection.insertOne({_id:data, itemType:incident },
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