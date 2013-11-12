var express = require('express'); // Routing framework. http://expressjs.com/
var http = require('http'); // HTTP support. http://nodejs.org/api/http.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var osc = require('node-osc'); // OSC server. https://github.com/TheAlphaNerd/node-osc

// Load config file.
try {
    var config = JSON.parse(fs.readFileSync('./config.json'));
} catch (error) {
    console.log("Couldn't load config file.");
    console.log(error);
}

// Load our server code.
var ContentUpdater = require('./contentUpdater.js').ContentUpdater;
var ClientUpdater = require('./clientUpdater.js').ClientUpdater;
var contentUpdater = new ContentUpdater(config.contentUpdater);
var clientUpdater = new ClientUpdater(config.clientUpdater);

// Set up server.
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
server.listen(3000);

// Set up view routing.
app.use("/static", express.static(__dirname + "/view"));
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

// Set up OSC routing.
var oscServer = new osc.Server(3001);
oscServer.on('message', function(msg, rinfo) {
    // Forward messages to the UI.
    var parts = msg[0].split('/');
    parts.shift();
    var action = parts[0];

    var message = {};
    while (parts.length) {
        var key = parts.shift();
        var val = parts.shift();
        var f = parseFloat(val);
        message[key] = isNaN(f) ? val : f;
    }

    io.sockets.emit(action, message);
});

///// Support multiple clients
// Each client connects with a config, including its network path for updating content

///// Updater
// Heartbeat
// Kill/start button
// Update button: kill process, update content, update client, restart client
// Update server
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

///// Analytics
// Hook into analytics service? Or log analysis tool?


function updateContent() {
    contentUpdater.update(function(error) {
        if (error) {
            console.log(error);
            throw error;
        }

        console.log('Content update complete! ' + contentUpdater.get('updated').toString());

        clientUpdater.update(function(error) {
            if (error) {
                console.log(error);
                throw error;
            }

            console.log('Client update complete! ' + clientUpdater.get('updated').toString());
        });
    });
}

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
