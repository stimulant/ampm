var child_process = require('child_process'); // http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
var os = require('os'); // http://nodejs.org/api/os.html
var dns = require('dns'); // http://nodejs.org/api/dns.html
var path = require('path'); //http://nodejs.org/api/path.html

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

// Some global config stuff that will probably never change.
config.server = {
    socketPort: 3000,
    oscReceivePort: 3001,
    oscSendPort: 3002,
    updateThrotle: 1 / 60,
    killClientsAfter: 5000,
    clientProcessName: 'client.exe',
    addresses: []
};

// Get the network addresses used by this machine -- used to determine which client is local.
var interfaces = os.networkInterfaces();
for (var network in interfaces) {
    for (var i = 0; i < interfaces[network].length; i++) {
        config.server.addresses.push(interfaces[network][i].address);
    }
}

// Set up server.
var app = express();
var server = http.createServer(app);
global.io = require('socket.io').listen(server);
io.set('log level', 2);
server.listen(config.server.socketPort);

// A cache of OSC clients for each app instance.
var oscSenders = {};

// console.log(os.hostname());

// Set up OSC server to receive messages from app.
global.oscReceive = new osc.Server(config.server.oscReceivePort);
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
        sender = oscSenders[info.address] = new osc.Client(info.address, config.server.oscSendPort);
        sender.isLocal = config.server.addresses.indexOf(sender.host) != -1;
        sender.killFunction = function() {
            delete oscSenders[sender.host];

            if (sender.isLocal) {
                restartClient();
            }
        };
    }

    // Kill the OSC client if we haven't heard from it in a while.
    clearTimeout(sender.killTimeout);
    sender.killTimeout = setTimeout(sender.killFunction, config.server.killClientsAfter);

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
io.sockets.on('connection', function(socket) {
    socket.on('getServerState', function(message) {
        if (socket.throttled) {
            return;
        }

        socket.emit('serverState', serverState.xport());
        socket.throttled = true;
        setTimeout(function() {
            socket.throttled = false;
        }, config.server.updateThrottle);
    });

    socket.on('getAppState', function(message) {
        if (socket.throttled) {
            return;
        }

        socket.emit('appState', appState.xport());
        socket.throttled = true;
        setTimeout(function() {
            socket.throttled = false;
        }, config.server.updateThrottle);
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
    }, config.server.updateThrottle);
});

oscReceive.on('getServerState', function(message, sender) {
    if (sender.throttled) {
        return;
    }

    sender.send('/serverState/' + JSON.stringify(serverState.xport()));
    sender.throttled = true;
    setTimeout(function() {
        sender.throttled = false;
    }, config.server.updateThrottle);
});

function shutdownClient(callback) {
    var clientUpdater = serverState.get('clientUpdater');
    child_process.exec('taskkill /IM ' + clientUpdater.get('processName') + ' /F', function(error, stdout, stderr) {
        console.log(error ? 'Client went away.' : 'Client hung and got shut down.');
        if (callback) {
            callback();
        }
    });
}

function startClient() {
    var clientUpdater = serverState.get('clientUpdater');
    child_process.spawn(path.join(clientUpdater.get('local'), clientUpdater.get('processName')));
    console.log('Client started.');
}

function restartClient() {
    shutdownClient(startClient);
}

/*
Server
    Config
        Send config to all clients
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
        Give up restart after n times
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

Installer
    One-click of node and all dependencies
*/
