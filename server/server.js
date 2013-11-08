var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

server.listen(3000);

// Load config file.
var config = require('./config.js').config;
var Updater = require('./updater.js').Updater;

var updater = new Updater({
    config: config
});

updater.update();

app.get('/', function(req, res) {
    res.sendfile(__dirname + '/view/index.html');
});

/*
io.sockets.on('connection', function(socket) {
    socket.emit('news', {
        hello: 'woddrld'
    });
    socket.on('my other event', function(data) {
        console.log(data);
    });
});
*/
