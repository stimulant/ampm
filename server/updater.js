var Backbone = require('backbone');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var XRegExp = require('xregexp').XRegExp;
var moment = require('moment');
var request = require('request');

exports.Updater = Backbone.Model.extend({

    defaults: {
        lastUpdate: null,
        config: null
    },

    initialize: function() {},

    update: function() {
        var config = this.get('config');

        // Create the target directory if needed.
        fs.exists(config.outputBase, _.bind(function(exists) {
            if (!exists) {
                fs.mkdir(config.tempBase, 0777, _.bind(function(error) {
                    fs.mkdir(config.outputBase, 0777, _.bind(function(error) {
                        request(config.rootXml, _.bind(this._processRootXml, this));
                    }, this));
                }, this));
            } else {
                request(config.rootXml, _.bind(this._processRootXml, this));
            }
        }, this));
    },

    _processRootXml: function(error, response, body) {
        var config = this.get('config');
        fs.writeFile(config.tempBase + 'content.xml', body);

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
            var relativePath = XRegExp.exec(url, pattern)[1];
            var filePath = config.outputBase + relativePath;
            var tempPath = config.tempBase + relativePath;

            fs.exists(filePath, _.bind(function(exists) {
                if (!exists) {
                    // The file doesn't exist locally, so download it.
                    this._downloadLinkedFile(url, tempPath);
                } else {
                    // The file does exist locally, check if the remote one is newer.
                    fs.stat(filePath, _.bind(function(error, stats) {
                        var localFileModified = moment(stats.mtime);
                        request({
                            url: url,
                            method: 'HEAD'
                        }, _.bind(function(error, response, body) {
                            var remoteFileModified = moment(response.headers['last-modified']);
                            if (remoteFileModified.isAfter(localFileModified)) {
                                this._downloadLinkedFile(url, tempPath);
                            } else {
                                console.log('Skipping ' + url);
                            }
                        }, this));
                    }));
                }
            }, this));
        }, this);
    },

    // Download a file to a given path on disk.
    _downloadLinkedFile: function(url, filePath) {
        console.log('Downloading ' + url);

        var dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        request(url, _.bind(function(error, response, body) {
            if (error) {
                console.log('Error loading ' + url);
                console.log(error);
            } else {
                fs.writeFile(filePath, body);
            }
        }, this));
    }
});
