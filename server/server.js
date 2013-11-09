var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

server.listen(3000);

///// Support multiple clients
// Each client connects with a config, including its network path for updating content

///// Updater
// save to temp folder and then copy over
// update currently loading file(s?), progress of each, total progress, complete event
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

// Load config file.
var config = require('./config.js').config;
var Updater = require('./updater.js').Updater;

var updater = new Updater({
    config: config
});

updater.update();

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
