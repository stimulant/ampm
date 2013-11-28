var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;

// Class for sync logic specific to the application.
AppState = exports.AppState = BaseModel.extend({
    defaults: {
        hostname: null,
        lastHeart: null,
        color: 'black',
        x: 0,
        y: 0
    },

    initialize: function() {}
});