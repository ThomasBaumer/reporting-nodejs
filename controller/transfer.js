const nav = require('./nav');
const path = __dirname + '/views/';
const chainwrite = require('../logic/chainwrite');
const fs = require('fs');
const chainread = require('../logic/chainread');
const jsdom = require("jsdom");
const jquery = require("jquery");
const site = "transfer";

module.exports = {


    handleRequest(req, res) {
        let promise = chainwrite.transfer(req.body.to, req.body.amount);
        promise.then((result) => {
            this.loadPage(res);
        }, (err) => {
            this.loadPage(res, err);
        });

    },

    loadPage(res, err) {
        // let head 		= fs.readFileSync(path + 'head.html', 'utf8');
        // let navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
        // let transfer = fs.readFileSync(global.viewsdir + 'transfer.html', 'utf8');
        let transfer = nav.load(site);
        if (err) {
            let message = "<div class='label-danger'>Überweisung fehlgeschlagen</div>" + err;
            let transfer_error_dom = new jsdom.JSDOM(transfer);
            let $ = jquery(transfer_error_dom.window);
            $('p.error').html(message);
            transfer = transfer_error_dom.serialize();
        }

        let users = chainread.users();
        users.then(function (result) {

            //assemble table
            let table = '<table class="table align-items-center table-flush">';
            table += '<tr><th>User</th><th>Balance</th><th>Status</th><th>Verificator</th><th>Complaints</th><th>Frozen</th></tr>'
            for (let i = 0; i < result.rows.length; i++) {
                let row = result.rows[i];
                let text = "";
                let label = "";
                table += '<tr>';

                //user
                table += '<td>' + JSON.stringify(row.user).substring(1, JSON.stringify(row.user).length - 1) + '</td>';
                //Kontostand
                table += '<td>' + JSON.stringify(row.balance) + '</td>';
                //Status
                table += '<td>R: ' + JSON.stringify(row.statusR) + '<br>V: ' + JSON.stringify(row.statusV) + '</td>';
                //Verifikator
                text = "Ja";
                label = 'class="label-ok"';
                if (JSON.stringify(row.verificator) == 0) {
                    text = "No";
                    label = 'class="label-danger"';
                }
                table += '<td><div ' + label + '>' + text + '</div></td>';
                //Beschwerden
                table += '<td>' + JSON.stringify(row.blames) + '</td>';
                //Eingefroren
                text = "No";
                label = 'class="label-ok"';
                if (JSON.stringify(row.frozen) == 1) {
                    text = "Ja";
                    label = 'class="label-danger"';
                }
                table += '<td><div ' + label + '>' + text + '</div></td>';
            }

            //place table;
            let transfer_dom = new jsdom.JSDOM(transfer);
            let $ = jquery(transfer_dom.window);
            $('.table-responsive').html(table);
            transfer = transfer_dom.serialize();

            return nav.deliver(res, transfer);
            // res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + transfer + '</body></html>');
        }, function (err) {
            console.log(err);
        });
    }
};