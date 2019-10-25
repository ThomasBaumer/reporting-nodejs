const config = require('../config');
const fetch = require('node-fetch');
const { TextEncoder, TextDecoder } = require('util');
const {Api, JsonRpc, RpcError} = require('eosjs');
const {JsSignatureProvider} = require('eosjs/dist/eosjs-jssig');
const signatureProvider = new JsSignatureProvider([config.privateKey_eos]);
const rpc = new JsonRpc('http://' + config.Nodeos.ip + ':' + config.Nodeos.port, { fetch });
const api = new Api({rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder()});

module.exports = {
    apply(itemKey) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'apply',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    itemKey: itemKey,
                    applicant: config.user,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, approve(key) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'approve',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    key: key,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, blame(blamed, reason, freeze) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'blame',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    blamer: config.user,
                    blamed: blamed,
                    reason: reason,
                    freeze: freeze,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, buy(itemKey) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'buy',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    itemKey: itemKey,
                    buyer: config.user,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, received(orderKey, done) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'received',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    buyer: config.user,
                    orderKey: orderKey,
                    done: done,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, report(hash, ancestor, price, reward) {
        let incident = true;

        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'report',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    reporter: config.user,
                    hash: hash,
                    parentLink: ancestor,
                    isIncident: incident,
                    price: price,
                    reward: reward,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, selectvoter(itemKey) {
        let nonce = parseInt("0x" + crypto.getCryptoRandom(5));
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'selectvoter',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    reporter: config.user,
                    itemKey: itemKey,
                    nonce: nonce,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, sent(orderKey) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'sent',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    seller: config.user,
                    orderKey: orderKey,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, transfer(to, amount) {
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
    }, updatepk(publicKey) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'updatepk',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    user: config.user,
                    publicKey: publicKey,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, updateprice(itemKey, price) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'updateprice',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    reporter: config.user,
                    itemKey: itemKey,
                    price: price,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, vote(itemKey, overall, description, service, quality) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'vote',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    itemKey: itemKey,
                    voter: config.user,
                    overall: overall,
                    description: description,
                    service: service,
                    quality: quality,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }, voteb(blameKey, value) {
        return api.transact({
            actions: [{
                account: 'reporting',
                name: 'voteb',
                authorization: [{
                    actor: config.user,
                    permission: 'active',
                }],
                data: {
                    blameKey: blameKey,
                    voter: config.user,
                    value: value,
                },
            }]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
    }


};