/**
 * Returns initialized web3 instance
 */
var Web3 = require('web3');

var web3;

if (typeof web3 !== 'undefined') {
  web3 = new Web3(web3.currentProvider);
} else {
  web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

module.exports = web3;
