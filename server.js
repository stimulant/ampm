var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var os = require('os'); // http://nodejs.org/api/os.html

var ConsoleState = require('./model/consoleState.js').ConsoleState;
var BaseModel = require('./model/baseModel.js').BaseModel;
var Network = require('./model/network.js').Network;
var ContentUpdater = require('./model/contentUpdater.js').ContentUpdater;
var AppUpdater = require('./model/appUpdater.js').AppUpdater;
var Persistence = require('./model/persistence.js').Persistence;
var AppState = require('./model/appState.js').AppState;
var ServerState = require('./model/serverState.js').ServerState;
var Logging = require('./model/logging.js').Logging;

var stateFile = 'state.json';

// Set the current working directory to the location of server.js so it's always consistent.
process.chdir(path.dirname(process.mainModule.filename));

// args will be ['node', 'server.js', 'config.json']
var configFile = '';
if (process.argv.length > 2) {
	configFile = process.argv[2];
}

console.log('Server starting up.');

global.config = configFile && fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile)) : {};

global.serverState = new ServerState(fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : {});

global.network = new Network({
	config: config.network
});

global.contentUpdater = new ContentUpdater({
	name: 'content',
	config: config.contentUpdater
});

global.appUpdater = new AppUpdater({
	name: 'app',
	config: config.appUpdater
});

global.persistence = new Persistence({
	config: config.persistence
});

global.logging = new Logging({
	config: config.logging
});

global.appState = new AppState({
	config: config.app
});

global.consoleState = new ConsoleState();

logger.info('Server started.');
console.log('Console is at: http://' + os.hostname() + ':' + network.get('socketToConsolePort'));
