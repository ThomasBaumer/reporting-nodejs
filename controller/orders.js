const config = require('../config.json');
const nav = require('./nav');
const jsdom = require("jsdom");
const jquery = require("jquery");
const mongodb = require('../logic/mongodb');
const chainwrite = require('../logic/chainwrite');

const chainread = require('../logic/chainread');
const site = "orders";

module.exports = {

    handleRequest(req, res) {


        //execute order
        if (req.body.hasOwnProperty("decrypt-btn")) {

            // 1. Download Incident from EOS with itemKey -> Getting Hash
            // 2. Download Incident from DB  with hash 	  -> Getting encrypted FileKey of Seller
            // 3. Decrypt fileKey 						  -> Getting decrypted FileKey
            // 4. Download public Key from EOS with user  -> Getting public key of buyer
            // 5. Encrypt FileKey with public key of buyer-> Getting encrypted FileKey of Buyer
            // 6. Modify Incident in DB with encrypted    -> Store encrypted FileKey of Buyer at the DB
            // 7. Modify EOS state 					      -> Update Metadata

            //1.
            let item = chainread.items_byKey(req.body.itemKey);
            item.then(function (result) {
                let hash = JSON.stringify(result.rows[0].hash).substring(1, JSON.stringify(result.rows[0].hash).length - 1);
                //2.
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
                    //3.
                    let decryptedFileKey = crypto.decryptRSA(encryptedFileKey_user, config.privateKey_mongo);
                    //4.
                    let buyer_entry_eos = chainread.users_byUser(req.body.buyer);
                    buyer_entry_eos.then(function (result) {
                        let publicKey_buyer = result.rows[0].publicKey;
                        //5.
                        let encryptedFileKey_buyer = crypto.encryptRSA(decryptedFileKey, publicKey_buyer);
                        //6.
                        let db_transaction = mongodb.write_addEncryptedFileKey(hash, req.body.buyer, encryptedFileKey_buyer);
                        db_transaction.then(function (result) {
                            //7.
                            let set_chain_state = chainwrite.sent(req.body.orderKey);
                            set_chain_state.then((result) => {
                                this.loadPage(res, null, true);

                            }, (err) => {
                                this.loadPage(res, err, false);
                            });
                        }, (err) => {
                            this.loadPage(res, err, false);
                        });
                    }, (err) => {
                        this.loadPage(res, err, false);
                    });
                }, (err) => {
                    this.loadPage(res, err, false);
                });
            }, (err) => {
                this.loadPage(res, err, false);
            });

            this.loadPage(res, null, true);
        } else {
            let promise;
            //confirm the receiving of the ordered threat intelligence data
            if (req.body.hasOwnProperty("confirmation-btn")) {
                promise = chainwrite.received(req.body.key, true);
                //confirm the sending of the ordered threat intelligence data
            } else if (req.body.hasOwnProperty("rejection-btn")) {
                promise = chainwrite.received(req.body.key, false);
            }

            promise.then((result) => {
                this.loadPage(res, null, true);
            }, (err) => {
                this.loadPage(res, err, false);
            });
        }

    },


//get order page and its buttons
    loadPage(res, err, done) {
        // let head 		= fs.readFileSync(path + 'head.html', 'utf8');
        // let navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');

        let orders = nav.load(site);

        if (err) {
            let message = "<div class='label-danger'>Interaktion fehlgeschlagen</div>" + err;
            let orders_error_dom = new jsdom.JSDOM(orders);
            let $ = jquery(orders_error_dom.window);
            $('p.error').html(message);
            orders = orders_error_dom.serialize();
        }
        if (done) {
            let message = "<div class='label-ok'>Interaktion erfolgreich</div>";
            let orders_error_dom = new jsdom.JSDOM(orders);
            let $ = jquery(orders_error_dom.window);
            $('p.error').html(message);
            orders = orders_error_dom.serialize()
        }

        let order_items = chainread.orders();
        order_items.then(function (result) {

            //assemble table_torelease
            let table_torelease = '<table>';
            table_torelease += '<tr><th>#</th><th>Item</th><th>Käufer</th><th>Info/Aktion</th></tr>'
            for (let i = 0; i < result.rows.length; i++) {
                let row = result.rows[i];
                let text = "";
                let label = "";

                //only take the orders assigned to the user
                if (JSON.stringify(row.seller).substring(1, JSON.stringify(row.seller).length - 1) != config.user) {
                    continue;
                }

                table_torelease += '<tr>';

                //key
                table_torelease += '<td>' + JSON.stringify(row.key) + '</td>';
                //itemkey
                table_torelease += '<td>' + JSON.stringify(row.itemKey) + '</td>';
                //buyer
                table_torelease += '<td>' + JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length - 1) + '</td>';

                //ACTION BUTTON
                if (JSON.stringify(row.sent) == 0) {
                    table_torelease += '<td>';
                    table_torelease += '<form action="/orders" method="post">';
                    table_torelease += '<input id="buyer" name="buyer" type="hidden" value="' + JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length - 1) + '" />';
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
            let table_myOrders = '<table>';
            table_myOrders += '<tr><th>#</th><th>Item</th><th>Käufer</th><th>Erhalten?</th></tr>'
            for (let i = 0; i < result.rows.length; i++) {
                let row = result.rows[i];

                //only take the orders assigned to the user
                if (JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length - 1) != config.user) {
                    continue;
                }

                let text = "";
                let label = "";
                table_myOrders += '<tr>';

                //key
                table_myOrders += '<td>' + JSON.stringify(row.key) + '</td>';
                //itemkey
                table_myOrders += '<td>' + JSON.stringify(row.itemKey) + '</td>';
                //buyer
                table_myOrders += '<td>' + JSON.stringify(row.buyer).substring(1, JSON.stringify(row.buyer).length - 1) + '</td>';

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
            let orders_dom = new jsdom.JSDOM(orders);
            let $ = jquery(orders_dom.window);
            $('p.allOrders').html(table_torelease);
            $('p.myOrders').html(table_myOrders);
            orders = orders_dom.serialize();

            //send page to user
            nav.deliver(res, orders);
            // res.send('<!DOCTYPE html><html lang="de">' + template.head() + '<body>' + template.navigation() + orders + '</body></html>');
        }, function (err) {
            console.log(err);
        });
    }
};