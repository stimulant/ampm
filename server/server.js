var express = require('express'); // Routing framework. http://expressjs.com/
var http = require('http'); // HTTP support. http://nodejs.org/api/http.html
var io = require('socket.io'); // Socket support for UI. http://socket.io/
var app = express();

var server = http.createServer(app);
io.listen(server);
server.listen(3000);

///// Support multiple clients
// Each client connects with a config, including its network path for updating content

///// Updater
// Add app to content, unzip
// Support to update from non-web location

///// App controller
// Monitor process
// Restart on hang
// Give up restart after n times

///// Server
// Schedule content update (shut down before, restart after)
// Schedule shutdown/restart
// Run as service? https://npmjs.org/package/node-windows

///// Logger
// Server listens to events from updater/controller and sends those to logger
// Logger listens on a port for log messages

///// Monitor
// Monitor listens on a port for monitor messages
// Revisit ICE for patterns

///// UI
// shut down / start (toggle)
// update (show progress)
// Display monitor status
// Display recent logs
// Memory/CPU usage https://github.com/markitondemand/node-perfmon

///// Central UI
// Forward all messages to another instance of server?
// UI displays all inputs at once?
// Send commands (shutdown etc) back to clients?

///// Plugin for custom app logic
// Short term -- some generic class with spots for custom code?
// Long term -- define a set of properties/types/intervals to keep in sync across clients.

// Load config file.
var config = require('./config.js').config;
var ContentUpdater = require('./contentUpdater.js').ContentUpdater;

var contentUpdater = new ContentUpdater({
    config: config
});

contentUpdater.update(function(error) {
    if (error) {
        console.log(error);
        throw error;
    }

    console.log('Update complete! ' + contentUpdater.get('updated').toString());
});

app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

/*
io.sockets.on('connection', function(socket) {
    socket.emit('news', {
        hello: 'woddrld'
    });
    socket.on('my other event', function(data) {
        console.log(data);
    });
});
*/
