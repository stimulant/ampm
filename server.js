var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var os = require('os'); // http://nodejs.org/api/os.html

var ServerState = require('./model/serverState.js').ServerState;
var stateFile = 'state.json';

process.chdir(path.dirname(process.mainModule.filename));

// args will be ['node', 'server.js', 'config.json']
configFile = '';
if (process.argv.length > 2) {
    configFile = process.argv[2];
}

global.app = null;
global.comm = {};

// Save a value to the serialized state file.
global.saveState = function(key, value) {
    if (savedState[key] === value) {
        return;
    }

    savedState[key] = value;
    clearTimeout(saveState.writeTimeout);
    saveState.writeTimeout = setTimeout(function() {
        fs.writeFile(stateFile, JSON.stringify(savedState, null, '\t'));
    }, 1000);
};

function start() {
    global.config = configFile && fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile)) : {};
    global.savedState = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : {};

    console.log('Server starting up.');

    if (global.serverState) {
        global.serverState.clean();
    }

    global.serverState = new ServerState(config.server);
    serverState.start(config);
    logger.info('Server started.');
    console.log('Console is at: http://' + os.hostname() + ':' + serverState.get('network').get('socketToConsolePort'));
}

start();

// Restart when config file changes.
if (configFile) {
    var restartTimeout = -1;
    fs.watch(configFile, {}, function(e, filename) {
        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(function() {
            if (serverState.get('appState').get('isRunning')) {
                serverState.get('persistence').shutdownApp(start);
            } else {
                start();
            }
        }, 1000);
    });
}