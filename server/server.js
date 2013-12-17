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
var winston = require('winston'); // Logging. https://github.com/flatiron/winston

global.sources = {
    master: 1,
    client: 2,
    app: 3
};

global.constants = {
    configPath: './config.json',

    network: {
        socketToConsolePort: 3000,
        socketToAppPort: 3001,
        oscFromAppPort: 3004,
        oscToAppPort: 3005,
        socketLogLevel: 2
    },

    // Config for winston. Comment out or delete a transport to not use it.
    // https://github.com/flatiron/winston
    logging: {
        console: {
            colorize: true,
            timestamp: true,
            level: 'info'
        },
        file: {
            filename: '../logs/server.log',
            maxsize: 1024 * 1024, // 1MB
            json: false,
            level: 'info'
        },
        eventLog: {},
        google: {
            accountId: 'UA-46432303-2',
            userId: '3e582629-7aad-4aa3-90f2-9f7cb3f89597'
        },
        mail: {
            host: 'smtp.gmail.com',
            ssl: true,
            username: 'google@stimulant.io',
            password: 'google_p455!',
            subject: 'ERROR: ' + os.hostname(),
            level: 'error',
            to: 'josh@stimulant.io'
        }
    }
};

global.comm = {};

global.config = JSON.parse(fs.readFileSync(constants.configPath));

setupLogging();

// Set up web server for console.
global.app = express();
comm.webServer = http.createServer(app).listen(constants.network.socketToConsolePort);
app.use('/static', express.static(__dirname + '/view'));
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

// Set up socket connection to console.
comm.socketToConsole = ioServer.listen(comm.webServer)
    .set('log level', constants.network.socketLogLevel);

// Set up OSC connection from app.
comm.oscFromApp = new osc.Server(constants.network.oscFromAppPort);
comm.oscFromApp.on('message', function(message, info) {
    handleOsc(comm.oscFromApp, sources.app, sources.client, message, info);
});

// Set up OSC connection to app.
comm.oscToApp = new osc.Client(constants.network.oscToAppPort);

// Set up socket connection to app.
comm.socketToApp = ioServer.listen(constants.network.socketToAppPort)
    .set('log level', constants.network.socketLogLevel);
comm.socketToApp.sockets.on('connection', function(socket) {
    socket.on('log', function(data) {
        if (winston && winston[data.level]) {
            winston[data.level](data.message);
        }
    });
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
            winston.warning('Bad OSC message from app.', error);
        }
    }

    return {
        hostname: hostname,
        type: type,
        data: data
    };
}

function setupLogging() {
    // silly: 0, debug: 1, verbose: 2, info: 3, warn: 4, error: 5
    winston.setLevels({
        info: 0,
        warning: 1,
        error: 2
    });

    winston.addColors({
        info: 'green',
        warning: 'yellow',
        error: 'red'
    });

    // Set up console logger.
    var console = null;
    if (constants.logging.console) {
        winston.remove(winston.transports.Console);
        console = winston.add(winston.transports.Console, constants.logging.console);
    }

    // Set up file logger.
    var file = null;
    if (constants.logging.file) {
        // Create the log file folder.
        var dir = path.dirname(constants.logging.file.filename);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        file = winston.add(winston.transports.DailyRotateFile, constants.logging.file);
    }

    // Set up email. 
    var mail = null;
    if (constants.logging.mail) {
        mail = winston.add(require('winston-mail').Mail, constants.logging.mail);
    }

    // Set up Windows event log. Sort of hacky. Piggy-back on the console logger and log to the event log whenever it does.
    if (console && constants.logging.eventLog) {
        var EventLog = require('windows-eventlog').EventLog;
        console.eventLog = new EventLog('ampm-server', 'ampm-server');

        // The windows log needs title-case events.
        console.eventLog.winLevels = {
            debug: 'Information',
            info: 'Information',
            warning: 'Warning',
            error: 'Error'
        };

        console.on('logging', function(transport, level, msg, meta) {
            if (transport.name == 'console') {
                console.eventLog.log(msg, console.eventLog.winLevels[level]);
            }
        });
    }

    // Set up Windows event log. Sort of hacky. Piggy-back on the console logger and log to Google log whenever it does.
    if (console && constants.logging.google) {
        var ua = require('universal-analytics');
        console.ua = ua(constants.logging.google.accountId, constants.logging.google.userId);
        console.on('logging', function(transport, level, msg, meta) {
            console.ua.event('log', msg, level).send();
        });
    }
}

// Set up models, which also starts the app if needed.
var ServerState = require('./model/serverState.js').ServerState;
global.serverState = new ServerState(config.server);

winston.info('Server starting up.');
serverState.start();
winston.info('Server started.');



/*

Server
    Watch config file for changes.

Content Updater
    Update from non-web location
    Don't shut down app while downloading to temp

App Updater
    Update from non-web location
    Don't shut down app while downloading to temp

Logger
    Accept log messages from app via web socket // http://msdn.microsoft.com/en-us/library/system.net.websockets.websocket(v=vs.110).aspx
    Pass those log messages to google analytics // https://npmjs.org/package/universal-analytics

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
        Config editor

State manager
    Runs on master only
    App sends state to master over OSC on interval
    Server sends state to apps over OSC on interval
    State is just a JS object
    Server sends config to clients over socket on interval - or socket?
        On config, write to file and restart app with new config

Run as service? https://npmjs.org/package/node-windows
*/