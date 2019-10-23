const config = require('../config.json');
const mongodb = require('../logic/mongodb');
const crypto = require('../logic/cryptofunctions');
const nav = require('./nav');
const jsdom = require("jsdom");
const jquery = require("jquery");
const site = "view";


module.exports = {
//view database with colored buttons and lables. With the encryption of the threat intelligence data.
    getPageViewDatabase(res, err, done) {
    // let head 		= fs.readFileSync(path + 'head.html', 'utf8');
    // let navigation 	= fs.readFileSync(path + 'navigation.html', 'utf8');
    let view 		= nav.load(site);
    let items 		= mongodb.read_item();

    if(err) {
        let message = "<div class='label-danger'>Bestellung fehlgeschlagen</div>"+err;
        let view_error_dom = new jsdom.JSDOM(view);
        let $ = jquery(view_error_dom.window);
        $('p.error').html(message);
        view = view_error_dom.serialize();
    }
    if(done) {
        let message = "<div class='label-ok'>Bestellung erfolgreich</div>";
        let view_error_dom = new jsdom.JSDOM(view);
        let $ = jquery(view_error_dom.window);
        $('p.error').html(message);
        view = view_error_dom.serialize()
    }

    items.then( function(result) {
        //assemble table
        let table = '<table class="table table-hover table-dark">';
        table += '<tr><th>Titel</th><th>Beschreibung</th><th>Branche</th><th>Hash</th><th>Typ</th><th>Daten</th></tr>';
        for(let i = 0; i < result.length; i++) {
            let row = result[i];
            //console.log(row);
            let text = ""; let label = "";

            let encryptedFileKey, encryptedData, iv, decryptedFileKey, decryptedData;
            let owned = false;
            for(let k = 0; k < row.fileKeys.length; k++) {
                if (config.user == row.fileKeys[k].user) {
                    let owned = true;
                    encryptedFileKey = JSON.stringify(row.fileKeys[k].encryptedFileKey);

                    encryptedData = JSON.stringify(row.encryptedData).substring(1, JSON.stringify(row.encryptedData).length-1); //LITERALS!
                    iv = JSON.stringify(row.init_vector).substring(1, JSON.stringify(row.init_vector).length-1); //LITERALS!

                    decryptedFileKey = crypto.decryptRSA(encryptedFileKey, config.privateKey_mongo);
                    decryptedData = crypto.decryptAES(encryptedData, decryptedFileKey, iv);

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
            let hash = JSON.stringify(row._id).substring(1, JSON.stringify(row._id).length-1);
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
        let view_dom = new jsdom.JSDOM(view);
        let $ = jquery(view_dom.window);
        $('p.items').html(table);
        view = view_dom.serialize();

        //send page to user
        nav.deliver(res, view);

        // res.send('<!DOCTYPE html><html lang="de">' + head + '<body>' + navigation + view + '</body></html>');
    }, function(err) { console.log(err); });
}
};