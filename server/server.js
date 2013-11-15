var express = require('express'); // Routing framework. http://expressjs.com/
var http = require('http'); // HTTP support. http://nodejs.org/api/http.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var osc = require('node-osc'); // OSC server. https://github.com/TheAlphaNerd/node-osc
var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/

// Load config file.
try {
    global.config = JSON.parse(fs.readFileSync('./config.json'));
} catch (error) {
    console.log("Couldn't load config file.");
    console.log(error);
    process.exit(1);
}

// Set up server.
var app = express();
var server = http.createServer(app);
global.io = require('socket.io').listen(server);
io.set('log level', 2);
server.listen(3000);

// A cache of OSC clients for each app instance.
var oscSenders = {};

// Set up OSC server to receive messages from app.
global.oscReceive = new osc.Server(3001);
oscReceive.on('message', function(msg, info) {
    // Convert OSC messages to objects and emit them similar to sockets.
    var parts = msg[0].substr(1).split('/');
    var action = parts.shift();

    var message = {};
    while (parts.length) {
        var key = parts.shift();
        var val = parts.shift();
        var f = parseFloat(val);
        message[key] = isNaN(f) ? val : f;
    }

    // Build a client if needed.
    var sender = oscSenders[info.address];
    if (!sender) {
        sender = oscSenders[info.address] = new osc.Client(info.address, 3002);
    }

    oscReceive.emit(action, message, sender);
});

// Set up view routing.
app.use('/static', express.static(__dirname + '/view'));
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

// Set up models.
var ServerState = require('./model/serverState.js').ServerState;
var serverState = new ServerState();

var AppState = require('./model/appState.js').AppState;
var appState = new AppState();

// Update clients with server state when they ask for it, throttled to 60 FPS.
var throttle = 1000 / 60;

io.sockets.on('connection', function(socket) {
    socket.on('getServerState', function(message) {
        if (socket.throttled) {
            return;
        }

        socket.emit('serverState', serverState.xport());
        socket.throttled = true;
        setTimeout(function() {
            socket.throttled = false;
        });
    });

    socket.on('getAppState', function(message) {
        if (socket.throttled) {
            return;
        }

        socket.emit('appState', appState.xport());
        socket.throttled = true;
        setTimeout(function() {
            socket.throttled = false;
        }, throttle);
    });
});

oscReceive.on('getAppState', function(message, sender) {
    if (sender.throttled) {
        return;
    }

    sender.send('/appState/' + JSON.stringify(appState.xport()));
    sender.throttled = true;
    setTimeout(function() {
        sender.throttled = false;
    }, throttle);
});

oscReceive.on('getServerState', function(message, sender) {
    if (sender.throttled) {
        return;
    }

    sender.send('/serverState/' + JSON.stringify(serverState.xport()));
    sender.throttled = true;
    setTimeout(function() {
        sender.throttled = false;
    }, throttle);
});

/*
Client
    Stop ignoring local updates when master disappears
    Better sample -- each client has its own state, but reflects state of others

Server
    Logging
        Log content updates
        Log on request from client
        Email on critical state
        Analytics service?
    Scheduling
        Schedule content update
        Schedule shutdown, startup, restart
    Persistence
        Monitor uptime
        Restart on hang/crash
        Give up restart after n times
    Reduce message payload size
    Run as service? https://npmjs.org/package/node-windows

Console
    Output
        Number of clients
        Is client running
        Memory/CPU usage https://github.com/markitondemand/node-perfmon
        Recent logs
        Display arbitrary amount of state per client (like ICE)
    Input
        Kill running client
        Kill all running clients
        Start dead client
        Start all clients
        Restart client
        Restart all clients
        Update content on client: kill process, update content, update client, restart client
        Update content on all clients: kill process, update content, update client, restart client
        Update master server
        Update client servers
*/