'use strict';
var parseQuery = require('loader-utils').parseQuery;
var web3 = require('web3');

module.exports = function (source) {
  this.cacheable && this.cacheable();
  console.log(this.query);
  console.log(source);
  //process.exit();
  return source;
};
