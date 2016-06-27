#! /usr/bin/env node

var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var os = require('os'); // http://nodejs.org/api/os.html
var _ = require('lodash'); // Utilities. http://underscorejs.org/
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var json = require('comment-json'); // https://www.npmjs.com/package/comment-json

var ConsoleState = require('./model/consoleState.js').ConsoleState;
var BaseModel = require('./model/baseModel.js').BaseModel;
var Network = require('./model/network.js').Network;
var Persistence = require('./model/persistence.js').Persistence;
var ServerState = require('./model/serverState.js').ServerState;
var Logging = require('./model/logging.js').Logging;

global.$$config = {};

// args will be ['node', 'server.js', 'ampm.json', 'dev.i14']
var configPath = '';
var configPaths = process.argv[2] ? process.argv[2].split(',') : ['ampm.json'];
var configScheme = process.argv[3] ? process.argv[3] : '';

// A persistent state object, saved to ampm-state.json.
global.$$serverState = new ServerState();

// load from server state if config is stored
if (global.$$serverState.get('config')) {
    configPath = $$serverState.get('config');
} else {
    configPath = configPaths[0];
}

if (configPath && fs.existsSync(configPath)) {
    var config = fs.readFileSync(configPath, {
        encoding: 'UTF8'
    });

    // replace environment variables in the config file with their contents
    process.env['CD'] = process.cwd(); // jshint ignore:line
    config = config.replace(/%([^%]+)%/g, function(_, n) {
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

    // Set the current working directory to the location of the config file,
    // so that paths in the config file are relative to itself.
    process.chdir(path.dirname(configPath));
}

console.log('Server starting up.');

// Load the shared state plugin file.
global.$$plugin = null;
if ($$config.plugin && fs.existsSync($$config.plugin)) {
    var plugin = require(path.resolve($$config.plugin)).Plugin;
    global.$$plugin = new plugin();
}

// A container for all the network transports, generally accessed via $$network.transports.
global.$$network = new Network({
    config: $$config.network
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
if ($$plugin) {
    $$plugin.boot();
}

logger.info('Server started.');
console.log('Console is at: http://' + os.hostname() + ':' + $$network.get('socketToConsolePort'));
console.log(JSON.stringify($$consoleState.fullConfig(), null, 2));