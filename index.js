'use strict';
var async = require('async');
var fs = require('fs');
var parseQuery = require('loader-utils').parseQuery;
var path = require('path');
var _eval = require('eval');
var web3 = require('./web3');

module.exports = function (source) {
  var loaderCallback = this.async();
  this.cacheable && this.cacheable();

  var contracts = _eval(source);
  var tasks = [];

  for (var name in contracts) {
    var contract = contracts[name];
    tasks.push(contract);
  }

  async.map(tasks, deploy, function (err, results) {
    var replacements = [];
    for (var result of results) {
      contracts[result.name]['address'] = result.address;
      replacements.push({
        replace: '__' + result.name + '__REPLACE_INSTANCE__',
        with: 'web3.eth.contract(' + JSON.stringify(contracts[result.name]['interface']) + ').at(' + JSON.stringify(result.address) + ')'
      });
      contracts[result.name]['instance'] = '__' + result.name + '__REPLACE_INSTANCE__';
    }

    var web3Source = fs.readFileSync(path.join(__dirname, 'web3.js'), 'utf8');
    var loaderOutput = web3Source;
    loaderOutput += 'module.exports = ' + JSON.stringify(contracts) + ';';
    for (var replacement of replacements) {
      loaderOutput = loaderOutput.replace('"' + replacement.replace + '"', replacement.with);
    }

    return loaderCallback(null, loaderOutput);
  });
};

function deploy(contract, callback) {
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
