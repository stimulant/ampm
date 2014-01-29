var os = require('os'); // http://nodejs.org/api/os.html
var path = require('path'); //http://nodejs.org/api/path.html
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var ua = require('universal-analytics'); // Google Analytics. https://npmjs.org/package/universal-analytics
var wincmd = require('node-windows'); // Windows utilities. https://github.com/coreybutler/node-windows

var BaseModel = require('./baseModel.js').BaseModel;

exports.Logging = BaseModel.extend({
	defaults: {
		console: {
			enabled: true,
			colorize: true,
			timestamp: true,
			level: 'info'
		},

		file: {
			enabled: true,
			filename: 'logs/server.log',
			maxsize: 1024 * 1024, // 1MB
			json: false,
			level: 'info'
		},

		eventLog: {
			enabled: true,
			eventSource: 'ampmserver'
		},

		google: {
			enabled: true,
			accountId: 'UA-46432303-2',
			userId: '3e582629-7aad-4aa3-90f2-9f7cb3f89597'
		},

		loggly: {
			enabled: true,
			subdomain: 'stimulant', // https://stimulant.loggly.com/dashboards
			inputToken: 'b8eeee6e-12f4-4f2f-b6b4-62f087ad795e',
			json: true,
			tags: 'ampm'
		},

		mail: {
			enabled: true,
			host: 'mail.content.stimulant.io',
			ssl: false,
			username: 'ampm@content.stimulant.io',
			from: 'ampm@content.stimulant.io',
			password: 'JPv5U9N6',
			subject: 'ERROR: {hostname}',
			level: 'error',
			to: 'josh@stimulant.io'
		},

		// How many log/event messages to show on the console.
		cacheAmount: 20,

		// Cache of the last n log messages, sent to console.
		logCache: null,

		// Cache of the last n GA events, sent to console.
		eventCache: null,
	},

	// Whether the windows event source has been initialized.
	_eventSourceReady: false,

	// Mappings from the Winston levels to what Event Viewer wants.
	_winstonLevelToWindowsLevel: {
		info: 'Information',
		warn: 'Warning',
		error: 'Error'
	},

	// Mappings from MS.Diagnostics.Tracing.EventLevel to the Winston levels.
	_appLevelToWinstonLevel: {
		Informational: 'info',
		Warning: 'warn',
		Error: 'error'
	},

	_google: null,

	initialize: function() {
		global.logger = new winston.Logger();

		logger.setLevels({
			info: 0,
			warn: 1,
			error: 2
		});

		winston.addColors({
			info: 'green',
			warn: 'yellow',
			error: 'red'
		});

		// Set up console logger.
		if (this.get('console').enabled) {
			logger.add(winston.transports.Console, this.get('console'));
		}

		// Set up file logger.
		if (this.get('file').enabled) {
			// Create the log file folder.
			var dir = path.dirname(this.get('file').filename);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir);
			}

			logger.add(winston.transports.DailyRotateFile, this.get('file'));
		}

		// Set up email.
		if (this.get('mail').enabled) {
			this.get('mail').subject = this.get('mail').subject ? this.get('mail').subject.replace('{hostname}', os.hostname()) : os.hostname();
			logger.add(require('winston-mail').Mail, this.get('mail'));
		}

		// Set up loggly.
		if (this.get('loggly').enabled) {
			logger.add(require('winston-loggly').Loggly, this.get('loggly'));
		}

		// Set up Windows event log. Sort of hacky. Piggy-back on the console logger and log to the event log whenever it does.
		if (this.get('eventLog').enabled) {
			this.initEventLog();
			logger.on('logging', _.bind(function(transport, level, msg, meta) {
				if (transport.name == 'console') {
					level = this._winstonLevelToWindowsLevel[level];
					this.eventLog(level, msg, meta);
				}
			}, this));
		}

		// Set up Google Analytics. Sort of hacky. Piggy-back on the console logger and log to Google log whenever it does.
		if (this.get('google').enabled) {
			this._google = ua(this.get('google').accountId, this.get('google').userId);
		}

		// Set up the cache, which is just a history of log messages.
		if (this.get('cacheAmount')) {
			this.set('logCache', []);
			this.set('eventCache', []);
			logger.on('logging', _.bind(function(transport, level, msg, meta) {
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
				if (logger && logger[data.level]) {
					logger[data.level](data.message);
				}
			}, this));

			// Track events on request from the app.
			socket.on('event', _.bind(function(data) {
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
			}, this));
		}, this));
	},

	clean: function() {
		if (global.logger) {
			logger.removeAllListeners('logging');
		}
	},

	// Register a Windows event source.
	initEventLog: function(callback) {
		var source = this.get('eventLog').eventSource;
		var key = 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentcontrolSet\\Services\\EventLog\\Application\\' + source;
		child_process.exec('REG QUERY ' + key, _.bind(function(error, stdout, stderr) {
			if (!error) {
				this._eventSourceReady = true;
				return;
			}

			var cmd = 'EVENTCREATE /L APPLICATION /T Information /SO "' + source + '" /ID 1000 /D "Set up event source."';
			wincmd.elevate(cmd, null, _.bind(function(error, stdout, stderr) {
				if (callback) {
					callback(error, stdout, stderr);
				}
			}, this));
		}, this));
	},

	// Log a message to the Windows event log.
	eventLog: function(level, msg, meta, callback) {
		if (!this._eventSourceReady || !msg) {
			return;
		}

		msg = msg.trim();
		if (!msg) {
			return;
		}

		var source = this.get('eventLog').eventSource;
		var cmd = 'EVENTCREATE /L APPLICATION /T ' + level + ' /SO "' + source + '" /ID 1000 /D "' + msg + '"';
		child_process.exec(cmd, _.bind(function(error, stdout, stderr) {
			if (callback) {
				callback(error, stdout, stderr);
			}
		}, this));
	}
});