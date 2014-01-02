var os = require('os'); // http://nodejs.org/api/os.html
var path = require('path'); //http://nodejs.org/api/path.html

var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var ua = require('universal-analytics'); // Google Analytics. https://npmjs.org/package/universal-analytics
var EventLog = require('windows-eventlog').EventLog; // Windows Event Log. http://jfromaniello.github.io/windowseventlogjs/

var BaseModel = require('./baseModel.js').BaseModel;

exports.Logging = BaseModel.extend({
	defaults: {
		console: {
			colorize: true,
			timestamp: true,
			level: 'info'
		},

		file: {
			filename: '../logs/server.log',
			maxsize: 1024 * 1024, // 1MB
			json: false,
			level: 'info'
		},

		eventLog: {},

		google: {
			accountId: 'UA-46432303-2',
			userId: '3e582629-7aad-4aa3-90f2-9f7cb3f89597'
		},

		loggly: {
			subdomain: 'stimulant', // https://stimulant.loggly.com/dashboards
			inputToken: 'b8eeee6e-12f4-4f2f-b6b4-62f087ad795e',
			json: true
		},

		mail: {
			host: 'mail.content.stimulant.io',
			ssl: false,
			username: 'ampm@content.stimulant.io',
			from: 'ampm@content.stimulant.io',
			password: 'JPv5U9N6',
			subject: 'ERROR: ' + os.hostname(),
			level: 'error',
			to: 'josh@stimulant.io'
		},

		// Cache of the last n log messages, sent to console.
		logCache: null,
		// Cache of the last n GA events, sent to console.
		eventCache: null,
		cacheAmount: 20,
	},

	// Mappings from MS.Diagnostics.Tracing.EventLevel to the Winston levels.
	_appLevelToWinstonLevel: {
		Informational: 'info',
		Warning: 'warning',
		Error: 'error'
	},

	// Mappings from the Winston levels to what Event Viewer wants.
	_winstonLevelToWindowsLevel: {
		info: 'Information',
		warn: 'Warning',
		error: 'Error'
	},

	initialize: function() {
		winston.setLevels({
			info: 0,
			warning: 1,
			error: 2
		});

		winston.addColors({
			info: 'green',
			warning: 'yellow',
			error: 'red'
		});

		// Set up console logger.
		if (this.get('console')) {
			winston.remove(winston.transports.Console);
			loggers.console = winston.add(winston.transports.Console, this.get('console'));
		}

		// Set up file logger.
		if (this.get('file')) {
			// Create the log file folder.
			var dir = path.dirname(this.get('file').filename);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir);
			}

			loggers.file = winston.add(winston.transports.DailyRotateFile, this.get('file'));
		}

		// Set up email.
		if (this.get('mail')) {
			loggers.mail = winston.add(require('winston-mail').Mail, this.get('mail'));
		}

		// Set up Windows event log. Sort of hacky. Piggy-back on the console logger and log to the event log whenever it does.
		if (loggers.console && this.get('eventLog')) {
			loggers.eventLog = new EventLog('ampm-server', 'ampm-server');
			loggers.console.on('logging', _.bind(function(transport, level, msg, meta) {
				if (transport.name == 'console') {
					loggers.eventLog.log(msg, this._winstonLevelToWindowsLevel[level]);
				}
			}, this));
		}

		// Set up Google Analytics. Sort of hacky. Piggy-back on the console logger and log to Google log whenever it does.
		if (loggers.console && this.get('google')) {
			this.set('eventCache', []);
			loggers.google = ua(this.get('google').accountId, this.get('google').userId);
			/*
			// This is proving to not be very useful -- probably just want GA for actual events.
			loggers.console.on('logging', _.bind(function(transport, level, msg, meta) {
				loggers.google.event('log', msg, level).send();
			}, this));
			*/
		}

		// Set up loggly.
		if (loggers.console && this.get('loggly')) {
			winston.add(require('winston-loggly').Loggly, this.get('loggly'));
		}

		// Set up the cache, which is just a history of log messages.
		if (loggers.console && this.get('cacheAmount')) {
			this.set('logCache', []);
			loggers.console.on('logging', _.bind(function(transport, level, msg, meta) {
				if (transport.name == 'console') {
					var cache = this.get('logCache');
					cache.push({
						level: level,
						msg: msg
					});
					if (cache.length > this.get('cacheAmount')) {
						cache.splice(0, cache.length - this.get('cacheAmount'));
					}
				}
			}, this));
		}

		comm.socketToApp.sockets.on('connection', _.bind(function(socket) {

			// Log on request from the app.
			socket.on('log', _.bind(function(data) {
				data.level = this._appLevelToWinstonLevel[data.level];
				if (winston && winston[data.level]) {
					winston[data.level](data.message);
				}
			}, this));

			// Track events on request from the app.
			socket.on('event', _.bind(function(data) {
				loggers.google.event(data.Category, data.Action, data.Label, data.Value, _.bind(function(error) {
					if (error) {
						winston.warn('Error with Google Analytics', error);
						return;
					}

					// Cache events for the console.
					var cache = this.get('eventCache');
					cache.push({
						category: data.Category,
						action: data.Action,
						label: data.Label,
						value: data.Value
					});
					if (cache.length > this.get('cacheAmount')) {
						cache.splice(0, cache.length - this.get('cacheAmount'));
					}
				}, this)).send();
			}, this));
		}, this));
	}
});