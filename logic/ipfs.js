const config = require('../config');
var ipfsClient = require('ipfs-http-client')
const ipfs = ipfsClient({
    host: config.IPFS.ip,
    port: config.IPFS.port,
    protocol: 'http'
});

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
async function resolveAndGet(user){
    user.peerId = "QmYZ6jNzSSXnWDVC4RCYN4RtMEMn3KpqmWYMpqRe76saE4" //fixed name for .57 for testing
    let dir = await ipfs.name.resolve(user.peerId);
    let files = await ipfs.ls(dir);

    //get all files
}

module.exports = {


    read_item() {
        let users = chain.users();
        return Promise.all(users.map(resolveAndGet));
    },

    read_item_byID(hash) {
        ipfs.get(hash).then((item) => {
            return item;
        });
    },

    async write_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, init_vector, isIncident, title, description, industry, bsig) {
        let incident =  {
            _id:hashEncryptedData, encryptedData:encryptedData, init_vector:init_vector,
            itemType:isIncident, title:title, description:description, industry:industry
        };
        let fileKey = [ { encryptedFileKey:encryptedFileKey, user:config.user } ];

        if(bsig) fileKey.push({ encryptedFileKey:encryptedFileKeyBSI, user:"bsi" });

        await Promise.all(
            writeJson("/user/items/" + hashEncryptedData, incident),
            writeJson("/user/keys/" + hashEncryptedData, fileKey)
        );

        await updateFeed();
    },

    write_addEncryptedFileKey(hash, user, encryptedFileKey) {
        //update id (hash) with encryptedFileKey
        let json = {encryptedFileKey: encryptedFileKey, user: user};

        //upload fileKey to IPFS (don't pin) and return hash
        ipfs.add(json).then((hash) => {
            return hash;
        });
    }
};