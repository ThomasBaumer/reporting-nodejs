const config = require('../config');
var ipfsClient = require('ipfs-http-client')
const ipfs = ipfsClient({
    host: config.IPFS.ip,
    port: config.IPFS.port,
    protocol: 'http'
});

const itemsPath = "/user/items/";
const keysPath = "/user/keys/";

const chain = require('./chainread');

/**
 * Write a single JS object to an IPFS path
 * @param path
 * @param json JS object to convert to json
 * @returns {Promise<Promise|boolean|*|Boolean|void>}
 */
async function writeJson(path, json){
    return ipfs.files.write(path,
        Buffer.from(JSON.stringify(json)),
        {create: true, parents: true});
}

async function readJson(path) {
    let res = await ipfs.get(path);
    return res.length === 1 ?
        JSON.parse(res.toString()) :
        res.slice(1).map(c => JSON.parse(c.content.toString()));
}

/**
 * Republish IPNS entry and update pin
 */
async function updateFeed(){
    let stat = await ipfs.files.stat("/user");
    return Promise.all(
        ipfs.name.publish(stat.hash),
        ipfs.pin.add(stat.hash)
    );
}
//for a single user, retrieve all items
async function getUserItems(user){
    user.peerId = "QmYZ6jNzSSXnWDVC4RCYN4RtMEMn3KpqmWYMpqRe76saE4" //fixed name for .57 ip for testing
    let dir = await ipfs.name.resolve(user.peerId);
    let items = await readJson(dir + '/items/');
    let keys = await readJson(dir + '/keys/')

    //add each key to items by _id
    keys.forEach(key => {
        let item = items.find(item => {
            return key._id === item._id;
        });
        if(item) item.fileKeys = key.fileKeys;
    });

    return items;
}

module.exports = {


    async read_item() {
        let users = chain.users();
        return Promise.all(users.map(getUserItems));
    },

    async read_item_byID(user, hash) {
        let dir = await ipfs.name.resolve(user.peerId);
        let item = await readJson(dir + '/items/' + hash);
        let key = await readJson(dir + '/keys/' + hash);
        item.fileKeys = key;
        return item;
    },

    async write_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, init_vector, isIncident, title, description, industry, bsig) {
        let incident =  {
            _id:hashEncryptedData, encryptedData:encryptedData, init_vector:init_vector,
            itemType:isIncident, title:title, description:description, industry:industry
        };
        let fileKey = [ { encryptedFileKey:encryptedFileKey, user:config.user } ];

        if(bsig) fileKey.push({ encryptedFileKey:encryptedFileKeyBSI, user:"bsi" });

        await Promise.all(
            writeJson(itemsPath + hashEncryptedData, incident),
            writeJson(keysPath + hashEncryptedData, fileKey)
        );

        await updateFeed();
    },

    async write_addEncryptedFileKey(hash, user, encryptedFileKey) {
        //update id (hash) with encryptedFileKey
        let entry = {encryptedFileKey: encryptedFileKey, user: user};
        let path = keysPath + hash;

        let json = await readJson(path);
        json.fileKeys.push(entry);

        return writeJson(path, json);
    }
};