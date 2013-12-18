var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var winston = require('winston'); // Logging. https://github.com/flatiron/winston

global.constants = {
    configPath: './config.json'
};

global.app = null;
global.comm = {};
global.loggers = {};
global.config = JSON.parse(fs.readFileSync(constants.configPath));

winston.info('Server starting up.');
var ServerState = require('./model/serverState.js').ServerState;
global.serverState = new ServerState(config.server);
serverState.start();
winston.info('Server started.');

/*
What happens if the app/content isn't even there?

Demo App
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
        CPU temperature? http://arstechnica.com/civis/viewtopic.php?f=15&p=22433263
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