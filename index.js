'use strict';
var async = require('async');
var fs = require('fs');
var parseQuery = require('loader-utils').parseQuery;
var path = require('path');
var web3 = require('./web3');

module.exports = function (source) {
  var loaderCallback = this.async();
  this.cacheable && this.cacheable();

  var contracts = this.exec(source);
  var tasks = [];
  for (var name in contracts) {
    var contract = contracts[name];
    tasks.push({
      name: name,
      abi: contract.abi,
      bytecode: contract.bytecode
    });
  }

  var web3Source = fs.readFileSync(path.join(__dirname, 'web3.js'), 'utf8');
  var output = web3Source + '\n';
  output += 'module.exports = {\n';

  async.map(tasks, deploy, function (err, results) {
    var instances = [];
    for (var result of results) {
      contracts[result.name]['address'] = result.address;
      output += JSON.stringify(result.name) + ': ' + 'web3.eth.contract(' + JSON.stringify(contracts[result.name]['abi']) + ').at(' + JSON.stringify(result.address) + '),\n';
    }
    output += 'web3: web3\n};\n';
    return loaderCallback(null, output);
  });
};

function deploy(contract, callback) {
  var web3Contract = web3.eth.contract(contract.abi);
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
