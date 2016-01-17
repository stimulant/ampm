var os = require('os'); // http://nodejs.org/api/os.html
var path = require('path'); //http://nodejs.org/api/path.html
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var util = require('util'); // http://nodejs.org/api/util.html

var moment = require('moment'); // Date processing. http://momentjs.com/
var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var ua = require('universal-analytics'); // Google Analytics. https://npmjs.org/package/universal-analytics

var BaseModel = require('./baseModel.js').BaseModel;

// Initialize and manage the various loggers.
exports.Logging = BaseModel.extend({

    // See readme.md for all this.
    defaults: {

        // Settings for the file logger.
        file: {
            enabled: true, // false to turn off
            filename: "logs/server", // Path to the log file, relative to server.js.
            maxsize: 1048576, // The max size of the log file before rolling over (1MB default)
            json: false, // Whether to log in JSON format.
            level: "info", // The logging level to write: info, warn, error.,
            datePattern: ".yyyy-MM-dd.log"
        },

        // Settings for the console logger.
        console: {
            enabled: true, // false to turn off
            colorize: true, // Colors are fun.
            timestamp: true, // Include timestamps.
            level: "info" // The logging level to write: info, warn, error.
        },

        // Settings for Google Analytics.
        google: {
            enabled: true, // false to turn off
            accountId: "UA-46432303-2", // The property ID -- this should be unique per project
        },

        // Settings for the event log file.
        eventFile: {
            enabled: true, // false to turn off
            filename: "logs/event-{date}.tsv" // Path to the log file, relative to server.js. {date} will be replaced by the current date.
        },

        // Settings for screenshots taken after crashes.
        screenshots: {
            enabled: true, // false to turn off
            filename: "logs/capture-{date}.jpg" // Path to save screen shots, relative to server.js. {date} will be replaced by the current date.
        },

        // Settings for loggly.com.
        loggly: {
            enabled: false, // false to turn off
            subdomain: "", // The account name. https://stimulant.loggly.com/dashboards
            inputToken: "", // The API token.
            json: true, // Whether to log as JSON -- this should be true.
            token: "", // The um, other token.
            tags: "ampm" // A tag to differentiate app logs from one another in loggly.
        },

        // Settings for the email logger.
        mail: {
            enabled: false, // false to turn off
            ssl: false, // Whether to use SSL.
            subject: "ERROR: {hostname}", // The subject of the emails. "{hostname}" is replaced by the output of os.hostname().
            level: "error", // The logging level to write: info, warn, error.
            host: "", // The SMTP server to use.
            username: "", // The account to log in with.
            from: "", // Where the emails should appear to be from.
            password: "", // The password to log in with.
            to: "" // Where the emails should go.
        },

        cacheAmount: 20, // How many lines of logs and events to show in the web console.

        // Cache of the last n log messages, sent to console.
        logCache: null,

        // Cache of the last n GA events, sent to console.
        eventCache: null,
    },

    // The Google Analytics client.
    _google: null,

    // A console window used for the event viewer logger.
    _eventSourceConsole: null,

    initialize: function() {
        BaseModel.prototype.initialize.apply(this);
        global.logger = new winston.Logger({
            exitOnError: $$persistence.get('exitOnError')
        });

        // Set up console logger.
        if (this.get('console').enabled) {
            this.get('console').handleExceptions = !$$persistence.get('exitOnError');
            logger.add(winston.transports.Console, this.get('console'));
        }

        // Set up file logger.
        if (this.get('file').enabled) {
            // Create the log file folder.
            var dir = path.dirname(this.get('file').filename);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

            this.get('file').timestamp = function() {
                return moment().format('YYYY-MM-DD HH:mm:ss');
            };

            this.get('file').handleExceptions = !$$persistence.get('exitOnError');
            logger.add(require('winston-daily-rotate-file'), this.get('file'));
        }

        // Set up email.
        if (this.get('mail').enabled) {
            var subject = this.get('mail').subject;
            if (subject) {
                subject = subject.replace('{hostname}', os.hostname());
            } else {
                subject = os.hostname();
            }

            function deepFind(obj, path) {
                var paths = path.split('.');
                var current = obj;
                var i;

                for (i = 0; i < paths.length; ++i) {
                    if (current[paths[i]] === undefined) {
                        return undefined;
                    } else {
                        current = current[paths[i]];
                    }
                }
                return current;
            }

            subject = subject.replace(/\{([^\}]+)\}/g, function(mustache, param) {
                var configProp = deepFind($$config, param);
                return configProp === undefined ? mustache : configProp;
            });

            this.get('mail').subject = subject;
            logger.add(require('winston-mail').Mail, this.get('mail'));
        }

        // Set up loggly.
        if (this.get('loggly').enabled) {
            var opts = this.get('loggly');
            opts.tags = opts.tags ? [opts.tags] : [];
            opts.tags.push(os.hostname());
            logger.add(require('winston-loggly').Loggly, opts);
        }

        // Set up Google Analytics. 
        if (this.get('google').enabled) {
            this._google = ua(this.get('google').accountId, os.hostname(), {
                strictCidFormat: false
            });
        }

        // Set up the cache, which is just a history of log messages.
        if (this.get('cacheAmount')) {
            this.set('logCache', []);
            this.set('eventCache', []);
            logger.on('logging', _.bind(function(transport, level, msg, meta) {
                if (transport.name == 'console') {
                    var cache = this.get('logCache');
                    cache.push({
                        time: moment().format('YYYY-MM-DD HH:mm:ss'),
                        level: level,
                        msg: msg
                    });
                    if (cache.length > this.get('cacheAmount')) {
                        cache.splice(0, cache.length - this.get('cacheAmount'));
                    }
                    if ($$network.transports.socketToConsole) {
                        $$network.transports.socketToConsole.emit('log', cache[cache.length - 1]);
                    }
                }
            }, this));
        }

        $$network.transports.socketToApp.sockets.on('connection', _.bind(function(socket) {
            // Log on request from the app.
            socket.on('log', _.bind(this._logMessage, this));
            // Track events on request from the app.
            socket.on('event', _.bind(this._logEvent, this));
        }, this));

        // Log on request from the app.
        $$network.transports.oscFromApp.on('log', _.bind(this._logMessage, this));
        // Track events on request from the app.
        $$network.transports.oscFromApp.on('event', _.bind(this._logEvent, this));
    },

    _logMessage: function(data) {
        if (logger && logger[data.level]) {
            logger[data.level](data.message);
        }
    },

    _logEvent: function(data) {
        var cache = this.get('eventCache');
        cache.push({
            time: moment().format('YYYY-MM-DD HH:mm:ss'),
            data: data
        });
        if (cache.length > this.get('cacheAmount')) {
            cache.splice(0, cache.length - this.get('cacheAmount'));
        }

        if (this._google) {
            // Log to Google Analytics.
            this._google.event(data.Category, data.Action, data.Label, data.Value);
            var queue = _.clone(this._google._queue);
            this._google.send(_.bind(function(error) {
                if (!error) {
                    return;
                }

                if (error.code === 'ENOTFOUND') {
                    // Couldn't connect -- replace the queue and try next time.
                    // https://github.com/peaksandpies/universal-analytics/issues/12
                    this._google._queue = queue;
                } else {
                    // Something else bad happened.
                    logger.warn('Error with Google Analytics', error);
                }
            }, this));
        }

        if (this.get('eventFile').enabled && this.get('eventFile').filename) {
            var dir = path.dirname(this.get('eventFile').filename);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir);
            }

            // Log to the event log file.
            var date = new Date();
            var datestring = date.getFullYear() + '-';
            var month = date.getMonth() + 1;
            if (month < 10) {
                month = '0' + month;
            }
            datestring += month + '-';
            var day = date.getDate();
            if (day < 10) {
                day = '0' + day;
            }
            datestring += day;

            var fileName = this.get('eventFile').filename.replace('{date}', datestring);
            var timestamp = Math.round(date.getTime() / 1000);
            var log = util.format('%d\t%s\t%s\t%s\t%d\n', timestamp, data.Category || '', data.Action || '', data.Label || '', data.Value || 0);
            fs.appendFile(fileName, log);
        }
    }
});
