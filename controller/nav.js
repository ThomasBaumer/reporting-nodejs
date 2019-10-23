const fs = require('fs');

module.exports = {

    head() {
        return fs.readFileSync(global.viewsdir + 'head.html', 'utf8');
    },
    navigation() {
        return fs.readFileSync(global.viewsdir + 'navigation.html', 'utf8');
    },
    load(site) {
        return fs.readFileSync(global.viewsdir + site + '.html', 'utf8');
    },
    deliver(res, sitecontent) {
        res.send('<!DOCTYPE html><html lang="de">' + this.head() + '<body>' + this.navigation() + sitecontent + '</body></html>');
    }


    // blame(){
    //     return fs.readFileSync(path + 'blame.html', 'utf8');
    // }
};



