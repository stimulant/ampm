var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var _open = require('open'); // Open URLs. https://github.com/pwnall/node-open

var ServerState = require('./model/serverState.js').ServerState;

process.chdir(path.dirname(process.mainModule.filename));

// args will be ['node', 'server.js', 'config.json']
configFile = '';
if (process.argv.length > 2) {
    configFile = process.argv[2];
}

global.app = null;
global.comm = {};

function start() {
    global.config = configFile && fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile)) : {};
    console.log('Server starting up.');

    if (global['serverState']) {
        global.serverState.clean();
    }

    global.serverState = new ServerState(config.server);
    serverState.start();
    logger.info('Server started.');
    console.log('Press enter to open web console.');
}

start();

// Restart when config file changes.
if (configFile) {
    var restartTimeout = -1;
    fs.watch(configFile, {}, function(e, filename) {
        clearTimeout(restartTimeout);
        restartTimeout = setTimeout(function() {
            serverState.get('persistence').shutdownApp(start);
        }, 1000);
    });
}

// Press enter to open web console.
process.stdin.on('data', function() {
    _open('http://localhost:' + serverState.get('network').get('socketToConsolePort'));
});