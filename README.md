# web3 loader for webpack

Deploys Ethereum VM bytecode and returns ready-to-use JavaScript instance of the deployed smart contract(s). Also returns initialized web3 object from [Web3 object](https://github.com/ethereum/wiki/wiki/JavaScript-API) for easy usage.

Ideally to be used with [solc-loader](https://github.com/uzyn/solc-loader) for solidity compilation and bytecode generation.

A web3 provider is required when running `web3-loader`. [testrpc](https://github.com/ethereumjs/testrpc) is handy during development, while [geth](https://github.com/ethereum/go-ethereum) would be useful to test in actual Ethereum environment where blocks are not mined immediately after every actions.

##### Sample code

Sample dapp or starter kit can be found at [uzyn/ethereum-webpack-example-dapp](https://github.com/uzyn/ethereum-webpack-example-dapp).

## Installation

```bash
npm install web3-loader --save-dev
```

## Usage

This loader is ideally to be used after `solc-loader` on Solidity smart contract code (`.sol`).

### Example webpack config

At your project's `webpack.config.js`:

```js
module.exports = {
  module: {
    loaders: [
      {
        test: /\.sol$/,
        loaders: ['web3', 'solc']
    ]
  }
}
```

### Usage in your project

Using [Ethereum's The Coin](https://www.ethereum.org/token) as an example:

```js
import { MyToken } from './contract/MyToken.sol';

// MyToken is now available as a ready-to-use contract instance
const symbol = MyToken.symbol();
MyToken.transfer('0x............', 1);
```

You can also interact with the ininitialized web3 instance without having to import and initialize web3 in your code.

```js
import { MyToken, web3 } from './contract/MyToken.sol';

let currentBlock = web3.eth.blockNumber;
```
### Solidity Contract Dependency Injection

This loader is able to automatically inject address of deployed contract if your contracts depends on it.
To use dependency injection you will need:
 - Contracts.sol - a central file which you will `require` in your js
 - `inject_` constructor variables

Consider such example:
```
//Manager.sol
contract Manager {
  //Some state + complex stuff that is accessed by other contracts
}

//SomeContract.sol
import 'Manager.sol';

contract SomeContract1 {

  address manager;

  function SomeContract(inject_Manager) {
    manager = inject_Manager;
  }

  function doSmth() {
    Manager(manager).someMethod();
  }
}

//Contracts.sol will contain just 'import' statements
import 'SomeContract1';
```

In JS code:
```
var contracts = require('Contracts.sol');
var SomeContract1 = contracts.SomeContract;
var Manager = contracts.Manager;
var web3 = contracts.web3;
```

In `Contracts.sol` only root contracts can be specified. Loader automatically builds dependency
graph based on `import` statements and `inject_` constructor variables.
Run `webpack -d` to see debug information on the order of deployment.

If your construct must accept other variables they should be placed before because loader just appends injected contract addresses to the end of `constructorParams` config variable.

## Configuration

Configuration is _not needed_ for most common use cases.

### Options

1. `provider`
    - Web3 provider
    - Default: `http://localhost:8545`
1. `from`
    - Account to deploy contract from.
    - Default: first account at your Web3 provider, ie. `web3.eth.accounts[0]`.
1. `gasLimit`
    - Maximum gas allowed for deploying of each contracts.
    - Default: latest gasLimit of Ethereum, ie. `web3.eth.getBlock(web3.eth.defaultBlock).gasLimit`
1. `constructorParams`
    - Specify contract constructor parameters, if any.
    - Parameters for a contract must be listed in an array form.
    - Default: `{}` _(empty object)_
    - See next section for example.
1. `deployedContracts`
    - If you would like to use existing deployed contracts, specify contract addresses for each contracts.
    - If a contract is not found, it would be deployed at build.
    - Default: `{}` _(empty object)_
    - See next section for example.

#### Config style

Recommended especially for configuring of contract addresses.

```js
// webpack.config.js
module.exports = {
  web3Loader: {
    // Web3
    provider: 'http://localhost:8545',

    // For deployment
    from: '0xFfA57D3e88A24311565C9929F180739E43FBD0aA',
    gasLimit: 100000,

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
  }
}
```

#### Query style

Query style is also supported but can be tricky for `constructorParams` and `deployedContracts`.

```js
loaders: ['web3?gasLimit=50000&provider=http://example.org:8545']
```


## License
MIT · [U-Zyn Chua](http://uzyn.com) ([@uzyn](http://twitter.com/uzyn))

Tips: `0xFfA57D3e88A24311565C9929F180739E43FBD0aA`
