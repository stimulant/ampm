var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var winston = require('winston'); // Logging. https://github.com/flatiron/winston

process.chdir(path.dirname(process.mainModule.filename));

// TEMP while this is fixed: https://github.com/remy/nodemon/issues/264
global.configPath = '..\\ampm-test\\WPF-test\\config.json';

// args will be ['node', 'server.js', 'config.json']
if (process.argv.length > 2) {
    global.configPath = process.argv[2];
}

global.app = null;
global.comm = {};
global.restarting = false;

function start() {
    global.config = fs.existsSync(global.configPath) ? JSON.parse(fs.readFileSync(global.configPath)) : {};
    console.log('Server starting up.');
    var ServerState = require('./model/serverState.js').ServerState;
    global.serverState = new ServerState(config.server);
    serverState.start();
    logger.info('Server started.');
    restarting = false;
}

start();

// Restart when config file changes.
if (global.configPath) {
    fs.watch(global.configPath, {}, function(e, filename) {
        if (restarting) {
            return;
        }
        restarting = true;
        serverState.get('persistence').shutdownApp(start);
    });
}

/*
Misc
    Provide a way to turn off logs -- current solution doesn't actually work
    Offline Google Analytics -- save events when offline, send when online
    Press a key in console window to bring up dashboard
    Press a key in app to bring up dashboard
    Shutdown/startup buttons
    Change restartAppAfter to seconds
    Make startup schedule do restarts
    Add a tag property for loggly config to differentiate installs.
    Simplify config -- add "config" property to models and recursively copy from that to attributes
    There is an "unzipping app" message even if the app isn't new

Content Updater
    Backup current app/content to .old folders before beginning
    "Rollback" button to bring back .old
    Multiple remotes -- live and test data.

Demo App
    share state

Console
    Localhost console shows local client, master console shows all clients
        List of clients in config file, or use auto-discovery?
    Output
        Number of clients
        CPU temperature? http://ipmiutil.sourceforge.net/
        Display arbitrary amount of state per client (like ICE)
    Input
        Kill running client
        Kill all running clients
        Start dead client
        Start all clients
        Restart client
        Restart all clients
        Update content on all clients: kill process, update content, update client, restart client
        Config editor
        Push config to all clients

State manager
    Runs on master only
    App sends state to master over OSC on interval
    Server sends state to apps over OSC on interval
    State is just a JS object
    Server sends config to clients over socket on interval - or socket?
        On config, write to file and restart app with new config

Run as service? https://npmjs.org/package/node-windows
*/