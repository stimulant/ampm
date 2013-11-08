var express = require('express');
var request = require('request');
var http = require('http');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var XRegExp = require('xregexp').XRegExp;
var moment = require('moment');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

server.listen(3000);

// Load config file.
var config = require('./config.js').config;

updateContent();

function updateContent() {
    if (!fs.existsSync(config.outputBase)) {
        fs.mkdirSync(config.outputBase);
    }

    // Load the root content XML file.
    request(config.rootXml, function(error, response, body) {

        // Collect any URLs in root file.
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

            // Check if the file has been downloaded already.
            if (fs.existsSync(filepath)) {
                var localFileModified = moment(fs.statSync(filepath).mtime);

                // If it has, see if the one on the server is newer.
                request({
                    url: url,
                    method: 'HEAD'
                }, function(error, response, body) {
                    var remoteFileModified = moment(response.headers['last-modified']);
                    if (remoteFileModified.isAfter(localFileModified)) {
                        downloadLinkedFile(url, filepath);
                    } else {
                        console.log('Skipping ' + url);
                    }
                });
            } else {
                downloadLinkedFile(url, filepath);
            }
        });
    }).pipe(fs.createWriteStream(config.outputBase + 'content.xml'));
}

// Download a file to a given path on disk.

function downloadLinkedFile(url, filepath) {
    console.log('Downloading ' + url);

    var dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    request(url, function(error, response, body) {
        console.log('Error loading ' + url);
        console.log(error);
    }).pipe(fs.createWriteStream(filepath));
}

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
