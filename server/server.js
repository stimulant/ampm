var express = require('express');
var request = require('request');
var http = require('http');
var fs = require('fs');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var path = require('path');
var _ = require('underscore');
var XRegExp = require('xregexp').XRegExp;
var moment = require('moment');

var config = require('./config.js').config;
server.listen(3000);

request(config.rootXml, function(error, response, body) {
    response.body = null;

    var pattern = new XRegExp(/>(http.*?)</gi);
    var matches = [];
    var match;

    while (true) {
        match = pattern.exec(body);
        if (!match) {
            break;
        }
        matches.push(match);
    }

    pattern = new XRegExp(config.cmsRoot + '/(.*)');
    _.each(matches, function(element, index, list) {
        var url = element[1];

        var filepath = config.outputBase + XRegExp.exec(url, pattern)[1];
        var dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        if (fs.existsSync(filepath)) {
            var localFileModified = moment(fs.statSync(filepath).mtime);
            request({
                url: url,
                method: 'HEAD'
            }, function(error, response, body) {
                fs.writeFile('response.json', JSON.stringify(response, null, 4));
                var remoteFileModified = moment(response.headers['last-modified']);
                if (!remoteFileModified.isAfter(localFileModified)) {
                    console.log('Skipping ' + url);
                } else {
                    console.log('Downloading ' + url);
                    request(url, function(error, response, body) {

                    }).pipe(fs.createWriteStream(filepath));
                }
            });
        }
    });
}).pipe(fs.createWriteStream(config.outputBase + 'content.xml'));


// routing......
app.get('/', function(req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket) {
    socket.emit('news', {
        hello: 'woddrld'
    });
    socket.on('my other event', function(data) {
        console.log(data);
    });
});
