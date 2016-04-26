'use strict';
var async = require('async');
var parseQuery = require('loader-utils').parseQuery;
var web3 = require('./web3');
var _eval = require('eval');

module.exports = function (source) {
  var loaderCallback = this.async();
  this.cacheable && this.cacheable();

  var contracts = _eval(source);
  var tasks = []

  for (var name in contracts) {
    var contract = contracts[name];
    tasks.push(contract);
  }

  async.map(tasks, deploy, function (err, results) {
    console.log(results);
    return loaderCallback(null, source);
  });
};

function deploy(contract, callback) {
  console.log('deploying ' + contract.name);
  var web3Contract = web3.eth.contract(contract.interface);
  web3Contract.new({
    from: web3.eth.accounts[0],
    data: contract.bytecode,
    gas: 1000000,
  }, function (err, deployed) {
    if (err) {
      return callback(err);
    }
    if (typeof deployed.address !== 'undefined') {
      return callback(null, {
        name: contract.name,
        address: deployed.address
      });
    }
  });
}
