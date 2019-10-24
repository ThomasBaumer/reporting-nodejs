var ipfsClient = require('ipfs-http-client')
const ipfs = ipfsClient({ host: '132.199.123.57', port: '5001', protocol: 'http' })

const chain = require('./chainread');

module.exports = {

    read_item() {
        let items = chain.items();
        return Promise.all(items.map(ipfs.get));
    },

    read_item_byID(hash) {
        ipfs.get(hash).then((item) => {
            return item;
        });
    },

    write_report(encryptedData, hashEncryptedData, encryptedFileKey, encryptedFileKeyBSI, init_vector, isIncident, title, description, industry, bsig) {
        let doc;
        if(bsig) {
            doc = {
                _id:hashEncryptedData, encryptedData:encryptedData,
                fileKeys: [ { encryptedFileKey:encryptedFileKey, user:config.user }, { encryptedFileKey:encryptedFileKeyBSI, user:"bsi" } ], init_vector:init_vector,
                itemType:isIncident, title:title,  description:description, industry:industry
            };
        }
        else {
            doc = {
                _id:hashEncryptedData, encryptedData:encryptedData,
                fileKeys: [ { encryptedFileKey:encryptedFileKey, user:config.user } ], init_vector:init_vector,
                itemType:isIncident, title:title, description:description, industry:industry
            }
        }

        return ipfs.add(doc);
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