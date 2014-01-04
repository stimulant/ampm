/*
 * loggly-test.js: Tests for instances of the Loggly transport
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */

var path = require('path'),
    vows = require('vows'),
    assert = require('assert'),
    winston = require('winston'),
    helpers = require('winston/test/helpers'),
    Loggly = require('../lib/winston-loggly').Loggly;

var tokenTransport,
    config;

try {
  config = require('./config');
}
catch (ex) {
  console.log('Error reading test/config.json.')
  console.log('Are you sure it exists?\n');
  console.dir(ex);
  process.exit(1);
}

tokenTransport = new (Loggly)({
  subdomain: config.transports.loggly.subdomain,
  token: config.transports.loggly.token
});

function assertLoggly(transport) {
  assert.instanceOf(transport, Loggly);
  assert.isFunction(transport.log);
}

vows.describe('winston-loggly').addBatch({
  "An instance of the Loggly Transport": {
    "when passed an input token": {
      "should have the proper methods defined": function () {
        assertLoggly(tokenTransport);
      },
      "the log() method": helpers.testNpmLevels(tokenTransport, "should log messages to loggly", function (ign, err, logged) {
        assert.isNull(err);
        assert.isTrue(logged);
      })
    }
  }
}).export(module);