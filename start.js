#! /usr/bin/env node

// Run ampm under forever in case ampm itself crashes.
var forever = require('forever');
var child = new(forever.Monitor)('server.js', {
    sourceDir: __dirname,
    args: process.argv.slice(2)
});

child.start();
