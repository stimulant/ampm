var _ = require('lodash'); // Utilities. http://underscorejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var BaseModel = require('./baseModel.js').BaseModel;

// A state object which persists across server restarts.
exports.ServerState = BaseModel.extend({
	_saveTimeout: 0,
	_stateFile: 'state.json',

	defaults: {
		// False when the admin has shut down the app from the panel. Don't start the app on boot if this is false.
		runApp: true
	},

	// Decode the state file.
	initialize: function() {
		this.set(fs.existsSync(this._stateFile) ? JSON.parse(fs.readFileSync(this._stateFile)) : {});
	},

	// Write to the state file.
	saveState: function(key, value) {
		if (this.get(key) == value) {
			return;
		}

		this.set(key, value);
		clearTimeout(this._saveTimeout);
		this._saveTimeout = setTimeout(_.bind(function() {
			fs.writeFile(this._stateFile, JSON.stringify(this.attributes, null, '\t'));
		}, this), 1000);
	}
});
