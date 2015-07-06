var path = require('path'); // File path processing. http://nodejs.org/api/path.html
var _ = require('lodash'); // Utilities. http://underscorejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var util = require('util');
var recursive = require('recursive-readdir'); // https://www.npmjs.com/package/recursive-readdir
var async = require('async');

var cu = require('./contentUpdater.js');
var ContentUpdater = cu.ContentUpdater;
var ContentFiles = cu.ContentFiles;
var ContentFile = cu.ContentFile;

// Like ContentUpdater except for a single file, which gets unzipped when it's done loading.
exports.AppUpdater = ContentUpdater.extend({

    defaults: _.extend(_.clone(ContentUpdater.prototype.defaults), {
        local: 'app/'
    }),

    // Download the new app to the temp folder.
    _doDownload: function() {
        var source = this.get('source');
        var remote = this.get('remote')[source];
        var filename = path.basename(remote);
        var file = new ContentFile({
            url: remote,
            filePath: this.get('local')[source] + filename,
            tempPath: this.get('temp')[source] + filename
        });

        file.on('loaded', this._onFileLoaded, this);

        this.set('files', new ContentFiles());
        this.get('files').add(file);

        this._initDirectories(_.bind(function() {
            if (remote.indexOf('http') === 0) {
                // We're going to download a file from the web using the content updater logic.
                this._processFile(file);
            } else {
                // We're just going to copy a local file.
                var isDir = path.parse(remote).ext ? false : true;
                this._robocopy(
                    isDir ? remote : path.dirname(remote),
                    path.dirname(path.resolve(file.get('tempPath'))),
                    isDir ? '' : path.basename(remote),
                    _.bind(function(code) {
                        this.set('needsUpdate', code > 0 && code <= 8);
                        this._callback(0);
                        /*
                        this._callback(code > 8 ? code : 0);
                        if (code > 8) {
                            // Something bad happened.
                            logger.error('Robocopy failed with code ' + code);
                        }
                        */
                    }, this));
            }
        }, this));
    },

    // Unzip any zip files.
    _onFileLoaded: function(contentFile) {
        if (!contentFile.get('totalBytes')) {
            // File was cached.
            ContentUpdater.prototype._onFileLoaded.call(this, contentFile);
            return;
        }

        if (path.extname(contentFile.get('url')).toUpperCase() != '.ZIP') {
            // Not a zip file.
            ContentUpdater.prototype._onFileLoaded.call(this, contentFile);
            return;
        }

        // Unzip the file.
        logger.info('Unzipping app. ' + contentFile.get('tempPath'));
        var cmd = path.join(process.cwd(), 'tools/7z.exe');

        // Extract
        cmd += ' x ';
        cmd += '"%s"';

        // Output directory
        cmd += ' -y -o';
        cmd += '"%s"';

        // Crazy trick to suppress most of the output, otherwise the buffer gets exceeded. http://stackoverflow.com/a/11629736/468472
        cmd += ' | FIND /V "ing  "';

        var inputFile = path.resolve(contentFile.get('tempPath'));
        var outputDir = path.dirname(path.resolve(contentFile.get('tempPath')));

        child_process.exec(util.format(cmd, inputFile, outputDir), _.bind(function(error, stdout, stderr) {
            if (stdout.toLowerCase().indexOf('error') != -1) {
                error = stdout;
            }

            this._handleError('Error unzipping app.', error);

            // delete temp file
            fs.unlink(contentFile.get('tempPath'), _.bind(function(err) {

                // Unzip any zip files in the build
                recursive(outputDir, _.bind(function(err, files) {
                    files = _.filter(files, function(file) {
                        return path.extname(file) == '.zip';
                    });
                    async.eachSeries(files, _.bind(function(file, callback) {
                        logger.info('Unzipping ' + file);
                        outputDir = file.replace('.zip', '');
                        child_process.exec(util.format(cmd, file, outputDir), _.bind(function() {
                            fs.unlink(file, _.bind(function() {
                                callback();
                            }, this));
                        }, this));
                    }, this), _.bind(function(err) {
                        ContentUpdater.prototype._onFileLoaded.call(this, contentFile);
                    }, this));
                }, this));
            }, this));
        }, this));
    }
});
