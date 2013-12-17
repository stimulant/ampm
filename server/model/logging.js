var os = require('os'); // http://nodejs.org/api/os.html
var path = require('path'); //http://nodejs.org/api/path.html

var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

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

		eventLog: {
			// The Windows log needs title-case events.
			levels: {
				debug: 'Information',
				info: 'Information',
				warning: 'Warning',
				error: 'Error'
			}
		},

		google: {
			accountId: 'UA-46432303-2',
			userId: '3e582629-7aad-4aa3-90f2-9f7cb3f89597'
		},

		mail: {
			host: 'smtp.gmail.com',
			ssl: true,
			username: 'google@stimulant.io',
			password: 'google_p455!',
			subject: 'ERROR: ' + os.hostname(),
			level: 'error',
			to: 'josh@stimulant.io'
		}
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
			var EventLog = require('windows-eventlog').EventLog;
			loggers.eventLog = new EventLog('ampm-server', 'ampm-server');
			loggers.console.on('logging', _.bind(function(transport, level, msg, meta) {
				if (transport.name == 'console') {
					loggers.eventLog.log(msg, this.get('eventLog').levels[level]);
				}
			}, this));
		}

		// Set up Windows event log. Sort of hacky. Piggy-back on the console logger and log to Google log whenever it does.
		if (loggers.console && this.get('google')) {
			var ua = require('universal-analytics');
			loggers.google = ua(this.get('google').accountId, this.get('google').userId);
			loggers.console.on('logging', _.bind(function(transport, level, msg, meta) {
				loggers.google.event('log', msg, level).send();
			}, this));
		}

		comm.socketToApp.sockets.on('connection', _.bind(function(socket) {

			// Log on request from the app.
			socket.on('log', _.bind(function(data) {
				for (var level in this.get('eventLog').levels) {
					if (this.get('eventLog').levels[level] == data.level) {
						data.level = level;
					}
				}

				if (winston && winston[data.level]) {
					winston[data.level](data.message);
				}
			}, this));

			// Track events on request from the app.
			socket.on('event', _.bind(function(data) {
				loggers.google.event(data.Category, data.Action, data.Label, data.Value).send();
			}, this));
		}, this));
	}
});