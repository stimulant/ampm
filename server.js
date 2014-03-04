var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var os = require('os'); // http://nodejs.org/api/os.html

var ServerState = require('./model/serverState.js').ServerState;
var BaseModel = require('./model/baseModel.js').BaseModel;
var Network = require('./model/network.js').Network;
var ContentUpdater = require('./model/contentUpdater.js').ContentUpdater;
var AppUpdater = require('./model/appUpdater.js').AppUpdater;
var Persistence = require('./model/persistence.js').Persistence;
var AppState = require('./model/appState.js').AppState;
var Logging = require('./model/logging.js').Logging;

var stateFile = 'state.json';

// Set the current working directory to the location of server.js so it's always consistent.
process.chdir(path.dirname(process.mainModule.filename));

// args will be ['node', 'server.js', 'config.json']
var configFile = '';
if (process.argv.length > 2) {
	configFile = process.argv[2];
}

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

console.log('Server starting up.');

// Global reference to the express app.
global.app = null;

// Global reference to the network class, which contains the various clients and servers.
global.comm = {};

// Global reference to the config file, passed as an argument.
global.config = configFile && fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile)) : {};

// A state object which is persisted between sessions.
global.savedState = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : {};

// The main state object which contains instances of all the other model classes.
global.serverState = new ServerState(config.server);

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


serverState.start(config);

logger.info('Server started.');
console.log('Console is at: http://' + os.hostname() + ':' + network.get('socketToConsolePort'));
