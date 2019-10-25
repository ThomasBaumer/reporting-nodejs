const config = require('../config.json');
const template = require('./nav');
const mongodb = require('../logic/mongodb');
const chainwrite = require('../logic/chainwrite');
const fs = require('fs');
const crypto = require('../logic/cryptofunctions');
const jsdom = require("jsdom");
const jquery = require("jquery");


module.exports = {

    handleRequest(req, res) {

        try {
            let title = req.body.incidentTitle;
            let description = req.body.incidentDesc;
            let data = req.body.incidentData;
            let ancestor = req.body.incidentAncestor;
            let price = req.body.incidentPrice;
            let reward = req.body.incidentReward;
            let industry = req.body.incidentIndustry;


            //encrypt data
            let fileKey = crypto.randomBytes(32);
            let encryptedFileKey = crypto.encryptRSA(fileKey, config.publicKey_mongo);
            let {iv, encryptedData} = crypto.encryptAES(data, fileKey);
            let hashEncryptedData = crypto.hashSHA256(encryptedData);

            //TODO -- kann weg
            //decrypt data
            let decryptedFileKey = crypto.decryptRSA(encryptedFileKey, config.privateKey_mongo);
            let decryptedData = crypto.decryptAES(encryptedData, decryptedFileKey, iv);

            if (decryptedData != data) {
                throw "Fehlerhafter Verschlüsselung";
            }


            let report_db_promise = mongodb.write_report(encryptedData, hashEncryptedData, encryptedFileKey, iv, title, description, industry);
            report_db_promise.then((result) => {


                let report_chain_promise = chainwrite.report(hashEncryptedData, ancestor, price, reward);
                report_chain_promise.then((result) => {
                    this.loadPage(res, false, true);

                }, (err) => {
                    this.loadPage(res, err);
                });
            }, function (err) {
                this.loadPage(res, err);
            });


        } catch (e) {
            this.loadPage(res, "FEHLER: Meldung war nicht erfolgreich. Verschlüsselung oder Blockchain/Datenbank Transaktion schlug fehl.", true);
        }


    },


    loadPage(res, err, done) {
        // let head 		= fs.readFileSync(path + 'head.html', 'utf8');
        // let navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
        let report = fs.readFileSync(global.viewsdir + 'report.html', 'utf8');

        if (err) {
            let message = "<div class='bg-warning'>Meldung fehlgeschlagen" + err + "</div>";
            let report_error_dom = new jsdom.JSDOM(report);
            let $ = jquery(report_error_dom.window);
            $('p.error').html(message);
            report = report_error_dom.serialize();
        }
        if (done) {
            let message = "<div class='bg-success'>Meldung erfolgreich</div>";
            let report_error_dom = new jsdom.JSDOM(report);
            let $ = jquery(report_error_dom.window);
            $('p.error').html(message);
            report = report_error_dom.serialize()
        }
        template.deliver(res, report);

        // res.send('<!DOCTYPE html><html lang="de">' + template.head() + '<body>' + template.navigation() + report + '</body></html>');
    }
};