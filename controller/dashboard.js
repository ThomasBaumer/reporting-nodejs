const config = require('../config');
const nav = require('./nav');
const fs = require('fs');
const site = "dashboard";
const mongodb = require('../logic/mongodb');
const chainwrite = require('../logic/chainwrite');
const jsdom = require("jsdom");
const jquery = require("jquery");
const chainread = require('../logic/chainread');

module.exports = {
    handleRequest(req, res) {
        //select voters (on-chain) and share the threat intelligence data with the voters
        if (req.body.hasOwnProperty("setvoters-btn")) {
            let selectedVoters = chainwrite.selectvoter(req.body.key);
            selectedVoters.then(function (result) {

                //get decrypted file key
                let hash = req.body.hash;
                let db_item_entry_raw = mongodb.read_item_byID(hash);
                db_item_entry_raw.then(function (result) {

                    let encryptedFileKeys = result[0].fileKeys;
                    let encryptedFileKey_user;
                    for (let i = 0; i < encryptedFileKeys.length; i++) {
                        if (encryptedFileKeys[i].user != config.user) {
                            continue;
                        }
                        encryptedFileKey_user = encryptedFileKeys[i].encryptedFileKey;
                        break;
                    }
                    let decryptedFileKey = crypto.decryptRSA(encryptedFileKey_user, config.privateKey_mongo);

                    //get applicants/voters
                    let applications = chainread.applications();
                    applications.then(function (result) {
                        let applicants = [];
                        for (let i = 0; i < result.rows.length; i++) {
                            let row = result.rows[i];
                            if (row.itemKey == req.body.key && row.active == 1) {
                                let applicant = JSON.stringify(row.applicant).substring(1, JSON.stringify(row.applicant).length - 1);
                                applicants.push(applicant);
                            }
                        }
                        console.log(applicants.toString());

                        //get public key of voters
                        let users = chainread.users();
                        users.then((result) => {
                            applicants.forEach(function (element) {
                                for (let i = 0; i < result.rows.length; i++) {
                                    let row = result.rows[i];
                                    if (row.user == element) {
                                        //encrypt file key with public key of voter
                                        let encryptedFileKey_applicant = crypto.encryptRSA(decryptedFileKey, row.publicKey);
                                        console.log("\n\napplicant: " + element + "\n encryptedFileKey_applicant: " + encryptedFileKey_applicant);
                                        //write encrypted file key to database
                                        mongodb.write_addEncryptedFileKey(hash, element, encryptedFileKey_applicant);
                                    }
                                }
                            });
                            this.loadPage(res, false, true);
                        }, (err) => {
                            this.loadPage(res, err);
                        });
                    }, (err) => {
                        this.loadPage(res, err);
                    });
                }, (err) => {
                    this.loadPage(res, err);
                });
            }, (err) => {
                this.loadPage(res, err);
            });

            //everything else is trivial
        } else {
            let promise;
            //application
            if (req.body.hasOwnProperty("apply-btn")) {
                promise = chainwrite.apply(req.body.key);
                //voting
            } else if (req.body.hasOwnProperty("vote-btn")) {
                promise = chainwrite.vote(req.body.key, req.body.overall, req.body.description, req.body.service, req.body.quality);
                //order
            } else if (req.body.hasOwnProperty("order-btn")) {
                promise = chainwrite.buy(req.body.key);
                //set price
            } else if (req.body.hasOwnProperty("price-btn")) {
                promise = chainwrite.updateprice(req.body.key, req.body.price);
                //approve (only by bsi)
            } else if (req.body.hasOwnProperty("approve-btn")) {
                promise = chainwrite.approve(req.body.key);
            }

            //generate the new page
            promise.then((result) => {
                this.loadPage(res, false, true);
            }, (err) => {
                this.loadPage(res, err);
            });
        }

    },


//view blockchain data (dashboard) with some colored lables and buttons. Don't get dazzled by it's fanciness. :))
    loadPage(res, err, done) {
        // let head 		= fs.readFileSync(path + 'head.html', 'utf8');
        // let navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
        let view = nav.load(site);

        if (err) {
            let message = "<div class='bg-danger'>Interaktion fehlgeschlagen</div>" + err;
            let view_error_dom = new jsdom.JSDOM(view);
            let $ = jquery(view_error_dom.window);
            $('p.error').html(message);
            view = view_error_dom.serialize();
        }
        if (done) {
            let message = "<div class='bg-succes'>Interaktion erfolgreich</div>";
            let view_error_dom = new jsdom.JSDOM(view);
            let $ = jquery(view_error_dom.window);
            $('p.error').html(message);
            view = view_error_dom.serialize()
        }


        let items = chainread.items();
        items.then(function (result) {

            //assemble table
            let table = '<table class="table align-items-center table-flush">';
            table += '<tr>' +
                '<th>#</th>' +
                '<th>Hash</th>' +
                '<th>Typ</th>' +
                // '<th>#-Link</th>'+
                '<th>Reporter</th>' +
                '<th>Rating</th>' +
                '<th>Preis</th>' +
                '<th>Belohnung</th>' +
                '<th>Status</th>' +
                '<th>Votes</th>' +
                '<th>BSI-OK</th>' +
                '<th>Aktion</th>' +
                '</tr>';
            for (let i = 0; i < result.rows.length; i++) {
                let row = result.rows[i];
                let text = "";
                let label = "";
                table += '<tr>';

                let state = "accepted";
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
                let hash = JSON.stringify(row.hash).substring(1, JSON.stringify(row.hash).length - 1);
                table += '<td>' + hash.slice(0, hash.length / 2) + '<br>' + hash.slice(hash.length / 2) + '</td>';
                //Typ
                text = "Incident";
                label = 'class="label-primary"';
                if (JSON.stringify(row.incident) == 0) {
                    text = "<b>Datenanalyse</b>";
                    label = 'class="label-secondary"';
                }
                table += '<td><div ' + label + '>' + text + '</div></td>';
                //parent Link
                // table += '<td>' + JSON.stringify(row.parentLink) + '</td>';
                //reporter
                table += '<td>' + JSON.stringify(row.reporter).substring(1, JSON.stringify(row.reporter).length - 1) + '</td>';

                //rating
                label = 'class="label-attention"';
                text = 'pending';
                if (state == "accepted") {
                    label = 'class="label-ok"';
                    let rating = JSON.stringify(row.rating).substring(1, JSON.stringify(row.rating).length - 1);

                    let quality = rating.substring(JSON.stringify(row.rating).length - 5, JSON.stringify(row.rating).length);
                    let service = rating.substring(JSON.stringify(row.rating).length - 8, JSON.stringify(row.rating).length - 5);
                    let description = rating.substring(JSON.stringify(row.rating).length - 11, JSON.stringify(row.rating).length - 8);
                    let overall = rating.substring(JSON.stringify(row.rating).length - 14, JSON.stringify(row.rating).length - 11);
                    text = 'Gesamt: ' + overall + '<br>Beschreibung: ' + description + '<br>Service: ' + service + '<br>Qualität: ' + quality;
                }
                if (state === "failed") {
                    label = 'class="label-danger"';
                    text = "Flop";
                }
                table += '<td><div ' + label + '>' + text + '</div></td>';

                //price
                table += '<td><div class="label-primary">' + JSON.stringify(row.price) + '</div></td>';
                //reward
                table += '<td><div class="label-primary">' + JSON.stringify(row.reward) + '</div></td>';

                //Status
                if (state === "accepted" || "failed") {
                    text = "Abgeschlossen";
                    label = 'class="label-secondary"';
                }
                if (state === "application") {
                    text = "Bewerbung";
                    label = 'class="label-ok"';
                }
                if (state === "setvoters") {
                    text = "Planung Voting ";
                    label = 'class="label-primary"';
                }
                if (state === "voting") {
                    text = "Voting ";
                    label = 'class="label-attention"';
                }
                table += '<td><div ' + label + '>' + text + '</div></td>';

                //Confirmations/Votes
                table += '<td>' + JSON.stringify(row.confirmations) + "/" + JSON.stringify(row.votes) + '</td>';
                //BSI-OK
                text = "OK";
                label = 'class="label-ok"';
                if (JSON.stringify(row.approval) == 0) {
                    text = "<b>Keine Bewertung</b>";
                    label = 'class="label-attention"';
                }
                table += '<td><div ' + label + '>' + text + '</div></td>';

                //ACTION BUTTON
                table += '<td>';
                if (state == "failed") {
                    table += '<div class="label-danger">Mangelhaftes Rating</div>';
                } else {
                    table += '<form action="/dashboard" method="post">';
                    table += '<input id="key" name="key" type="hidden" value="' + JSON.stringify(row.key) + '" />';
                    if (JSON.stringify(row.reporter).substring(1, JSON.stringify(row.reporter).length - 1) == config.user) {
                        if (state === "setvoters") {
                            table += '<input id="hash" name="hash" type="hidden" value="' + hash + '" />';
                            table += '<input name="setvoters-btn" class="btn btn-success btn-sm btn-block" type="submit" value="Voting planen" style="margin-bottom:5px">';
                        }
                        table += '<input id="price" name="price" type="number" min=0 max=1000 value=10 /> ';
                        table += '<input name= "price-btn" class="btn btn-success btn-sm" type="submit" value="set">';
                    } else {
                        if (state === "accepted") {
                            table += '<input name="order-btn" class="btn btn-primary btn-sm btn-block" type="submit" value="Bestellen">';
                        } else if (state === "voting") {
                            table += '<label>Gesamt</label><input id="overall" name="overall" type="number" min=0 max=99 value=10 style="float:right;" /><br>';
                            table += '<label>Beschreibung</label><input id="description" name="description" type="number" min=0 max=99 value=10 style="float:right;" /><br>';
                            table += '<label>Service</label><input id="service" name="service" type="number" min=0 max=99 value=10 style="float:right;" /><br>';
                            table += '<label>Qualität</label><input id="quality" name="quality" type="number" min=0 max=99 value=10 style="float:right;" />';
                            table += '<input name="vote-btn" class="btn btn-primary btn-sm btn-block" type="submit" value="Voten">';
                        } else if (state === "application") {
                            table += '<input name="apply-btn" class="btn btn-success btn-sm btn-block" type="submit" value="Bewerben">';
                        }
                        if ("bsi" === config.user && JSON.stringify(row.approval) == 0) {
                            table += '<input name="approve-btn" class="btn btn-success btn-sm btn-block" type="submit" value="BSI Bestätigung">';
                        }
                    }
                    table += '</form>';
                }
                table += '</td>';

                table += '</tr>';
            }
            table += '</table>';

            //place table;
            let view_dom = new jsdom.JSDOM(view);
            let $ = jquery(view_dom.window);
            $('.table-responsive').html(table);
            view = view_dom.serialize();

            //send page to user
            nav.deliver(res, view);
            // res.send('<!DOCTYPE html><html lang="de">' + template.head() + '<body>' + template.navigation() + view + '</body></html>');
        }, function (err) {
            console.log(err);
        });
    }
};