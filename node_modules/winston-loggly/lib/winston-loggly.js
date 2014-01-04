/*
 * loggly.js: Transport for logginh to remote Loggly API
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 *
 */

var events = require('events'),
    loggly = require('loggly'),
    util = require('util'),
    winston = require('winston'),
    Stream = require('stream').Stream;

//
// ### function Loggly (options)
// #### @options {Object} Options for this instance.
// Constructor function for the Loggly transport object responsible
// for persisting log messages and metadata to Loggly; 'LaaS'.
//
var Loggly = exports.Loggly = function (options) {
  options = options || {};

  //
  // Small amount of backwards compatibility with 0.x.x
  //
  if (options.inputToken && !options.token) {
    options.token = options.inputToken;
  }

  winston.Transport.call(this, options);
  if (!options.subdomain) {
    throw new Error('Loggly Subdomain is required');
  }
  else if (!options || !options.token) {
    throw new Error('Loggly Customer token is required.');
  }

  this.name   = 'loggly';
  this.tags   = options.tags || options.tag || options.id;
  this.client = loggly.createClient({
    subdomain: options.subdomain,
    auth: options.auth || null,
    json: options.json || false,
    token: options.token
  });

  if (this.tags && !Array.isArray(this.tags)) {
    this.tags = [this.tags];
  }
};

//
// Inherit from `winston.Transport`.
//
util.inherits(Loggly, winston.Transport);

//
// Define a getter so that `winston.transports.Loggly`
// is available and thus backwards compatible.
//
winston.transports.Loggly = Loggly;

//
// Expose the name of this Transport on the prototype
//
Loggly.prototype.name = 'loggly';

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
Loggly.prototype.log = function (level, msg, meta, callback) {
  if (this.silent) {
    return callback(null, true);
  }

  var message = winston.clone(meta || {}),
      tags    = this.tags || meta.tags,
      self    = this;

  message.level = level;
  message.message = msg;

  //
  // Helper function for responded to logging.
  //
  function logged() {
    self.emit('logged');
    callback(null, true);
  }

  return tags
    ? this.client.log(message, tags, logged)
    : this.client.log(message, logged);
};

//
// ### function stream (options)
// #### @options {Object} Set stream options
// Returns a log stream.
//
Loggly.prototype.stream = function(options) {
  var self = this,
      options = options || {},
      stream = new Stream,
      last,
      start = options.start,
      row = 0;

  if (start === -1) {
    start = null;
  }

  if (start == null) {
    last = new Date(0).toISOString();
  }

  stream.destroy = function() {
    this.destroyed = true;
  };

  // Unfortunately, we
  // need to poll here.
  (function check() {
    self.query({
      from: last || 'NOW-1DAY',
      until: 'NOW'
    }, function(err, results) {
      if (stream.destroyed) return;

      if (err) {
        stream.emit('error', err);
        return setTimeout(check, 2000);
      }

      var result = res[res.length-1];
      if (result && result.timestamp) {
        if (last == null) {
          last = result.timestamp;
          return;
        }
        last = result.timestamp;
      } else {
        return func();
      }

      results.forEach(function(log) {
        if (start == null || row > start) {
          stream.emit('log', log);
        }
        row++;
      });

      setTimeout(check, 2000);
    });
  })();

  return stream;
};

//
// ### function query (options)
// #### @options {Object} Set stream options
// #### @callback {function} Callback
// Query the transport.
//

Loggly.prototype.query = function (options, callback) {
  var self = this,
      context = this.extractContext(options);
      options = this.loglify(options);
      options = this.extend(options, context);

  this.client
    .search(options)
    .run(function (err, logs) {
      return err
        ? callback(err)
        : callback(null, self.sanitizeLogs(logs));
    });
};

//
// ### function formatQuery (query)
// #### @query {string|Object} Query to format
// Formats the specified `query` Object (or string) to conform
// with the underlying implementation of this transport.
//
Loggly.prototype.formatQuery = function (query) {
  return query;
};

//
// ### function formatResults (results, options)
// #### @results {Object|Array} Results returned from `.query`.
// #### @options {Object} **Optional** Formatting options
// Formats the specified `results` with the given `options` accordinging
// to the implementation of this transport.
//
Loggly.prototype.formatResults = function (results, options) {
  return results;
};

//
// ### function extractContext (obj)
// #### @obj {Object} Options has to extract Loggly 'context' properties from
// Returns a separate object containing all Loggly 'context properties in
// the object supplied and removes those properties from the original object.
// [See Loggly Search API](http://wiki.loggly.com/retrieve_events#optional)
//
Loggly.prototype.extractContext = function (obj) {
  var context = {};

  
   ['start',
   'from',
   'until',
   'order',
   'callback',
   'size',
   'format',
   'fields'].forEach(function (key) {
    if (obj[key]) {
      context[key] = obj[key];
      delete obj[key];
    }
  });

  context = this.normalizeQuery(context);
  context.from = context.from.toISOString();
  context.until = context.until.toISOString();

  context.from  = context.from  || '-1d';
  context.until = context.until || 'now';
  context.size  = context.size  || 50;

  return context;
};


//
// ### function loglify (obj)
// #### @obj {Object} Search query to convert into an `AND` loggly query.
// Creates an `AND` joined loggly query for the specified object
//
// e.g. `{ foo: 1, bar: 2 }` => `json.foo:1 AND json.bar:2`
//
Loggly.prototype.loglify = function (obj) {
  var opts = [];

  Object.keys(obj).forEach(function (key) {
    if (key !== 'query') {
        if (key == 'tag') {
          opts.push(key + ':' + obj[key]);
        }
        else {
          opts.push('json.' + key + ':' + obj[key]);
       }
    }
  });

  if (obj.query) {
    opts.unshift(obj.query);
  }
  return  {'query' : opts.join(' AND ')}
};

//
// ### function sanitizeLogs (logs)
// #### @logs {Object} Data returned from Loggly to sanitize
// Sanitizes the log information returned from Loggly so that
// users cannot gain access to critical information such as:
//
// 1. IP Addresses
// 2. Input names
// 3. Input IDs
//
Loggly.prototype.sanitizeLogs = function (logs) {
  return logs;
};

Loggly.prototype.extend = function(destination,source) {
    for (var property in source)
        destination[property] = source[property];
    return destination;
}
