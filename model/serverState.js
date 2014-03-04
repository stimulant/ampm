var _ = require('lodash'); // Utilities. http://underscorejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var BaseModel = require('./baseModel.js').BaseModel;

// Model for app logic specific to the server.
exports.ServerState = BaseModel.extend({
	_saveTimeout: 0,
	_stateFile: 'state.json',

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
