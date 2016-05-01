'use strict';
var async = require('async');
var fs = require('fs');
var loaderUtils = require('loader-utils');
var path = require('path');

var config;
var web3;

module.exports = function (source) {
  var loaderCallback = this.async();
  this.cacheable && this.cacheable();
  init(this);

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

  var web3Source = fs.readFileSync(path.join(__dirname, '/lib/web3-helper.js'), 'utf8');
  web3Source = web3Source.replace('__PROVIDER_URL__', config.provider);
  var output = web3Source + '\n';
  output += 'module.exports = {\n';

  async.mapSeries(tasks, deploy, function (err, results) {
    if (err) {
      return loaderCallback(err);
    }
    var instances = [];
    for (var result of results) {
      contracts[result.name]['address'] = result.address;
      output += JSON.stringify(result.name) + ': ' + 'web3.eth.contract(' + JSON.stringify(contracts[result.name]['abi']) + ').at(' + JSON.stringify(result.address) + '),\n';
    }
    output += 'web3: web3\n};\n';
    return loaderCallback(null, output);
  });
};

/**
 * Initialize the loader with web3 and config
 */
function init(loader) {
  var loaderConfig = loaderUtils.getLoaderConfig(loader, 'web3Loader');
  web3 = require('./lib/web3')(loaderConfig.provider);
  config = mergeConfig(loaderConfig);
}

/**
 * Merge loaderConfig and default configurations
 */
function mergeConfig(loaderConfig) {
  var defaultConfig = {
    // Web3
    provider: 'http://localhost:8545',

    // For deployment
    from: web3.eth.accounts[0],
    gasLimit: web3.eth.getBlock(web3.eth.defaultBlock).gasLimit,

    // Specify contract constructor parameters, if any.
    // constructorParams: {
    //   ContractOne: [ 'param1_value', 'param2_value' ]
    // }
    constructorParams: {},

    // To use deployed contracts instead of redeploying, include contract addresses in config
    // deployedContracts: {
    //   ContractOne: '0x...........',
    //   ContractTwo: '0x...........',
    // }
    deployedContracts: {}
  };

  var mergedConfig = loaderConfig;
  for (var key in defaultConfig) {
    if (!mergedConfig.hasOwnProperty(key)) {
      mergedConfig[key] = defaultConfig[key];
    }
  }
  return mergedConfig;
}

/**
 * Deploy contracts, if it is not already deployed
 */
function deploy(contract, callback) {
  // Reuse existing contract address
  if (config.deployedContracts.hasOwnProperty(contract.name)) {
    return callback(null, {
      name: contract.name,
      address: config.deployedContracts[contract.name]
    });
  }

  // Deploy a new one
  var params = [];
  if (config.constructorParams.hasOwnProperty(contract.name)) {
    params = config.constructorParams[contract.name];
  }
  params.push({
    from: config.from,
    data: contract.bytecode,
    gas: config.gasLimit,
  });
  params.push(function (err, deployed) {
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

  var web3Contract = web3.eth.contract(contract.abi);
  web3Contract.new.apply(web3Contract, params);
}
