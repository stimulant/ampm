var os = require('os'); // http://nodejs.org/api/os.html
var path = require('path'); //http://nodejs.org/api/path.html
var http = require('http'); // HTTP support. http://nodejs.org/api/http.html

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var express = require('express'); // Routing framework. http://expressjs.com/
var osc = require('node-osc'); // OSC server. https://github.com/TheAlphaNerd/node-osc
var ioServer = require('socket.io'); // Web socket implementation. http://socket.io/
var ioClient = require('socket.io-client'); // Web socket implementation. http://socket.io/

var BaseModel = require('./baseModel.js').BaseModel;

exports.Network = BaseModel.extend({
	defaults: {
		socketToConsolePort: 3000,
		socketToAppPort: 3001,
		oscFromAppPort: 3004,
		oscToAppPort: 3005,
		socketLogLevel: 2
	},

	initialize: function() {
		BaseModel.prototype.initialize.apply(this);

		// Set up web server for console.
		global.app = express();
		comm.webServer = http.createServer(app).listen(this.get('socketToConsolePort'));
		app.use('/static', express.static(path.resolve(__dirname + '/../view')));
		app.get('/', function(req, res) {
			res.sendfile(path.resolve(__dirname + '/../view/index.html'));
		});

		// Set up socket connection to console.
		comm.socketToConsole = ioServer.listen(comm.webServer)
			.set('log level', this.get('socketLogLevel'));

		// Set up OSC connection from app.
		comm.oscFromApp = new osc.Server(this.get('oscFromAppPort'));
		comm.oscFromApp.on('message', _.bind(function(message, info) {
			this._handleOsc(comm.oscFromApp, message, info);
		}, this));

		// Set up OSC connection to app.
		comm.oscToApp = new osc.Client(this.get('oscToAppPort'));

		// Set up socket connection to app.
		comm.socketToApp = ioServer.listen(this.get('socketToAppPort'))
			.set('log level', this.get('socketLogLevel'));
	},

	// Generic handler to decode and re-post OSC messages as native events.
	_handleOsc: function(transport, message, info) {
		if (message.length == 1) {
			// Simple format from WPF
			message = message[0];
		} else {
			// Bundled format from Cinder
			message = message[2][0];
		}
		var decoded = this._decodeOsc(message);
		transport.emit(decoded.type, decoded);
	},

	// /event/hostname/{data}
	_decodeOsc: function(message) {
		if (!this._decodeOsc.emptyFilter) {
			this._decodeOsc.emptyFilter = function(part) {
				return part;
			};
		}

		var parts = message.split('/');
		parts = _.filter(parts, this._decodeOsc.emptyFilter);

		var type = parts.shift();
		var hostname = parts.shift();
		var data = parts.shift();
		if (data) {
			try {
				data = JSON.parse(data);
			} catch (error) {
				logger.warn('Bad OSC message from app.', error);
			}
		}

		return {
			hostname: hostname,
			type: type,
			data: data
		};
	}
});