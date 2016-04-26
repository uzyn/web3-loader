/**
 * Returns initialized web3 instance
 * and ready-to-use contract instances
 *
 * @author: U-Zyn Chua <chua@uzyn.com>
 */
var Web3 = require('web3');

var web3;

if (typeof web3 !== 'undefined') {
  web3 = new Web3(web3.currentProvider);
} else {
  web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

// For loader's internal use, this exports would be overriden by loader.
module.exports = web3;
