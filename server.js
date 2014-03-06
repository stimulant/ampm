var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var os = require('os'); // http://nodejs.org/api/os.html

var ConsoleState = require('./model/consoleState.js').ConsoleState;
var BaseModel = require('./model/baseModel.js').BaseModel;
var Network = require('./model/network.js').Network;
var ContentUpdater = require('./model/contentUpdater.js').ContentUpdater;
var AppUpdater = require('./model/appUpdater.js').AppUpdater;
var Persistence = require('./model/persistence.js').Persistence;
var ServerState = require('./model/serverState.js').ServerState;
var Logging = require('./model/logging.js').Logging;

// Set the current working directory to the location of server.js so it's always consistent.
process.chdir(path.dirname(process.mainModule.filename));

// args will be ['node', 'server.js', 'config.json']
var configPath = '';
if (process.argv.length > 2) {
	configPath = process.argv[2];
}

console.log('Server starting up.');

// Parse the config file that was passed as an argument and make a global reference to it.
global.$$config = configPath && fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath)) : {};

// A persistent state object, saved to state.json.
global.$$serverState = new ServerState();

// A container for all the network transports, generally accessed via $$network.transports.
global.$$network = new Network({
	config: $$config.network
});

// The updater which downloads content referenced by an XML file or local/network file path.
global.$$contentUpdater = new ContentUpdater({
	name: 'content',
	config: $$config.contentUpdater
});

// The updater which downloads a zip file and decompresses it.
global.$$appUpdater = new AppUpdater({
	name: 'app',
	config: $$config.appUpdater
});

// The manager of the application process, controlling restarts and heartbeats.
global.$$persistence = new Persistence({
	config: $$config.persistence
});

// The logging manager.
global.$$logging = new Logging({
	config: $$config.logging
});

// The back-end for the web console.
global.consoleState = new ConsoleState();

logger.info('Server started.');
console.log('Console is at: http://' + os.hostname() + ':' + $$network.get('socketToConsolePort'));
