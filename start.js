#! /usr/bin/env node

// Run ampm under nodemon. It watches changes to ampm-restart.json so that ampm
// can restart itself. It also restarts on crash.

// Really should be using nodemon as a module, but:
// https://github.com/stimulant/ampm/issues/12

var path = require('path');
var child_process = require('child_process');
var fs = require('fs');

var configFiles = process.argv[2] || 'ampm.json';
var configFile = path.resolve(configFiles.split(',')[0]);
var appPath = path.dirname(configFile);
var restartFile = path.join(appPath, 'ampm-restart.json');
var stateFile = path.join(appPath, 'ampm-state.json');
var mode = process.argv[3] || 'default';
var cmd = 'nodemon';
var server = path.join(__dirname, 'server.js');

if (process.platform === 'win32') {
    // Gotta go to great lengths to avoid spaces in the path.
    // https://github.com/nodejs/node-v0.x-archive/issues/25895
    cmd = child_process.execSync('where nodemon').toString().split('\n')[1].replace('Program Files', 'PROGRA~1').trim();
    server = child_process.execSync('where ampm').toString().split('\n')[1].replace('Program Files', 'PROGRA~1').trim();
    server = path.join(path.dirname(server), 'node_modules', 'ampm', 'server.js');
}

if (!fs.existsSync(restartFile)) {
    fs.writeFileSync(restartFile, '');
}
if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, '{}');
}

var args = [
    '--verbose',
    '--exitcrash',
    '--watch', configFile,
    '--watch', restartFile,
    '--ignore', 'logs',
    '--ignore', stateFile,
    server,
    configFiles,
    mode
];

// If there are arguments beyond the config file and mode, pass them to nodemon.
process.argv.slice(4).forEach(function(a, i) {
    args.splice(args.length - 3, 0, a);
});

function start() {
    var ampm = child_process.spawn(cmd, args, {
        stdio: 'inherit'
    });
    ampm.on('close', start);
}

start();
