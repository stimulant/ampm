var _ = require('lodash'); // Utilities. http://underscorejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var BaseModel = require('./baseModel.js').BaseModel;

// A state object which persists across server restarts.
exports.ServerState = BaseModel.extend({
    _saveTimeout: 0,
    _stateFile: 'ampm-state.json',
    _callbacks: null,

    defaults: {
        // False when the admin has shut down the app from the panel. Don't start the app on boot if this is false.
        runApp: true
    },

    // Decode the state file.
    initialize: function() {
        try {
            this.set(fs.existsSync(this._stateFile) ? JSON.parse(fs.readFileSync(this._stateFile)) : {});
        } catch (e) {}
    },

    // Write to the state file.
    saveState: function(key, value, callback) {
        if (this.get(key) == value) {
            return;
        }

        this.set(key, value);
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(_.bind(function() {
            fs.writeFile(this._stateFile, JSON.stringify(this.attributes, null, '\t'), _.bind(function() {
                while (this._callbacks && this._callbacks.length) {
                    this._callbacks.shift()();
                }
            }, this));
        }, this), 1000);

        if (callback) {
            if (!this._callbacks) {
                this._callbacks = [];
            }

            this._callbacks.push(callback);
        }
    }
});
