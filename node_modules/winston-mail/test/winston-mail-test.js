/*
 * winston-mail-test.js: Tests for instances of the Mail transport
 */
var vows = require('vows');
var assert = require('assert');
var winston = require('winston');
var helpers = require('winston/test/helpers');
var smtp = require('simplesmtp').createServer();
var Mail = require('../lib/winston-mail').Mail;

smtp.listen(2500, function (err) { if (err) console.log(err); });
smtp.on('dataReady', function (env, cb) { cb(null, 'abc'); });

function assertMail (transport) {
  assert.instanceOf(transport, Mail);
  assert.isFunction(transport.log);
}

var transport = new (Mail)({ to: 'wavded@gmail.com', from: 'dev@server.com', port: 2500 });

vows.describe('winston-mail').addBatch({
 "An instance of the Mail Transport": {
   "should have the proper methods defined": function () {
     assertMail(transport);
   },
   "the log() method": helpers.testNpmLevels(transport, "should log messages to Mail", function (ign, err, logged) {
     assert.isTrue(!err);
     assert.isTrue(logged);
   })
 }
}).addBatch({
  "Tear down": { 'smtp': function () { smtp.end(function () {}) } }
}).export(module);
