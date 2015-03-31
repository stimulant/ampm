var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var os = require('os'); // http://nodejs.org/api/os.html
var _ = require('lodash'); // Utilities. http://underscorejs.org/
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html

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
var configPath = '';
var configPaths = process.argv[2].split(',');
var configScheme = process.argv[3];

// A persistent state object, saved to state.json.
global.$$serverState = new ServerState();

// load from server state if config is stored
if (global.$$serverState.get('config')) {
	configPath = $$serverState.get('config');
} else if (process.argv.length > 2) {
	configPath = configPaths[0];
}

if (configPath && fs.existsSync(configPath)) {
	var config = fs.readFileSync(configPath, {encoding:'UTF8'});

	// replace environment variables in the config file with their contents
    config = config.replace(/%([^%]+)%/g, function(_,n) {
    	// also escape slashes
        return (process.env[n] + '').replace(/[\\"']/g, '\\$&').replace(/[\\"']/g, '\\$&');
    });
	config = JSON.parse(config);

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

// Start up components which depend on other components.
$$persistence.boot();
if ($$sharedState) {
	$$sharedState.boot();
}

// Start up the cursor manager and set the default cursor state.
child_process.spawn('tools/AutoHotKey.exe', ['tools/cursor.ahk'], {
	detached: true
}).unref();
setTimeout(_.bind($$persistence.updateHideCursor, $$persistence), 1000);

logger.info('Server started.');
console.log('Console is at: http://' + os.hostname() + ':' + $$network.get('socketToConsolePort'));
console.log($$config);
