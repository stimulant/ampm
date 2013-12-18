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
    nameTransport,
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
  inputToken: config.transports.loggly.inputToken
});

nameTransport = new (Loggly)({ 
  subdomain: config.transports.loggly.subdomain,
  inputName: config.transports.loggly.inputName,
  auth: config.transports.loggly.auth
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
    },
    "when passed an input name": {
      topic: function () {
        if (nameTransport.ready) {
          return null;
        }
        
        nameTransport.once('ready', this.callback);
      },
      "should have the proper methods defined": function () {
        assertLoggly(nameTransport);
      },
      "the log() method": helpers.testNpmLevels(nameTransport, "should log messages to loggly", function (ign, err, result) {
        assert.isNull(err);
        assert.isTrue(result === true || result.response === 'ok');
      })
    }
  }
}).export(module);