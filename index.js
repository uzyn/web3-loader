'use strict';
var async = require('async');
var fs = require('fs');
var loaderUtils = require('loader-utils');
var path = require('path');
var Graph = require("graphlib").Graph;
var GraphAlgorithms = require("graphlib/lib/alg");

var config;
var web3;
var isDebug;

module.exports = function (compiledContractsSource) {
  var loaderCallback = this.async();
  this.cacheable && this.cacheable();
  init(this);

  var contractMap = this.exec(compiledContractsSource, '');
  var compiledContracts = toArray(contractMap);
  sortByDependencies(compiledContracts);

  var web3Source = fs.readFileSync(path.join(__dirname, '/lib/web3-helper.js'), 'utf8');
  web3Source = web3Source.replace('__PROVIDER_URL__', config.provider);
  var output = web3Source + '\n';
  output += 'module.exports = {\n';

  async.mapSeries(
    compiledContracts,
    function (contract, callback) {
      deploy(contract, callback, contractMap);
    },
    function (err, results) {
      if (err) {
        return loaderCallback(err);
      }
      var instances = [];
      for (var result of results) {
        output += JSON.stringify(result.name) + ': ' + 'web3.eth.contract(' + JSON.stringify(result.abi) + ').at(' + JSON.stringify(result.address) + '),\n';
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
  isDebug = loader.debug;
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
function deploy(contract, callback, contractMap) {
  // Reuse existing contract address
  if (config.deployedContracts.hasOwnProperty(contract.name)) {
    contract.address = config.deployedContracts[contract.name];
    return callback(null, contract);
  }

  linkBytecode(contract, contractMap);

  // Deploy a new one
  var params = resolveConstructorParams(contract, contractMap);
  logDebug('Constructor params ' + contract.name + ':', params);
  if(contract.bytecode && !contract.bytecode.startsWith('0x')) {
    contract.bytecode = '0x' + contract.bytecode;
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
      contract.address = deployed.address;
      return callback(null, contract);
    }
  });

  var web3Contract = web3.eth.contract(contract.abi);
  web3Contract.new.apply(web3Contract, params);
}

function resolveConstructorParams(contract, contractMap) {
  var params = (config.constructorParams[contract.name] || []).slice();
  var injectableDependencies = getDependenciesFromConstructor(contract.abi);
  injectableDependencies.forEach(function (dep) {
    var address = contractMap[dep].address;
    if (address) {
      params.push(address);
    } else {
      throw Error('Contract ' + dep + ' was not deployed because its address is undefined');
    }
  });
  return params;
}

function linkBytecode(contract, allContracts) {
  var deps = getDependenciesFromBytecode(contract.bytecode);
  for (var i in deps) {
    var depName = deps[i];
    var linkedBytecode = linkDependency(
      contract.bytecode,
      depName,
      allContracts[depName].address);
    contract.bytecode = linkedBytecode;
  }
}

function sortByDependencies(compiledContracts) {
  var depsGraph = buildDependencyGraph(compiledContracts);
  var dependsOrdering = GraphAlgorithms.postorder(depsGraph, depsGraph.nodes());
  logDebug('Deployment order: ', dependsOrdering);
  compiledContracts.sort(function (a, b) {
    return dependsOrdering.indexOf(a.name) - dependsOrdering.indexOf(b.name);
  });
}

function buildDependencyGraph(contracts) {
  var g = new Graph();

  for (var i = 0; i < contracts.length; i++) {
    var contract = contracts[i];
    var contractName = contract.name;
    if (!g.hasNode(contractName)) {
      g.setNode(contractName);
    }

    var deps = getDependencies(contract);
    for (var j = 0; j < deps.length; j++) {
      var depName = deps[j];
      if (!g.hasNode(depName)) {
        g.setNode(depName);
      }

      g.setEdge(contractName, depName);
      if (!GraphAlgorithms.isAcyclic(g)) {
        throw new Error('Dependency ' + contractName + ' -> ' + depName + ' inroduces cycle');
      }
    }
  }
  return g;
}

function getDependencies(contract) {
  return getDependenciesFromBytecode(contract.bytecode)
    .concat(getDependenciesFromConstructor(contract.abi));
}

function getDependenciesFromConstructor(abi) {
  var PREFIX = "inject_";
  var onlyUnique = function(value, index, self) {
    return self.indexOf(value) === index;
  };
  var firstConstructorInputs = abi
    .filter(function (item) { return item.type === "constructor"; })
    //take only first constructor for injection
    .filter(function (item, index) { return index === 0; })
    .map(function (item) { return item.inputs; })[0] || [];
  var dependencies = firstConstructorInputs
    .filter(function (input) {
      return input.name.startsWith(PREFIX) && input.type === "address";
    })
    .map(function (input) { return input.name.substring(PREFIX.length); })
    .filter(onlyUnique);
  return dependencies;
}

function getDependenciesFromBytecode(bytecode) {
  // Library references are embedded in the bytecode of contracts with the format
  //  "__Lib___________________________________" , where "Lib" is your library name and the whole
  var regex = /__([^_]*)_*/g;
  var matches;
  var dependencies = [];
  while ( (matches = regex.exec(bytecode)) !== null ) {
    var libName = matches[1];
    if (dependencies.indexOf(libName) === -1) {
      dependencies.push(libName);
    }
  }
  return dependencies;
}

function linkDependency(binary, dependencyName, dependencyAddress) {
  var binAddress = dependencyAddress.replace("0x", "");
  var re = new RegExp("__" + dependencyName + "_*", "g");
  logDebug('Linking library \'' + dependencyName + '\' at ' + dependencyAddress);
  return binary.replace(re, binAddress);
}

function toArray(compiledContractsMap) {
  var contracts = [];
  for (var name in compiledContractsMap) {
    var contract = compiledContractsMap[name];
    contracts.push(contract);
  }
  return contracts;
}

function logDebug() {
  if (isDebug) {
    Function.prototype.apply.call(console.log, console, arguments);
  }
}
