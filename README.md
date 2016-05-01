# web3 loader for webpack

Deploys Ethereum VM bytecode and returns ready-to-use JavaScript instance of the deployed smart contract(s). Also returns initialized web3 object from [Web3 object](https://github.com/ethereum/wiki/wiki/JavaScript-API) for easy usage.

Ideally to be used with [solc-loader](https://github.com/uzyn/solc-loader) for solidity compilation and bytecode generation.

A web3 provider is required when running `web3-loader`. [testrpc](https://github.com/ethereumjs/testrpc) is handy during development, while [geth](https://github.com/ethereum/go-ethereum) would be useful to test in actual Ethereum environment where blocks are not mined immediately after every actions.

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
    - Default: `{}` _(empty object)_
    - See next section for example.
1. `deployedContracts`
    - If you would like to use existing deployed contracts, specify contract addresses for each contracts.
    - If a contract is not found in the list, it would be deployed as usual.
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
    //   ContractOne: {
    //    param1: 'value',
    //    param2: 2000
    //   }
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
