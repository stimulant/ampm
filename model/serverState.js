var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston

var BaseModel = require('./baseModel.js').BaseModel;
var Network = require('./network.js').Network;
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
        logging: null,
        network: null
    },

    initialize: function() {},

    start: function() {
        this.set('network', new Network({
            config: config.network
        }));
        this.set('contentUpdater', new ContentUpdater({
            config: config.contentUpdater
        }));
        this.set('appUpdater', new AppUpdater({
            config: config.appUpdater
        }));
        this.set('persistence', new Persistence({
            config: config.persistence
        }));
        this.set('logging', new Logging({
            config: config.logging
        }));
        this.set('appState', new AppState({
            config: config.app
        }));

        // Spew config for documentation.
        var fullConfig = {
            network: this.get('network').attributes,
            contentUpdater: this.get('contentUpdater').attributes,
            appUpdater: this.get('appUpdater').attributes,
            persistence: this.get('persistence').attributes,
            logging: this.get('logging').attributes
        };

        // console.log(JSON.stringify(fullConfig, null, '\t'));

        comm.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    clean: function() {
        this.get('network').clean();
        this.get('contentUpdater').clean();
        this.get('appUpdater').clean();
        this.get('persistence').clean();
        this.get('logging').clean();
        this.get('appState').clean();
    },

    _onConnection: function(socket) {
        socket.on('updateContent', _.bind(this.updateContent, this));
    },

    updateContent: function() {
        var contentDownloaded = false;
        var appDownloaded = false;

        // Download content update.
        this.get('contentUpdater').download(_.bind(function(error) {
            contentDownloaded = true;
            this._onDownloaded(contentDownloaded, appDownloaded);
            if (!error) {
                logger.info('Content download complete! ' + this.get('contentUpdater').get('downloaded').toString());
            }
        }, this));

        // Download app update.
        this.get('appUpdater').download(_.bind(function(error) {
            appDownloaded = true;
            this._onDownloaded(contentDownloaded, appDownloaded);
            if (!error) {
                logger.info('App download complete! ' + this.get('appUpdater').get('downloaded').toString());
            }
        }, this));
    },

    _onDownloaded: function(contentDownloaded, appDownloaded) {
        if (!contentDownloaded || !appDownloaded) {
            return;
        }

        if (!this.get('contentUpdater').get('needsUpdate') && !this.get('appUpdater').get('needsUpdate')) {
            return;
        }

        // New stuff was downloaded, so shut down the app and process the downloaded files.
        var contentUpdated = false;
        var appUpdated = false;

        this.get('persistence').shutdownApp(_.bind(function() {

            // Copy content files from the temp folder.
            this.get('contentUpdater').update(_.bind(function(error) {
                contentUpdated = true;
                this._onUpdated(contentUpdated, appUpdated);
                if (!error) {
                    logger.info('Content update complete! ' + this.get('contentUpdater').get('updated').toString());
                }
            }, this));

            // Copy the app from the temp folder, and unzip it.
            this.get('appUpdater').update(_.bind(function(error) {
                appUpdated = true;
                this._onUpdated(contentUpdated, appUpdated);
                if (!error) {
                    logger.info('App update complete! ' + this.get('appUpdater').get('updated').toString());
                }
            }, this));
        }, this));
    },

    // Once the download has been processed, restart the app.
    _onUpdated: function(contentUpdated, appUpdated) {
        if (!contentUpdated || !appUpdated) {
            return;
        }

        this.get('persistence').restartApp();
    }
});