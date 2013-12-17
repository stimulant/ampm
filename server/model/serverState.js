var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston

var BaseModel = require('./baseModel.js').BaseModel;
var ContentUpdater = require('./contentUpdater.js').ContentUpdater;
var AppUpdater = require('./appUpdater.js').AppUpdater;
var Persistence = require('./persistence.js').Persistence;
var AppState = require('./appState.js').AppState;
var Logging = require('./logging.js').Logging;

// Model for app logic specific to the server.
exports.ServerState = BaseModel.extend({
    defaults: {
        contentUpdater: null,
        appUpdater: null,
        persistence: null,
        appState: null,
        logging: null
    },

    initialize: function() {},

    start: function() {
        this.set('contentUpdater', new ContentUpdater(config.contentUpdater));
        this.set('appUpdater', new AppUpdater(config.appUpdater));
        this.set('persistence', new Persistence(config.persistence));
        this.set('appState', new AppState(config.app));
        this.set('logging', new Logging(config.logging));

        comm.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    _onConnection: function(socket) {
        socket.on('updateContent', _.bind(this.updateContent, this));
    },

    updateContent: function() {
        winston.info('Beginning update.');
        this.get('persistence').shutdownApp();
        this.get('contentUpdater').update(_.bind(this._onContentUpdated, this));
    },

    _onContentUpdated: function(error) {
        if (error) {
            winston.error(error);
            throw error;
        }

        winston.info('Content update complete! ' + this.get('contentUpdater').get('updated').toString());
        this.updateApp();
    },

    updateApp: function() {
        this.get('appUpdater').update(_.bind(this._onAppUpdated, this));
    },

    _onAppUpdated: function(error) {
        if (error) {
            winston.error(error);
            throw error;
        }

        winston.info('App update complete! ' + this.get('appUpdater').get('updated').toString());
        this.get('persistence').restartApp();
    }
});