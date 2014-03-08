var os = require('os'); // http://nodejs.org/api/os.html
var path = require('path'); //http://nodejs.org/api/path.html
var http = require('http'); // HTTP support. http://nodejs.org/api/http.html

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var express = require('express'); // Routing framework. http://expressjs.com/
var osc = require('node-osc'); // OSC server. https://github.com/TheAlphaNerd/node-osc
var ioServer = require('socket.io'); // Web socket implementation. http://socket.io/
var ioClient = require('socket.io-client'); // Web socket implementation. http://socket.io/

var BaseModel = require('./baseModel.js').BaseModel;

// Initialize and manage the various network transports.
exports.Network = BaseModel.extend({
	defaults: {
		// The port used to communicate between node and the browser. This is also the URL you'd use
		// to access the console, such as http://localhost:3000.
		socketToConsolePort: 81,

		// The port used to communicate between node and the client app over a TCP socket. This is
		// used for the app to send log messages and event tracking.
		socketToAppPort: 3001,

		// The port used to communicate from the client app to the server over UDP/OSC. This is used
		// to send heartbeat messages and syncronize state between clients. 
		oscFromAppPort: 3004,

		// The port used to communicate from the server to the client app over UDP/OSC. This is used
		// to syncronize state between clients. 
		oscToAppPort: 3005,

		oscToPeerPort: 3006,
		oscFromPeerPort: 3007,

		// How much socket.io logging you want to see in the console. Higher is more debug info. 
		socketLogLevel: 2,

		peers: null
	},

	transports: null,

	initialize: function() {
		BaseModel.prototype.initialize.apply(this);
		this.transports = {};

		// Set up web server for console.
		global.app = express();
		this.transports.webServer = http.createServer(app).listen(this.get('socketToConsolePort'));
		app.use('/static', express.static(path.resolve(__dirname + '/../view')));
		app.get('/', function(req, res) {
			res.sendfile(path.resolve(__dirname + '/../view/index.html'));
		});

		// Set up socket connection to console.
		this.transports.socketToConsole = ioServer.listen(this.transports.webServer)
			.set('log level', this.get('socketLogLevel'));

		// Set up OSC connection from app.
		this.transports.oscFromApp = new osc.Server(this.get('oscFromAppPort'));
		this.transports.oscFromApp.on('message', _.bind(function(message, info) {
			this._handleOsc(this.transports.oscFromApp, message, info);
		}, this));

		// Set up OSC connection to app.
		this.transports.oscToApp = new osc.Client('localhost', this.get('oscToAppPort'));

		// Set up socket connection to app.
		this.transports.socketToApp = ioServer.listen(this.get('socketToAppPort'))
			.set('log level', this.get('socketLogLevel'));

		// Set up a state-syncing connection to the next peer in the list.
		var peers = this.get('peers');
		if ($$sharedState && peers) {
			var myName = os.hostname().toLowerCase();
			var myIndex = -1;
			for (var i in peers) {
				peers[i] = peers[i].toLowerCase();
				if (peers[i] == myName) {
					myIndex = parseInt(i);
				}
			}

			if (myIndex != -1) {
				var peer = peers[myIndex + 1] ? peers[myIndex + 1] : peers[0];

				this.transports.oscToPeer = new osc.Client(peer, this.get('oscToPeerPort'));
				this.transports.oscFromPeer = new osc.Server(this.get('oscFromPeerPort'));

				this.transports.oscFromPeer.on('message', _.bind(function(message, info) {
					this._handleOsc(this.transports.oscFromPeer, message, info);
				}, this));

				this.transports.oscFromPeer.on('sharedStateRequest', _.bind(function(message) {
					this.transports.oscToPeer.send(JSON.stringify($$sharedState.attributes));
				}, this));
			}
		}
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
