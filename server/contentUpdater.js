var path = require('path'); // File path processing. http://nodejs.org/api/path.html
var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var request = require('request'); // Simpler HTTP. https://github.com/mikeal/request
var progress = require('request-progress'); // Progress events on downloads. https://github.com/IndigoUnited/node-request-progress
var XRegExp = require('xregexp').XRegExp; // Fancy regular expressions. http://xregexp.com/
var rimraf = require('rimraf'); // Recursive directory delete. https://github.com/isaacs/rimraf
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var ncp = require('ncp').ncp; // Recursive directory copy. https://npmjs.org/package/ncp

// Update content for the application, as well as the application itself.
exports.ContentUpdater = Backbone.Model.extend({

    defaults: {
        // When the content was last updated.
        updated: null,

        // The global config object.
        config: null,

        // A collection of file objects that are being processed.
        files: null
    },

    // A callback to call when updating is complete.
    _callback: null,

    // Manually update content.
    update: function(callback) {
        this._callback = callback;
        var config = this.get('config');

        // Delete the temp directory.
        rimraf(config.temp, _.bind(function(error) {
            this._handleError('Error clearing temp directory.', error);

            // Make the temp directory.
            fs.mkdir(config.temp, 0777, true, _.bind(function(error) {
                this._handleError('Error creating temp directory.', error);

                fs.exists(config.local, _.bind(function(exists) {
                    if (exists) {
                        // Download the root XML.
                        request(config.remote, _.bind(this._processContentRoot, this));
                        return;
                    }

                    // Make the ouput directory.
                    fs.mkdir(config.local, 0777, true, _.bind(function(error) {
                        this._handleError('Error creating ouput directory.', error);

                        // Download the root XML.
                        request(config.remote, _.bind(this._processContentRoot, this));
                    }, this));
                }, this));
            }, this));
        }, this));
    },

    // Process the XML file to extract files to load.
    _processContentRoot: function(error, response, body) {
        this._handleError('Error loading root XML.', error);
        var config = this.get('config');

        // Write the root XML file.
        fs.writeFile(config.temp + 'content.xml', body, _.bind(function(error) {
            this._handleError('Error writing root XML.', error);
            this.set('files', new exports.ContentFiles());

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

            // Figure out what each URL begins with -- this is removed to create the relative path.
            var prefix = '';

            function iterator(element, index, list) {
                return element[1].indexOf(prefix) === 0;
            }

            while (true) {
                prefix += matches[0][1][prefix.length];
                if (!_.every(matches, iterator)) {
                    prefix = prefix.substr(0, prefix.length - 1);
                    break;
                }
            }

            // Build file objects.
            _.each(matches, function(element, index, list) {
                var url = element[1];
                var relativePath = url.substr(prefix.length);
                var file = new exports.ContentFile({
                    url: url,
                    filePath: config.local + relativePath,
                    tempPath: config.temp + relativePath
                });

                file.on('loaded', this._onFileLoaded, this);
                this.get('files').add(file);
            }, this);

            _.each(this.get('files').models, _.bind(this._processFile, this));
        }, this));
    },

    // Determine if the file needs to be loaded, or if it's already up to date.
    _processFile: function(contentFile) {
        fs.exists(contentFile.get('filePath'), _.bind(function(exists) {
            if (!exists) {
                // The file doesn't exist locally, so download it.
                this._downloadFile(contentFile);
                return;
            }

            // The file does exist locally, check if the remote one is newer.
            fs.stat(contentFile.get('filePath'), _.bind(function(error, stats) {
                var localFileModified = moment(stats.mtime);
                request({
                    url: contentFile.get('url'),
                    method: 'HEAD'
                }, _.bind(function(error, response, body) {
                    var remoteFileModified = moment(response.headers['last-modified']);
                    if (remoteFileModified.isAfter(localFileModified)) {
                        // The remote file is newer, go get it.
                        this._downloadFile(contentFile);
                        return;
                    }

                    // The local file is newer, flag it as loaded.
                    contentFile.set('progress', 1);
                }, this));
            }, this));
        }, this));
    },

    // Load the file into memory and create its temp output directory.
    _downloadFile: function(contentFile) {
        console.log('Downloading ' + contentFile.get('url'));

        // Request the file from the network.
        progress(request(contentFile.get('url'), _.bind(function(error, response, body) {
            this._handleError('Error loading ' + contentFile.get('url'), error);

            // Create the file's output directory if needed.
            var dir = path.dirname(contentFile.get('tempPath'));
            fs.exists(dir, _.bind(function(exists) {
                if (!exists) {
                    fs.mkdir(dir, 0777, true, _.bind(function(error) {
                        this._handleError('Error creating temp directory for file.', error);
                        this._writeFile(contentFile, body);
                    }, this));
                } else {
                    this._writeFile(contentFile, body);
                }
            }, this));

        }, this))).on('progress', function(state) {

            // Set progress properties on the file.
            contentFile.set('receivedBytes', state.received);
            contentFile.set('totalBytes', state.total);
            contentFile.set('progress', state.percent / 100);
        });
    },

    // When the file is done loading, write it to disk.
    _writeFile: function(contentFile, body) {
        fs.writeFile(contentFile.get('tempPath'), body, null, _.bind(function(error) {
            this._handleError('Error writing file.', error);
            contentFile.set('progress', 1);
        }, this));
    },

    // Called when the progress of a file is set to 1.
    _onFileLoaded: function(contentFile) {
        contentFile.off('loaded', this._onFileLoaded, this);

        // Determine if all files are loaded.
        var filesToGo = _.filter(this.get('files').models, function(file) {
            return file.get('progress') < 1;
        }).length;
        console.log(contentFile.get('url') + ' loaded, ' + filesToGo + ' to go');

        if (!filesToGo) {
            this._processFiles();
        }
    },

    // Copy files to their final destination when all files are loaded.
    // TODO: If a file is removed from the CMS, it will never get removed from the output directory.
    _processFiles: function() {
        // Recursive copy from temp to target.
        ncp(this.get('config').temp, this.get('config').local, _.bind(function(error) {
            this._handleError('Error copying from temp folder.', error);

            // Delete the temp folder.
            rimraf(this.get('config').temp, _.bind(function(error) {
                this._handleError('Error clearing temp directory.', error);

                // Notify on completion.
                this.set('updated', moment());
                this.trigger('complete');
                if (this._callback) {
                    this._callback();
                }
            }, this));
        }, this));
    },

    // Generic error handling function.
    // TODO: Replace with real logging.
    _handleError: function(message, error) {
        if (!error) {
            return;
        }

        console.log(message);
        console.log(error);
        if (this._callback) {
            this._callback(error);
        }

        throw error;
    }
});

exports.ContentFile = Backbone.Model.extend({
    defaults: {
        url: null,
        filePath: null,
        tempPath: null,
        progress: 0,
        receivedBytes: 0,
        totalBytes: 0
    },

    initialize: function() {
        this.on('change:progress', function(model, value, options) {
            if (value >= 1) {
                this.trigger('loaded', this);
            }
        }, this);
    }
});

exports.ContentFiles = Backbone.Collection.extend({
    model: exports.ContentFile
});
