var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var os = require('os'); // http://nodejs.org/api/os.html
var _ = require('lodash'); // Utilities. http://underscorejs.org/

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

global.$$config = {};

// args will be ['node', 'server.js', 'config.json', 'dev.i14']
var configPaths = '';
var configScheme = '';

if (process.argv.length > 2) {
	configPaths = process.argv[2].split(',');
	configScheme = process.argv[3];
}

if (configPaths && fs.existsSync(configPaths[0])) {
	var config = JSON.parse(fs.readFileSync(configPaths[0]));
	if (!config['default']) {
		// There are no schemes in the config, just ingest it whole.
		console.log('Using single configuration.');
		_.merge($$config, config);
	} else {
		// Merge the default config.
		console.log('Merging config: default');
		_.merge($$config, config['default']);
		var schemes = configScheme.split('.');
		var currentScheme = '';

		// Merge the schemes passed on the command line.
		// "dev.foo" would merge "dev" then "dev.foo" then "dev.foo".
		for (var i = 0; i < schemes.length; i++) {
			currentScheme += schemes[i];
			console.log('Merging config: ' + currentScheme);
			_.merge($$config, config[currentScheme]);
			currentScheme += '.';
		}

		// Merge machine-specific schemes.
		// "I14" would merge "I14", then "I14.dev", then "I14.dev.foo".
		var machine = os.hostname();
		console.log('Merging config: ' + machine);
		_.merge($$config, config[machine]);

		currentScheme = '';
		for (var i = 0; i < schemes.length; i++) {
			currentScheme += schemes[i];
			console.log('Merging config: ' + machine + '.' + currentScheme);
			_.merge($$config, config[machine + '.' + currentScheme]);
			currentScheme += '.';
		}
	}
}

console.log('Server starting up.');

// Load the shared state plugin file.
global.$$sharedState = null;
if ($$config.sharedState && fs.existsSync($$config.sharedState)) {
	var SharedState = require($$config.sharedState).SharedState;
	global.$$sharedState = new SharedState();
}

// A container for all the network transports, generally accessed via $$network.transports.
global.$$network = new Network({
	config: $$config.network
});

// A persistent state object, saved to state.json.
global.$$serverState = new ServerState();

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
global.$$consoleState = new ConsoleState({
	configs: configPaths
});

$$persistence.boot();
if ($$sharedState) {
	$$sharedState.boot();
}

logger.info('Server started.');
console.log('Console is at: http://' + os.hostname() + ':' + $$network.get('socketToConsolePort'));