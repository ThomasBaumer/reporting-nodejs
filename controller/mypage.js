const config = require('../config.json');
const nav = require('./nav');
const chainwrite = require('../logic/chainwrite');
const fs = require('fs');
const jsdom = require("jsdom");
const jquery = require("jquery");
const site = "mypage";

module.exports = {
    handleRequest(req, res) {
        console.log(req.body);
        if (req.body.itemType == "calc_keypair") {
            //get key pair
            const passphrase = crypto.getCryptoRandom(10);
            const {publicKey, privateKey} = crypto.calculateKeyPair(passphrase);

            //write key pair locally
            config.privateKey_mongo = privateKey;
            config.publicKey_mongo = publicKey;
            config.passphrase_mongo = passphrase;
            fs.writeFileSync(__dirname + '/config.json', JSON.stringify(config, null, 2));

            //write key pair remote (on-chain)
            chainwrite.updatepk(publicKey).then((result) => {
                this.loadPage(res, null, true);
            }, (err) => {
                this.loadPage(res, err, false);
            });
        }


    },
    loadPage(res, err, done) {
        // let head 		= fs.readFileSync(path + 'head.html', 'utf8');
        // let navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
        let mypage = nav.load(site);

        if (err) {
            let message = "<div class='label-danger'>Schlüsselgenerierung fehlgeschlagen</div>" + err;
            let mypage_error_dom = new jsdom.JSDOM(mypage);
            let $ = jquery(mypage_error_dom.window);
            $('p.error').html(message);
            mypage = mypage_error_dom.serialize();
        }
        if (done) {
            let message = "<div class='label-ok'>Schlüsselgenerierung erfolgreich</div>";
            let mypage_error_dom = new jsdom.JSDOM(mypage);
            let $ = jquery(mypage_error_dom.window);
            $('p.error').html(message);
            mypage = mypage_error_dom.serialize()
        }

        let account = `<table>
			<tr><td>EOSIO User</td><td>` + config.user + `</tr>
			<tr><td>EOSIO Public Key</td><td>` + config.publicKey_eos.substr(0, 5) + `...</tr>
			<tr><td>EOSIO Private Key</td><td>` + config.privateKey_eos.substr(0, 5) + `...</tr>
			<tr><td>MongoDB Public Key</td><td>` + config.publicKey_mongo.substr(27, 5) + `...</tr>
			<tr><td>MongoDB Private Key</td><td>` + config.privateKey_mongo.substr(38, 5) + `...</tr>
			<tr><td>MongoDB Passphrase</td><td>` + config.passphrase_mongo.substr(0, 3) + `...</tr></table>`;
        let endpoints = `<table>
			<tr><th>Container</th><th>IP und Port</th><th>Version</th></tr>
			<tr><td>Nodeos</td><td>` + config.Nodeos.ip + ':' + config.Nodeos.port + `</td><td>` + config.Nodeos.version + `</td></tr>
			<tr><td>Keosd</td><td>` + config.Kesod.ip + ':' + config.Kesod.port + `</td><td>` + config.Kesod.version + `</td></tr>
			<tr><td>MongoDB</td><td>` + config.MongoDB.ip + ':' + config.MongoDB.port + `</td><td>` + config.MongoDB.version + `</td></tr></table>`;

        let mypage_dom = new jsdom.JSDOM(mypage);
        let $ = jquery(mypage_dom.window);
        $('p.account').html(account);
        $('p.endpoints').html(endpoints);
        mypage = mypage_dom.serialize();

        nav.deliver(res, mypage);
    }
};