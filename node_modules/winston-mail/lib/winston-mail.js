/*
 * winston-mail.js: Transport for outputting logs to email
 *
 * (C) 2010 Marc Harter
 * MIT LICENCE
 */

var util    = require('util');
var os      = require('os');
var email   = require('emailjs');
var winston = require('winston');
var _       = require('underscore');

// Set Underscore to Mustache style templates

function template(text, obj) {
  return _.template(text,obj, {
    interpolate : /\{\{(.+?)\}\}/g
  });
}

/**
 * @constructs Mail
 * @param {object} options hash of options
 */

var Mail = exports.Mail = function (options) {
  options = options || {};

  if (!options.to){
    throw new Error("winston-mail requires 'to' property");
  }

  this.name       = options.name                   || 'mail';
  this.to         = options.to;
  this.from       = options.from                   || "winston@" + os.hostname();
  this.level      = options.level                  || 'info';
  this.silent     = options.silent                 || false;
  this.subject    = options.subject ? template(options.subject) : template("winston: {{level}} {{msg}}");

  this.handleExceptions = options.handleExceptions || false;
  this.server  = email.server.connect({
    user            : options.username,
    password        : options.password,
    port            : options.port,
    host            : options.host,
    ssl             : options.ssl || options.secure,
    tls             : options.tls
  });
};

/** @extends winston.Transport */
util.inherits(Mail, winston.Transport);

/**
 * Define a getter so that `winston.transports.Mail`
 * is available and thus backwards compatible.
 */
winston.transports.Mail = Mail;

/**
 * Core logging method exposed to Winston. Metadata is optional.
 * @function log
 * @member Mail
 * @param level {string} Level at which to log the message
 * @param msg {string} Message to log
 * @param meta {Object} **Optional** Additional metadata to attach
 * @param callback {function} Continuation to respond to when complete.
 */
Mail.prototype.log = function (level, msg, meta, callback) {
  var self = this;
  if (this.silent) return callback(null, true);

  var body = msg;

  // add meta info into the body if not empty
  if (meta !== null && meta !== undefined && (typeof meta !== 'object' || Object.keys(meta).length > 0))
      body += "\n\n" + util.inspect(meta, {depth: 5}); // add some pretty printing

  var message = email.message.create({
    from: this.from,
    to: this.to,
    subject: this.subject({level: level, msg: msg.split('\n')[0]}),
    text: body
  });

  this.server.send(message, function (err) {
    if (err) self.emit('error', err);
    self.emit('logged');
    callback(null, true);
  });
};
