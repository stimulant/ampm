var path = require('path'); // https://nodejs.org/dist/latest-v4.x/docs/api/path.html
var fs = require('fs'); // https://nodejs.org/dist/latest-v4.x/docs/api/fs.html
var os = require('os'); // https://nodejs.org/dist/latest-v4.x/docs/api/os.html
var http = require('http'); // https://nodejs.org/dist/latest-v4.x/docs/api/http.html

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var express = require('express'); // Web app framework. http://expressjs.com/

exports.Plugin = Backbone.Model.extend({
	defaults: {
		x: 0,
		y: 0
	},

	boot: function() {

		// Set up a web server to serve the application.
		var webapp = express();
		var webserver = http.createServer(webapp);
		webserver.listen(8000);
		webapp.get('/', function(req, res) {
			res.sendFile(path.join(__dirname, '../index.html'));
		});
		webapp.use(express.static(path.join(__dirname, '../')));

		// Listen for TCP events from the app.
		$$network.transports.socketToApp.sockets.on('connection', _.bind(function(socket) {
			socket.on('mouse', _.bind(function(data) {
				this.set('x', data.x);
				this.set('y', data.y);
			}, this));
		}, this));

		// Listen for UDP events from the app.
		$$network.transports.oscFromApp.on('heart', _.bind(function(data) {
			// console.log(data);
		}, this));
	}
});
