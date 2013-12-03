var os = require('os'); // http://nodejs.org/api/os.html
var dns = require('dns'); // http://nodejs.org/api/dns.html
var path = require('path'); //http://nodejs.org/api/path.html

var express = require('express'); // Routing framework. http://expressjs.com/
var ioServer = require('socket.io'); // Web socket implementation. http://socket.io/
var ioClient = require('socket.io-client'); // Web socket implementation. http://socket.io/
var http = require('http'); // HTTP support. http://nodejs.org/api/http.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var osc = require('node-osc'); // OSC server. https://github.com/TheAlphaNerd/node-osc
var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/

global.sources = {
    master: 1,
    client: 2,
    app: 3
};

global.constants = {
    configPath: './config.json',
    network: {
        consolePort: 3000,
        appSendPort: 3004,
        socketLogLevel: 2
    }
};

global.comm = {};

global.config = JSON.parse(fs.readFileSync(constants.configPath));

// Set up web server for console.
global.app = express();
comm.webServer = http.createServer(app).listen(constants.network.consolePort);
app.use('/static', express.static(__dirname + '/view'));
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

// Set up socket connection to console.
comm.toConsole = ioServer.listen(comm.webServer).set('log level', constants.network.socketLogLevel);

// Set up OSC connection from app.
comm.fromApp = new osc.Server(constants.network.appSendPort);
comm.fromApp.on('message', function(message, info) {
    handleOsc(comm.fromApp, sources.app, sources.client, message, info);
});

// Generic handler to decode and re-post OSC messages as native events.
function handleOsc(transport, from, to, message, info) {
    message = message[0];
    var decoded = decodeOsc(message);
    transport.emit(decoded.type, decoded);
}

// /event/hostname/{data}
function decodeOsc(message) {
    if (!decodeOsc.emptyFilter) {
        decodeOsc.emptyFilter = function(part) {
            return part;
        };
    }

    var parts = message.split('/');
    parts = _.filter(parts, decodeOsc.emptyFilter);

    var type = parts.shift();
    var hostname = parts.shift();
    var data = parts.shift();
    if (data) {
        try {
            data = JSON.parse(data);
        } catch (error) {
            console.log(error);
        }
    }

    return {
        hostname: hostname,
        type: type,
        data: data
    };
}

// Set up models, which also starts the app if needed.
var ServerState = require('./model/serverState.js').ServerState;
global.serverState = new ServerState(config.server);

/*

Content Updater
    Update from non-web location
    Log updates

App Updater
    Update from non-web location
    Log updates

Persistence
    Don't allow app to run outside of its schedule
    https://github.com/bunkat/later/issues/31

Logger
    Log on request from client
        Low-pri logs are kept in memory, only written on crash.
    Email on critical state
    Forward to master if there is one
    Analytics service?

Console
    Localhost console shows local client, master console shows all clients
        List of clients in config file, or use auto-discovery?
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

State manager
    Runs on master only
    App sends state to master over OSC on interval
    Server sends state to apps over OSC on interval
    State is just a JS object
    App sends config to clients over socket on interval
        On config, write to file and restart app with new config

Run as service? https://npmjs.org/package/node-windows
*/

/*
// Some global config stuff that will probably never change.
global.constants = {
    mode: null,
    configPath: './config.json',
    network: {
        consolePort: 3000,
        masterReceivePort: 3001,
        masterSendPort: 3002,
        appReceivePort: 3003,
        appSendPort: 3004,
        socketLogLevel: 2
    }
};

global.modes = {
    master: 1,
    client: 2,
    standalone: 3,
    app: 4
};

// Servers and clients are stored here.
global.comm = {};
/*
var ExhibitState = require('./model/exhibitState.js').ExhibitState;
global.exhibitState = new ExhibitState();

// Load config file.
function loadConfig() {
    try {
        var isFirstConfig = _.isUndefined(global.lastConfig);

        global.lastConfig = fs.readFileSync(constants.configPath, {
            encoding: 'utf8'
        });

        global.config = JSON.parse(lastConfig);
        console.log('Config loaded.');

        if (isFirstConfig) {
            setupComm();
        }

        // Watch the config file for changes.
        fs.unwatchFile(constants.configPath);
        fs.watchFile(constants.configPath, function(curr, prev) {
            loadConfig();
        });

        if (isMaster) {
            clearInterval(global.sendConfigInterval);
            sendConfigInterval = setInterval(function() {
                //                comm.fromMaster.sockets.emit('config', config);
            }, config.network.updateConfigInterval);
        }
        if (!isMaster) {
            // TODO: Start app.
        }

    } catch (error) {
        console.log('Error loading config file.');
        console.log(error);
        if (!global.config) {
            process.exit(1);
        }
    }
}

// When a new config comes in, write it to disk and the file watcher will cause it to be read again.
function onConfig(message) {
    var newConfig = JSON.stringify(message, null, 4);
    if (newConfig == lastConfig) {
        return;
    }

    console.log('Got new config from master.');

    //if (!isMaster) 
    {
        // TODO: Shut down app.
    }

    fs.writeFile(constants.configPath, newConfig, function(error) {
        if (error) {
            console.log('Error writing configuration from master.');
        }
    });
}

loadConfig();

function setupComm() {
    global.comm = {};
    if (config.network.master) {
        if (config.network.master.toUpperCase() == os.hostname().toUpperCase()) {
            constants.mode = modes.master;
            comm.fromClients = new osc.Server(constants.network.masterReceivePort);
            comm.fromClients.on('message', function(message, info) {
                handleOsc(modes.client, modes.master, message, info);
            });
            comm.toClients = {};
        } else {
            constants.mode = modes.client;
            comm.toMaster = new osc.Client(config.network.master, constants.network.masterReceivePort);
            comm.fromMaster = new osc.Server(constants.network.masterSendPort);
            comm.fromMaster.on('message', function(message, info) {
                handleOsc(modes.master, modes.client, message, info);
            });
        }
    } else {
        constants.mode = modes.standalone;
    }

    if (constants.mode == modes.standalone || constants.mode == modes.client) {
        comm.toApp = new osc.Client(os.hostname(), constants.network.appReceivePort);
        comm.fromApp = new osc.Server(constants.network.appSendPort);
        comm.fromApp.on('message', function(message, info) {
            handleOsc(modes.app, modes.client, message, info);
        });
    }

    for (var mode in modes) {
        if (modes[mode] == constants.mode) {
            console.log('mode: ' + mode);
            break;
        }
    }

    global.comm.timeouts = {};
}

function handleOsc(from, to, message, info) {
    message = message[0];
    var decoded = decodeOsc(message);
    switch (decoded.type) {
        case 'heart':
            processHeart(from, to, decoded, message, info);
            if (constants.mode == modes.client) {
                comm.toMaster.send(message);
            }

            break;

        case 'getState':
            if (from == modes.app) {
                if (to == modes.client) {
                    comm.toMaster.send(message);
                } else if (to == modes.standalone) {
                    processGetState(from, to, decoded, message, info);
                }
            } else if (from == modes.client && to == modes.master) {
                processGetState(from, to, decoded, message, info);
            }

            break;

        case 'state':
            if (from == modes.master && to == modes.client) {
                processState(from, to, decoded, message, info);
            }

            break;

        case 'setState':
            if (from == modes.app) {
                if (constants.mode == modes.client) {
                    comm.toMaster.send(message);
                    comm.toMaster.send('/getState/' + os.hostname());
                } else if (to == modes.standalone) {
                    processSetState(from, to, decoded, message, info);
                }
            } else if (from == modes.client && to == modes.master) {
                processSetState(from, to, decoded, message, info);
            }

            break;

        case 'log':
            processLog(from, to, decoded, message, info);
            if (to == modes.client) {
                comm.toMaster.send(message);
            }

            break;
    }

    if (constants.mode == modes.master) {
        // Reset the timer for client timeouts.
        resetIdleClient(decoded.hostname);
    } else if (constants.mode == modes.standalone && from == modes.master) {
        // The master went away, but came back.
        console.log('Master came back.');
        constants.mode = modes.client;
    } else if (from == modes.master) {
        // Reset the timer for master timeouts.
        resetIdleMaster();
    }
}

function resetIdleMaster() {
    return;
    var timeout = comm.timeouts[config.network.master];
    if (!timeout) {
        timeout = comm.timeouts[config.network.master] = {
            id: 0,
            callback: onIdleMaster
        };
    }

    clearTimeout(timeout.id);
    timeout.id = setTimeout(timeout.callback, config.persistence.forgetAfter);
}

function onIdleMaster() {
    console.log('Master went away.');
    constants.mode = modes.standalone;
}

// Set a timer to clean up clients after they've gone idle.
function resetIdleClient(hostname) {
    var timeout = comm.timeouts[hostname];
    if (!timeout) {
        timeout = comm.timeouts[hostname] = {
            id: 0,
            callback: function() {
                onIdleClient(hostname);
            }
        };
    }

    clearTimeout(timeout.id);
    timeout.id = setTimeout(timeout.callback, config.persistence.forgetAfter);
}

// When a client goes away, clean up any resources.
function onIdleClient(hostname) {
    console.log(hostname + ' went away.');
    delete comm.toClients[hostname];
    exhibitState.updateAppState(hostname, null);
}

// /event/hostname/{data}
function decodeOsc(message) {
    if (!decodeOsc.emptyFilter) {
        decodeOsc.emptyFilter = function(part) {
            return part;
        };
    }

    var parts = message.split('/');
    parts = _.filter(parts, decodeOsc.emptyFilter);

    var type = parts.shift();
    var hostname = parts.shift();
    var data = parts.shift();
    if (data) {
        try {
            data = JSON.parse(data);
        } catch (error) {
            console.log(error);
        }
    }

    return {
        hostname: hostname,
        type: type,
        data: data
    };
}

function processHeart(from, to, decoded, message, info) {
    exhibitState.updateHeart(decoded.hostname);
}

// Send a "state" message to whoever asked for it.
function processGetState(from, to, decoded, message, info) {
    // console.log('getState ' + decoded.hostname + ' ' + os.hostname());
    var msg = "/state/" + os.hostname() + "/" + JSON.stringify(exhibitState.xport());
    getOscClient(decoded.hostname).send(msg);
}

// Process state updates from the UI.
function processSetState(from, to, decoded, message, info) {
    // console.log('setState ' + decoded.hostname + ' ' + os.hostname());
    exhibitState.updateAppState(decoded.hostname, decoded.data);
}

// Process state from the master and pass it back to the app.
function processState(from, to, decoded, message, info) {
    // console.log('state ' + decoded.hostname + ' ' + os.hostname());
    exhibitState.mport(decoded.data);
    var msg = "/state/" + os.hostname() + "/" + JSON.stringify(exhibitState.xport());
    comm.toApp.send(msg);
}

// Process log messages.
function processLog(from, to, decoded, message, info) {

}

function getOscClient(hostname) {
    var client = comm.toClients[hostname];
    if (!client) {
        client = comm.toClients[hostname] = new osc.Client(hostname, constants.network.masterSendPort);
    }

    return client;
}

/*
// Set up web server for console.
global.app = express();
comm.webServer = http.createServer(app).listen(constants.network.consolePort);
app.use('/static', express.static(__dirname + '/view'));
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

// Set up socket connection to console.
comm.toConsole = ioServer.listen(comm.webServer).set('log level', constants.network.socketLogLevel);

// Get the network addresses used by this machine -- used to determine which client is local.
var interfaces = os.networkInterfaces();
for (var network in interfaces) {
    for (var i = 0; i < interfaces[network].length; i++) {
        constants.addresses.push(interfaces[network][i].address);
    }
}


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
    return;
    shutdownClient(startClient);
}

// Set up models.
var ServerState = require('./model/serverState.js').ServerState;
var serverState = new ServerState();

var AppState = require('./model/appState.js').AppState;
var appState = new AppState();
*/