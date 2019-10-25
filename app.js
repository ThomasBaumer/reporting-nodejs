const express = require('express');
const fs = require('fs');
global.viewsdir = __dirname + "/views/";

//eosjs
// const { Api, JsonRpc, RpcError } = require('eosjs');
// const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
//load custom config file
const config = require('./config.json');
//manipulate html
const jsdom = require("jsdom");
const jquery = require("jquery");

const app = express();
const router = express.Router();
const path = __dirname + '/views/';
const port = 8080;


//logic
const crypto = require('./logic/cryptofunctions');
const chainwrite = require('./logic/chainwrite');
const chainread = require('./logic/chainread');
const mongodb = require('./logic/mongodb');

//controller
const c_home = require('./controller/home');
const c_report = require('./controller/report');
const c_dashboard = require('./controller/dashboard');
const c_view = require('./controller/view');
const c_orders = require('./controller/orders');
const c_transfer = require('./controller/transfer');
const c_blame = require('./controller/blame');
const c_mypage = require('./controller/mypage');
const c_about = require('./controller/about');




router.use(function (req, res, next) {
    // console.log('/' + req.method);
    next();
});


//GET ENDPOINTS: MANAGE ROUTING
router.get('/', function (req, res) {
    res.redirect('/report');
});
router.get('/home', function (req, res) {
    c_home.getPageHome(res);
});
router.get('/report', function (req, res) {
    c_report.loadPage(res);
});
router.get('/dashboard', function (req, res) {
    c_dashboard.loadPage(res);
});
router.get('/view', function (req, res) {
    c_view.getPageViewDatabase(res);
});
router.get('/orders', function (req, res) {
    c_orders.loadPage(res);
});
router.get('/transfer', function (req, res) {
    c_transfer.loadPage(res);
});
router.get('/blame', function (req, res) {
    c_blame.loadPage(res);
});
router.get('/mypage', function (req, res) {
    c_mypage.loadPage(res);
});
router.get('/about', function (req, res) {
    c_about.getPageAbout(res);
});

app.use(express.static(path));
app.use('/', router);

// app.listen(port, function () {
//     console.log(`
// ██████╗ ███████╗██████╗  ██████╗ ██████╗ ████████╗██╗███╗   ██╗ ██████╗     ██╗    ██╗███████╗██████╗ ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗
// ██╔══██╗██╔════╝██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██║████╗  ██║██╔════╝     ██║    ██║██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
// ██████╔╝█████╗  ██████╔╝██║   ██║██████╔╝   ██║   ██║██╔██╗ ██║██║  ███╗    ██║ █╗ ██║█████╗  ██████╔╝███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
// ██╔══██╗██╔══╝  ██╔═══╝ ██║   ██║██╔══██╗   ██║   ██║██║╚██╗██║██║   ██║    ██║███╗██║██╔══╝  ██╔══██╗╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
// ██║  ██║███████╗██║     ╚██████╔╝██║  ██║   ██║   ██║██║ ╚████║╚██████╔╝    ╚███╔███╔╝███████╗██████╔╝███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
// ╚═╝  ╚═╝╚══════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝  ╚═══╝ ╚═════╝      ╚══╝╚══╝ ╚══════╝╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝
//
// Interact with the webserver via localhost:8080.
// Don't forget to configure the config.json before starting the reporting webserver!`);
// });


//POST ENDPOINTS: MANAGE FORMS
app.use(express.urlencoded({extended: true}));
//Mange the report form
app.post('/report', (req, res) => {
    c_report.handleRequest(req, res);
});
//manage mypage form (generating key pairs)
app.post('/mypage', (req, res) => {
    c_mypage.handleRequest(req, res);
});
//manage transfer form (on-chain)
app.post('/transfer', (req, res) => {
    c_transfer.handleRequest(req, res);
});
//manage blame form
app.post('/blame', (req, res) => {
    c_blame.handleRequest(req, res);
});
//manage the dashboard form(s)
app.post('/dashboard', (req, res) => {
    c_dashboard.handleRequest(req, res);
});
//manage orders
app.post('/orders', (req, res) => {
    c_orders.handleRequest(req, res);
});




const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');
const {Api, JsonRpc, RpcError} = require('eosjs');
const {JsSignatureProvider} = require('eosjs/dist/eosjs-jssig');
const signatureProvider = new JsSignatureProvider([config.privateKey_eos]);
const rpc = new JsonRpc('http://' + config.Nodeos.ip + ':' + config.Nodeos.port, { fetch });
const api = new Api({rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder()});


transfer("bsi", 1);


function  transfer(to, amount) {
    return api.transact({
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
};











