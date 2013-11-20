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

// Some global config stuff that will probably never change.
global.constants = {
    configPath: './config.json',
    addresses: [],
    network: {
        socketPort: 3000,
        oscReceivePort: 3001,
        oscSendPort: 3002
    }
};

// Get the network addresses used by this machine -- used to determine which client is local.
var interfaces = os.networkInterfaces();
for (var network in interfaces) {
    for (var i = 0; i < interfaces[network].length; i++) {
        constants.addresses.push(interfaces[network][i].address);
    }
}

// Load config file.
function loadConfig() {
    try {
        oldConfig = fs.readFileSync(constants.configPath, {
            encoding: 'utf8'
        });
        global.config = JSON.parse(oldConfig);
        console.log('Config loaded.');
    } catch (error) {
        if (!global.config) {
            console.log('Error loading config file.');
            console.log(error);
            process.exit(1);
        }
    }
}

loadConfig();

// Watch the config file for changes.
if (!config.network.master || config.network.master == os.hostname()) {
    fs.watch(constants.configPath, function(event, filename) {
        loadConfig();
    });
}

// Set up application server and socket server.
var app = express();
var server = http.createServer(app);
global.socketServer = require('socket.io').listen(server);
socketServer.set('log level', 2);
server.listen(constants.network.socketPort);

// Set up view routing.
app.use('/static', express.static(__dirname + '/view'));
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

// A cache of OSC clients for each app instance.
var oscSenders = {};

// Set up OSC server to receive messages from app.
global.oscReceive = new osc.Server(constants.network.oscReceivePort);
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
        sender = oscSenders[info.address] = new osc.Client(info.address, constants.network.oscSendPort);
        sender.isLocal = constants.addresses.indexOf(sender.host) != -1;
        sender.throttles = {};
        sender.killFunction = function() {
            delete oscSenders[sender.host];

            // Looks like the client is gone, restart it.
            if (sender.isLocal) {
                restartClient();
            }
        };
    }

    // Kill the OSC client if we haven't heard from it in a while.
    clearTimeout(sender.killTimeout);
    sender.killTimeout = setTimeout(sender.killFunction, config.persistence.forgetAfter);

    oscReceive.emit(action, message, sender);
});

// Send server state over OSC when requested.
oscReceive.on('getServerState', function(message, sender) {
    if (sender.throttles['getServerState']) {
        return;
    }

    sender.send('/serverState/' + JSON.stringify(serverState.xport()));
    sender.throttles['getServerState'] = true;
    setTimeout(function() {
        sender.throttles['getServerState'] = false;
    }, config.network.updateConfigThrottle);
});

// Send app state over OSC when requested.
oscReceive.on('getAppState', function(message, sender) {
    if (sender.throttles['getAppState']) {
        return;
    }

    sender.send('/appState/' + JSON.stringify(appState.xport()));
    sender.throttles['getAppState'] = true;
    setTimeout(function() {
        sender.throttles['getAppState'] = false;
    }, config.network.updateStateThrottle);
});

// Configure socket server.
// Update clients with server state when they ask for it, throttled to a reasonable amount.
socketServer.on('connection', function(socket) {
    socket.throttles = {};

    // Hook up getServerState method.
    socket.on('getServerState', function(message) {
        if (socket.throttles['getServerState']) {
            return;
        }

        socket.emit('serverState', serverState.xport());
        socket.throttles['getServerState'] = true;
        setTimeout(function() {
            socket.throttles['getServerState'] = false;
        }, config.network.updateStateThrottle);
    });

    // Hook up getAppState method.
    socket.on('getAppState', function(message) {
        if (socket.throttles['getAppState']) {
            return;
        }

        socket.emit('appState', appState.xport());
        socket.throttles['getAppState'] = true;
        setTimeout(function() {
            socket.throttles['getAppState'] = false;
        }, config.network.updateStateThrottle);
    });

    if (config.network.master == os.hostname()) {
        // Hook up getConfig method on the master.
        socket.on('getConfig', function(message) {
            if (socket.throttles['getConfig']) {
                return;
            }

            socket.emit('config', config);
            socket.throttles['getConfig'] = true;
            setTimeout(function() {
                socket.throttles['getConfig'] = false;
            }, config.network.updateConfigThrottle);
        });
    }
});

// On slaves, configure socket client.
if (config.network.master != os.hostname()) {
    global.socketClient = require('socket.io-client')
        .connect('http://' + config.network.master + ':' + constants.network.socketPort);

    // Hook up config update loop on slaves.
    var configUpdateInterval = null;
    socketClient.on('config', function(message) {
        clearInterval(configUpdateInterval);
        var newConfig = JSON.stringify(message, null, 4);
        if (newConfig != oldConfig) {
            console.log('Got new config from master.');
            global.config = config;
            oldConfig = newConfig;
            fs.writeFile('./config.json', newConfig, function(error) {
                if (error) {
                    console.log('Error writing configuration from master.');
                }
            });
        }

        configUpdateInterval = setInterval(function() {
            socketClient.emit('getConfig');
        }, config.network.updateConfigThrottle);
    });

    // Request config from master.
    socketClient.emit('getConfig');
}

function isClientRunning(callback) {
    if (!callback) {
        return;
    }

    var process = serverState.get('clientUpdater').get('processName').toUpperCase();
    child_process.exec('tasklist /FI "IMAGENAME eq ' + process + '"', function(error, stdout, stderr) {
        callback(stdout.toUpperCase().indexOf(process) != -1);
    });
}

function shutdownClient(callback) {
    // See if the client is running.
    isClientRunning(function(isRunning) {
        if (!isRunning) {
            // Nope, not running.
            if (callback) {
                callback();
            }

            return;
        }

        // Kill the client.
        var process = serverState.get('clientUpdater').get('processName').toUpperCase();
        child_process.exec('taskkill /IM ' + process + ' /F', function(error, stdout, stderr) {
            console.log('Client shut down by force.');
            if (callback) {
                callback();
            }
        });
    });
}

function startClient() {
    isClientRunning(function(isRunning) {
        if (isRunning) {
            // It's already running.
            return;
        }

        // Start the client.
        var clientUpdater = serverState.get('clientUpdater');
        var clientPath = path.join(clientUpdater.get('local'), clientUpdater.get('processName'));
        child_process.spawn(clientPath);
        console.log('Client started.');
    });
}

function restartClient() {
    shutdownClient(startClient);
}

// Set up models.
var ServerState = require('./model/serverState.js').ServerState;
var serverState = new ServerState();

var AppState = require('./model/appState.js').AppState;
var appState = new AppState();

/*
Content Updater
    Update from non-web location

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
