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
var wincmd = require('node-windows'); // Windows utilities. https://github.com/coreybutler/node-windows

var BaseModel = require('./baseModel.js').BaseModel;

// Initialize and manage the various loggers.
exports.Logging = BaseModel.extend({

	// See readme.md for all this.
	defaults: {

		// Settings for the file logger.
		file: {
			enabled: true, // false to turn off
			filename: "logs/server.log", // Path to the log file, relative to server.js.
			maxsize: 1048576, // The max size of the log file before rolling over (1MB default)
			json: false, // Whether to log in JSON format.
			level: "info" // The logging level to write: info, warn, error.
		},

		// Settings for the console logger.
		console: {
			enabled: true, // false to turn off
			colorize: true, // Colors are fun.
			timestamp: true, // Include timestamps.
			level: "info" // The logging level to write: info, warn, error.
		},

		// Settings for the Windows event logger.
		eventLog: {
			eventSource: 'ampm',
			enabled: true // Whether to log Windows events at all.
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

		// Settings for loggly.com.
		loggly: {
			enabled: true, // false to turn off
			subdomain: "stimulant", // The account name. https://stimulant.loggly.com/dashboards
			inputToken: "b8eeee6e-12f4-4f2f-b6b4-62f087ad795e", // The API token.
			json: true, // Whether to log as JSON -- this should be true.
			token: "b8eeee6e-12f4-4f2f-b6b4-62f087ad795e", // The um, other token.
			tags: "ampm" // A tag to differentiate app logs from one another in loggly.
		},

		// Settings for the email logger.
		mail: {
			enabled: true, // false to turn off
			host: "mail.content.stimulant.io", // The SMTP server to use.
			ssl: false, // Whether to use SSL.
			username: "ampm@content.stimulant.io", // The account to log in with.
			from: "ampm@content.stimulant.io", // Where the emails should appear to be from.
			password: "JPv5U9N6", // The password to log in with.
			subject: "ERROR: {hostname}", // The subject of the emails. "{hostname}" is replaced by the output of os.hostname().
			level: "error", // The logging level to write: info, warn, error.
			to: "josh@stimulant.io" // Where the emails should go.
		},

		cacheAmount: 20, // How many lines of logs and events to show in the web console.

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

	// The Google Analytics client.
	_google: null,

	// A console window used for the event viewer logger.
	_eventSourceConsole: null,

	initialize: function() {
		BaseModel.prototype.initialize.apply(this);
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

			this.get('file').timestamp = function() {
				return moment().format('YYYY-MM-DD HH:mm:ss');
			};

			logger.add(winston.transports.DailyRotateFile, this.get('file'));
		}

		// Set up email.
		if (this.get('mail').enabled) {
			this.get('mail').subject = this.get('mail').subject ? this.get('mail').subject.replace('{hostname}', os.hostname()) : os.hostname();
			logger.add(require('winston-mail').Mail, this.get('mail'));
		}

		// Set up loggly.
		if (this.get('loggly').enabled) {
			var opts = this.get('loggly');
			opts.tags = opts.tags ? [opts.tags] : [];
			opts.tags.push(os.hostname());
			logger.add(require('winston-loggly').Loggly, opts);
		}

		// Set up Windows event log. Sort of hacky. Piggy-back on the console logger and log to the event log whenever it does.
		if (this.get('eventLog').enabled) {
			this.registerEventSource();
			logger.on('logging', _.bind(function(transport, level, msg, meta) {
				if (transport.name == 'console') {
					level = this._winstonLevelToWindowsLevel[level];
					this.writeEventLog(level, msg, meta);
				}
			}, this));
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
		data.level = this._appLevelToWinstonLevel[data.level];
		if (logger && logger[data.level]) {
			logger[data.level](data.message);
		}
	},

	_logEvent: function(data) {
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
	},

	// Register a Windows event source.
	registerEventSource: function(callback) {
		var source = this.get('eventLog').eventSource;
		var key = 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentcontrolSet\\Services\\EventLog\\Application\\' + source;
		child_process.exec('REG QUERY ' + key, _.bind(function(error, stdout, stderr) {
			if (!error) {
				this._eventSourceConsole = child_process.spawn('cmd.exe');
				this._eventSourceReady = true;
				return;
			}

			var cmd = 'EVENTCREATE /L APPLICATION /T Information /SO "' + source + '" /ID 1000 /D "Set up event source."';
			wincmd.elevate(cmd, null, _.bind(function(error, stdout, stderr) {
				if (!error) {
					this._eventSourceConsole = child_process.spawn('cmd.exe');
					this._eventSourceReady = true;
				}

				if (callback) {
					callback(error, stdout, stderr);
				}
			}, this));
		}, this));
	},

	// Log a message to the Windows event log.
	writeEventLog: function(level, msg, meta, callback) {
		if (!this._eventSourceReady || !msg || !level) {
			return;
		}

		msg = msg.trim();
		level = level.trim();
		if (!msg || !level) {
			return;
		}

		if (meta) {
			meta = JSON.stringify(meta);
			if (meta != '{}') {
				msg += ' ' + meta;
			}
		}

		var source = this.get('eventLog').eventSource;
		var cmd = 'EVENTCREATE /L APPLICATION /T ' + level + ' /SO "' + source + '" /ID 1000 /D "' + msg + '"';
		this._eventSourceConsole.stdin.write(cmd + '\n');
	}
});
