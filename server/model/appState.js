var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;

// Class for sync logic specific to the application.
AppState = exports.AppState = BaseModel.extend({
    defaults: {
        clientStates: null
    },

    initialize: function() {
        this.set('clientStates', {});
        oscReceive.on('setClientState', _.bind(this._onSetClientState, this));
    },

    _onSetClientState: function(message) {
        var client = message.client;
        message = JSON.parse(message.state);
        var states = this.get('clientStates');
        var state = states[client];
        if (!state) {
            state = states[client] = new ClientState(config.clients[client]);
        }

        state.get('point').set('x', message.Point.X);
        state.get('point').set('y', message.Point.Y);
    }
});

Point = exports.Point = BaseModel.extend({
    defaults: {
        x: 0,
        y: 0
    }
});

ClientState = exports.ClientState = BaseModel.extend({
    defaults: {
        point: null,
        color: 'Black'
    },

    initialize: function() {
        this.set('point', new Point());
    }
});
