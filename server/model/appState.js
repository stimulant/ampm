var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;

// Class for sync logic specific to the application.
exports.AppState = BaseModel.extend({
    defaults: {
        x: 0,
        y: 0
    },

    initialize: function() {
        oscServer.on('mouse', _.bind(this._onMouse, this));
    },

    _onMouse: function(message) {
        this.set('x', message.x);
        this.set('y', message.y);
    }
});
