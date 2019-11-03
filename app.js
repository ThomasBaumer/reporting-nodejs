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
    console.log('/' + req.method);
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

var ipfsClient = require('ipfs-http-client')
const ipfs = ipfsClient({ host: '132.199.123.57', port: '5001', protocol: 'http' })
const ipfs2 = ipfsClient({ host: '132.199.123.236', port: '5001', protocol: 'http' })

doStuff();

async function doStuff(){
    let itemId = "abc";
    let fileKey = [{ id: "abc", file: "def"},{ id: "abc2", file: "def2"}]
    // let fileKeys = 	{
    //     path: "/keys/def", // The file path
    //     content: Buffer.from(JSON.stringify(fileKey))
    // };
    // await ipfs.files.mkdir("/user/keys", { parents: true })
    // await ipfs.files.mkdir("/user/items");

    // let user = await ipfs.files.stat("/user");
    // console.log(user);
    // let res = await ipfs.name.publish(user.hash)
    // console.log(res)

    let res = await ipfs2.name.resolve("QmYZ6jNzSSXnWDVC4RCYN4RtMEMn3KpqmWYMpqRe76saE4");

    res = await ipfs2.ls(res + '/keys')
    console.log(res)
    // let path = "/user/items"
    // let res = await ipfs.files.ls(path);
    // console.log(res)

    // let stats = await ipfs.files.stat(path).catch((err) => {
    //     ipfs.files.mkdir(path, {parents: true}).then(() => {
    //         return ipfs.files.stat(path);
    //     });
    // }).then((res) => { console.log(res) });

    //await ipfs.files.write("/user/items/" + itemId,Buffer.from(JSON.stringify(fileKey)), {create: true})
    //let result = await ipfs.files.stat("/usr"); console.log(result);
    // let result = await ipfs.files.stat("/usr", (err, res) => {
    //    if(err) console.log("hi");
    //    else console.log(res);
    // });
    // console.log(result)
    // result = await ipfs.files.stat("/keys"); console.log(result);
}
// let res = ipfs.files.read("/test", (error, buf) => {
//     console.log(buf.toString('utf8'))
// })
// ipfs.files.write("/test", Buffer.from('Hello, world 2!'))
// res = ipfs.files.read("/test", (error, buf) => {
//     console.log(buf.toString('utf8'))
// })