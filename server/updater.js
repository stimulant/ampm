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
        if (!fs.existsSync(config.outputBase)) {
            fs.mkdirSync(config.outputBase);
        }

        // Load the root content XML file.
        request(config.rootXml, _.bind(this._processRootXml, this));
    },

    _processRootXml: function(error, response, body) {
        var config = this.get('config');
        fs.writeFile(config.outputBase + 'content.xml', body);

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

            if (!fs.existsSync(filepath)) {
                // The file doesn't exist locally, so download it.
                this._downloadLinkedFile(url, filepath);
            } else {
                // The file does exist locally, check if the remote one is newer.
                var localFileModified = moment(fs.statSync(filepath).mtime);
                request({
                    url: url,
                    method: 'HEAD'
                }, _.bind(function(error, response, body) {
                    var remoteFileModified = moment(response.headers['last-modified']);
                    if (remoteFileModified.isAfter(localFileModified)) {
                        this._downloadLinkedFile(url, filepath);
                    } else {
                        console.log('Skipping ' + url);
                    }
                }, this));
            }
        }, this);
    },

    // Download a file to a given path on disk.
    _downloadLinkedFile: function(url, filepath) {
        console.log('Downloading ' + url);

        var dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        request(url, function(error, response, body) {
            if (error) {
                console.log('Error loading ' + url);
                console.log(error);
            }
        }).pipe(fs.createWriteStream(filepath));
    }
});
