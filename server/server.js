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
serverState.start();

/*
Content Updater
    Update from non-web location
    Log updates

App Updater
    Update from non-web location
    Log updates

Logger
    https://github.com/flatiron/winston
    https://github.com/jfromaniello/winston-winlog
    http://jfromaniello.github.io/windowseventlogjs/
    http://www.loggly.com/
    
    Log server events
        to event log
        to loggly
        to email for critical

    Log app events
        from app directly to event log
        from app directly to loggly
        from app to server over websocket
            pass these to master
            from master to event log
            from master to loggly (flagged differently)

    http://msdn.microsoft.com/en-us/library/system.net.websockets.websocket(v=vs.110).aspx

Demo App
    crash
    hang
    more/less fps
    more/less memory
    log (info/warn/critical)
    share state

Console
    Localhost console shows local client, master console shows all clients
        List of clients in config file, or use auto-discovery?
    Output
        Number of clients
        Is client running
        Memory/CPU usage 
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