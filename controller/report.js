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
        console.log(req.body);
        try {
            //fetch data
            let isIncident = true;
            if (req.body.itemType === "datamining") {
                isIncident = false;
            }
            let title, description, industry, data, ancestor, price, reward, bsig;
            if (isIncident) {
                title = req.body.incidentTitle;
                description = req.body.incidentDesc;
                data = req.body.incidentData;
                ancestor = req.body.incidentAncestor;
                price = req.body.incidentPrice;
                reward = req.body.incidentReward;
                industry = req.body.incidentIndustry;
                bsig = req.body.incidentBSIG;
            } else {
                title = req.body.dataminingTitle;
                description = req.body.dataminingDesc;
                data = req.body.dataminingData;
                ancestor = req.body.dataminingAncestor;
                price = req.body.dataminingPrice;
                reward = req.body.dataminingReward;
                industry = req.body.dataminingIndustry;
                bsig = req.body.dataminingBSIG;
            }

            //encrypt data
            let fileKey = crypto.randomBytes(32);
            let encryptedFileKey = crypto.encryptRSA(fileKey, config.publicKey_mongo);
            let {iv, encryptedData} = crypto.encryptAES(data, fileKey);
            let hashEncryptedData = crypto.hashSHA256(encryptedData);

            let encryptedFileKeyBSI;
            if (bsig) {
                encryptedFileKeyBSI = crypto.encryptRSA(fileKey, config.publicKey_mongo_BSI);
            }

            //decrypt data
            let decryptedFileKey = crypto.decryptRSA(encryptedFileKey, config.privateKey_mongo);
            let decryptedData = crypto.decryptAES(encryptedData, decryptedFileKey, iv);

            if (decryptedData != data) {
                throw "Fehlerhafter Verschlüsselung";
            }


            let report_db_promise = mongodb.write_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, iv, isIncident, title, description, industry, bsig);
            report_db_promise.then((result) => {

                let report_chain_promise = chainwrite.report(hashEncryptedData, ancestor, isIncident, price, reward);
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
            let message = "<div class='label-danger'>Meldung fehlgeschlagen</div>" + err;
            let report_error_dom = new jsdom.JSDOM(report);
            let $ = jquery(report_error_dom.window);
            $('p.error').html(message);
            report = report_error_dom.serialize();
        }
        if (done) {
            let message = "<div class='label-ok'>Meldung erfolgreich</div>";
            let report_error_dom = new jsdom.JSDOM(report);
            let $ = jquery(report_error_dom.window);
            $('p.error').html(message);
            report = report_error_dom.serialize()
        }
        template.deliver(res, report);

        // res.send('<!DOCTYPE html><html lang="de">' + template.head() + '<body>' + template.navigation() + report + '</body></html>');
    }
};