var path = require('path'); // File path processing. http://nodejs.org/api/path.html
var _ = require('underscore'); // Utilities. http://underscorejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs
var unzip = require('unzip'); // Extract zip files. https://github.com/nearinfinity/node-unzip

var ContentUpdater = require('./contentUpdater.js');

// Like ContentUpdater except for a single file, which gets unzipped when it's done loading.
exports.ClientUpdater = ContentUpdater.ContentUpdater.extend({

	defaults: _.extend(_.clone(ContentUpdater.ContentUpdater.prototype.defaults), {
		// The final local path for the client.
		local: '../client/',

		// The temp path for the client.
		temp: '../client.tmp/',
	}),

	initialize: function() {
		console.log(this.get('local'));
		var filename = path.basename(this.get('remote'));
		var file = new ContentUpdater.ContentFile({
			url: this.get('remote'),
			filePath: this.get('local') + filename,
			tempPath: this.get('temp') + filename
		});

		file.on('loaded', this._onFileLoaded, this);

		this.set('files', new ContentUpdater.ContentFiles());
		this.get('files').add(file);
	},

	update: function(callback) {
		this._callback = callback;
		var file = this.get('files').at(0);
		this._initDirectories(_.bind(function() {
			this._processFile(file);
		}, this));
	},

	_completed: function() {
		var file = this.get('files').at(0);

		// Not a zip file, so bail.
		if (path.extname(file.get('url')).toUpperCase() != '.ZIP') {
			ContentUpdater.ContentUpdater.prototype._completed.call(this);
			return;
		}

		// Unzip the file.
		fs.createReadStream(
			file.get('filePath'))
			.pipe(unzip.Extract({
				path: path.dirname(file.get('filePath'))
			})).on('finish', _.bind(function(error) {
				this._handleError('Error unzipping client.', error);
				ContentUpdater.ContentUpdater.prototype._completed.call(this);
			}, this));
	}
});
