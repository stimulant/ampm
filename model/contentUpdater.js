var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var path = require('path'); // File path processing. http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var request = require('request'); // Simpler HTTP. https://github.com/mikeal/request
var progress = require('request-progress'); // Progress events on downloads. https://github.com/IndigoUnited/node-request-progress
var XRegExp = require('xregexp').XRegExp; // Fancy regular expressions. http://xregexp.com/

var BaseModel = require('./baseModel.js').BaseModel;

// Download and deploy content by parsing an XML file or copying from a local/network location.
exports.ContentUpdater = BaseModel.extend({

    defaults: {
        // A unique name for the updater.
        name: null,

        // The path to fetch new content from. If this is a URL, ampm will look for an XML file and
        // parse it for additional URLs to fetch. If it's a local/network path, it will use robocopy
        // to fetch a directory. This can also be a mapping of content sources and URLs, such as:
        // {dev: url, live: url }
        remote: null,

        // The local path to deployed content, relative to server.js.
        local: "content/",

        // The current remote source.
        source: null,

        // The local path to download files to before deployment.
        temp: null,

        // The local path to backup existing content to before deployment.
        backup: null,

        // A collection of file objects that are being processed.
        files: null,

        // After a download is initiated, indicates whether anything new was discovered.
        needsUpdate: false,

        // Indicates whether an update is currently in progress.
        isUpdating: false,

        // Indicates whether there is a backup of content to roll back to.
        canRollback: false
    },

    // A callback to call when updating is complete.
    _callback: null,

    initialize: function() {
        BaseModel.prototype.initialize.apply(this);

        // Normalize slashes at the end of paths.
        this.set('local', path.join(this.get('local'), '/'));

        // Even if there's only one remote configured, make it an object so it's standard.
        if (this.get('remote') && !_.isObject(this.get('remote'))) {
            this.set('remote', {
                remote: this.get('remote')
            });
        }

        // Set up the temp and backup paths.
        var temp = {};
        var backup = {};


        // Retrieve the last saved source, if any.
        this.set('source', $$serverState.get('source-' + this.get('name')));
        if (!this.get('remote') || !this.get('remote')[this.get('source')]) {
            this.set('source', null);
        }

        // Create temp and backup paths.
        for (var source in this.get('remote')) {
            if (!this.get('source')) {
                this.set('source', source);
            }

            temp[source] = path.join(path.dirname(this.get('local')), path.basename(this.get('local')) + '.' + source + '.temp', '/');
            backup[source] = path.join(path.dirname(this.get('local')), path.basename(this.get('local')) + '.' + source + '.backup', '/');
        }

        this.set('temp', temp);
        this.set('backup', backup);

        // When the source changes, save it to disk.
        this.on('change:source', _.bind(function() {
            if (!this.get('source')) {
                return;
            }

            $$serverState.saveState('source-' + this.get('name'), this.get('source'));
            fs.exists(this.get('backup')[this.get('source')], _.bind(function(exists) {
                this.set('canRollback', exists);
            }, this));
        }, this));
        this.trigger('change:source');
    },

    // Download new content to the temp folder.
    download: function(callback) {
        this._callback = callback;
        this.set('needsUpdate', false);
        this.set('isUpdating', true);
        this._doDownload();
    },

    // Based on the source path, determine if it's a remote XML file or local copy, and begin the 
    // update.
    _doDownload: function() {
        var source = this.get('source');
        this._initDirectories(_.bind(function() {
            var remote = this.get('remote')[source];
            if (remote.indexOf('http') === 0) {
                // We're going to pull down an XML file from the web and parse it for other files.
                request(remote, _.bind(function(error, response, body) {
                    this._processContentRoot(error, response, body);
                }, this));
            } else {
                // We're going to just robocopy from another folder instead.
                this._robocopy(remote, path.resolve(this.get('temp')[source]), null, _.bind(function(code) {
                    this.set('needsUpdate', code > 0 && code <= 8);
                    this._callback(code > 8 ? code : 0);
                    if (code > 8) {
                        // Something bad happened.
                        logger.error('Robocopy failed with code ' + code);
                    }
                }, this));
            }
        }, this));
    },

    // Set up the temp and output directories.
    _initDirectories: function(callback) {
        // Make the temp directory.
        fs.mkdir(this.get('temp')[this.get('source')], 0777, true, _.bind(function(error) {
            this._handleError('Error creating temp directory.', error);

            fs.exists(this.get('local'), _.bind(function(exists) {
                if (exists) {
                    callback();
                    return;
                }

                // Make the ouput directory.
                fs.mkdir(this.get('local'), 0777, true, _.bind(function(error) {
                    this._handleError('Error creating ouput directory.', error);
                    callback();
                }, this));
            }, this));
        }, this));
    },

    // Process the XML file to extract files to load.
    _processContentRoot: function(error, response, body) {
        var source = this.get('source');
        if (response && response.statusCode != 200) {
            this._handleError('Error loading root XML -- bad password?');
            return;
        }

        this._handleError('Error loading root XML.', error);

        // Write the root XML file.
        fs.writeFile(this.get('temp')[source] + 'content.xml', body, _.bind(function(error) {
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
                    filePath: this.get('local') + relativePath,
                    tempPath: this.get('temp')[source] + relativePath
                });

                file.on('loaded', this._onFileLoaded, this);
                this.get('files').add(file);
            }, this);

            _.each(this.get('files').models, _.bind(this._processFile, this));
        }, this));
    },

    // Determine if the file needs to be loaded, or if it's already up to date.
    _processFile: function(contentFile) {
        fs.exists(contentFile.get('tempPath'), _.bind(function(exists) {
            if (!exists) {
                // The file doesn't exist locally, so download it.
                this._downloadFile(contentFile);
                return;
            }

            // The file does exist locally, check if the remote one is newer.
            fs.stat(contentFile.get('tempPath'), _.bind(function(error, stats) {
                var localFileModified = moment(stats.mtime);
                request({
                    url: contentFile.get('url'),
                    method: 'HEAD'
                }, _.bind(function(error, response, body) {
                    var remoteFileModified = moment(new Date(response.headers['last-modified']));
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
        logger.info('Downloading ' + contentFile.get('url'));

        // Request the file from the network.
        progress(request({
            url: contentFile.get('url'),
            encoding: null // Required for binary files.
        }, _.bind(function(error, response, body) {
            if (!error && response.statusCode != 200) {
                error = response.statusCode;
            }

            this.set('needsUpdate', !error);
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
        var style = contentFile.get('totalBytes') ? 'loaded' : 'cached';
        logger.info(contentFile.get('url') + ' ' + style + ', ' + filesToGo + ' to go');

        if (!filesToGo) {
            this.set('isUpdating', false);
            this._callback();
        }
    },

    // Copy files to their final destination when all files are loaded.
    deploy: function(force, callback) {
        var source = this.get('source');
        this.set('isUpdating', true);
        this._callback = callback;
        if (!force && !this.get('needsUpdate')) {
            this._completed();
            return;
        }

        deployFromTemp = _.bind(function() {
            logger.info('Deploying from ' + path.resolve(this.get('temp')[source]) + ' to ' + path.resolve(this.get('local')));

            // Delete restart file.
            fs.unlink(path.join(this.get('temp')[source], '/ampm/restart.json'), _.bind(function() {

                // Copy from temp to local.
                this._robocopy(this.get('temp')[source], this.get('local'), null, _.bind(function(error) {
                    this._handleError('Error copying from temp folder.', error > 8);
                    this._completed();
                }, this));
            }, this));
        }, this);

        backupThenDeploy = _.bind(function() {
            logger.info('Backing up from ' + path.resolve(this.get('local')) + ' to ' + path.resolve(this.get('backup')[source]));

            // Copy from local to backup.
            this._robocopy(this.get('local'), this.get('backup')[source], null, _.bind(function(error) {
                this._handleError('Error copying to backup folder.', error > 8);
                if (error > 8) {
                    this._completed();
                    return;
                }

                this.set('canRollback', true);
                deployFromTemp();
            }, this));
        }, this);

        if (force) {
            deployFromTemp();
        } else {
            backupThenDeploy();
        }
    },

    // Notify on completion.
    _completed: function() {
        this.set('isUpdating', false);
        this.trigger('complete');
        if (this._callback) {
            this._callback();
        }
    },

    // Generic error handling function.
    _handleError: function(message, error) {
        if (!error) {
            return;
        }

        logger.error(message, error);
        if (this._callback) {
            this._callback(error);
        }
    },

    // Robocopy files instead of downloading them.
    _robocopy: function(sourceDir, targetDir, file, callback) {
        // http://technet.microsoft.com/en-us/library/cc733145.aspx
        var args = [
            sourceDir,
            targetDir,
            file,
            '/e', // Copies subdirectories. Note that this option includes empty directories.
            '/v', // Produces verbose output, and shows all skipped files.
            '/np', // Specifies that the progress of the copying operation (the number of files or directories copied so far) will not be displayed.
            '/njs', // Specifies that there is no job summary.
            '/njh', // Specifies that there is no job header.
            '/bytes', // Prints sizes, as bytes.
            '/fft', // Assumes FAT file times (two-second precision).
            '/ndl' // Specifies that directory names are not to be logged.
        ];

        if (!file) {
            // We're copying full directories, remove the file argument.
            args.splice(2, 1);
        } else {
            // We're copying one file, remove the copy-subdirectories argument.
            args.splice(3, 1);
        }

        var copy = child_process.spawn('robocopy', args);
        logger.info('robocopy: robocopy ' + args.join(' '));

        copy.stdout.on('data', _.bind(function(data) {
            var lines = data.toString().split('\r\n');
            _.each(lines, function(line) {
                line = line.trim();
                if (line) {
                    logger.info('robocopy: ' + line);
                }
            });
        }, this));

        copy.stderr.on('data', _.bind(function(data) {
            logger.error('robocopy: ' + data.toString());
        }, this));

        copy.on('close', _.bind(function(code) {
            // The return codes are weird. http://support.microsoft.com/kb/954404
            if (callback) {
                callback(code);
            }
        }, this));
    },

    // Roll back content -- copy it from the backup folder to the temp folder, and then to live.
    rollBack: function(callback) {
        var source = this.get('source');
        if (!this.get('canRollback')) {
            callback(false);
        }

        this.set('isUpdating', true);
        logger.info('Rolling back, copying from ' + this.get('backup')[source] + ' to ' + this.get('temp')[source]);

        // Copy from backup to temp.
        this._robocopy(this.get('backup')[source], this.get('temp')[source], null, _.bind(function(error) {
            this._handleError('Error copying to temp folder.', error > 8);
            logger.info('Rolling back, copying from ' + this.get('temp')[source] + ' to ' + this.get('local'));

            // Delete restart file.
            fs.unlink(path.join(this.get('temp')[source], '/ampm/restart.json'), _.bind(function() {

                // Copy from temp to local.
                this._robocopy(this.get('temp')[source], this.get('local'), null, _.bind(function(error) {
                    this._handleError('Error copying to deploy folder.', error > 8);

                    // Delete old backup.
                    child_process.exec('rmdir /s /q ' + this.get('backup')[source], _.bind(function(error) {
                        this._handleError('Error deleting backup.', error);

                        // Delete old temp.
                        child_process.exec('rmdir /s /q ' + this.get('temp')[source], _.bind(function(error) {
                            this._handleError('Error deleting temp.', error);
                            this.set('isUpdating', false);
                            this.set('canRollback', false);
                        }, this));
                    }, this));
                    callback(error);
                }, this));
            }, this));
        }, this));
    }
});

// A model representing a file to load from the web.
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

// A collection of content files.
exports.ContentFiles = Backbone.Collection.extend({
    model: exports.ContentFile
});
