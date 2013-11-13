var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;

// Class for sync logic specific to the application.
exports.AppState = BaseModel.extend({
    defaults: {},

    initialize: function() {
        io.sockets.on('connection', _.bind(this._onConnection, this));
    },

    _onConnection: function(socket) {}
});
