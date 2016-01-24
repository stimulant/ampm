#! /usr/bin/env node

// Run ampm under nodemon. It watches changes to restart.json so that ampm
// can restart itself. It also restarts on crash.

// Really should be using nodemon as a module, but:
// https://github.com/stimulant/ampm/issues/12

var path = require('path');
var child_process = require('child_process');

var configFiles = process.argv[2];
var configFile = path.resolve(configFiles.split(',')[0]);
var appPath = path.dirname(configFile);
var restartFile = path.join(appPath, 'restart.json');
var stateFile = path.join(appPath, 'state.json');
var mode = process.argv[3];
var cmd = 'nodemon';
var server = path.join(__dirname, 'server.js');

if (process.platform === 'win32') {
    // Gotta go to great lengths to avoid spaces in the path.
    // https://github.com/nodejs/node-v0.x-archive/issues/25895
    cmd = process.env.SYSTEMDRIVE + '\\PROGRA~1\\nodejs\\nodemon.cmd';
    if (__dirname.indexOf('Program Files') !== -1) {
        server = process.env.SYSTEMDRIVE + '\\PROGRA~1\\nodejs\\node_modules\\ampm\\server.js';
    }
}

var args = [
    '--verbose',
    '--exitcrash',
    '--watch', configFile,
    '--watch', restartFile,
    '--watch', '.',
    '--ignore', 'logs',
    '--ignore', stateFile,
    server,
    configFiles,
    mode
];

console.log(cmd);

function start() {
    var ampm = child_process.spawn(cmd, args, {
        stdio: 'inherit'
    });
    ampm.on('close', start);
}

start();
