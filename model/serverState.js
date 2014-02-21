var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var winston = require('winston'); // Logging. https://github.com/flatiron/winston
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

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
        // console.log(JSON.stringify(this.fullConfig(), null, '\t'));

        comm.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    fullConfig: function() {
        return {
            network: this.get('network').attributes,
            contentUpdater: this.get('contentUpdater').attributes,
            appUpdater: this.get('appUpdater').attributes,
            persistence: this.get('persistence').attributes,
            logging: this.get('logging').attributes
        };
    },

    clean: function() {
        this.get('network').clean();
        this.get('contentUpdater').clean();
        this.get('appUpdater').clean();
        this.get('persistence').clean();
        this.get('logging').clean();
        this.get('appState').clean();
        BaseModel.prototype.clean.apply(this);
    },

    _onConnection: function(socket) {
        socket.on('setSource', _.bind(this.setSource, this));
        socket.on('updateContent', _.bind(this.updateContent, this));
        socket.on('rollBack', _.bind(this.rollBackContent, this));
    },

    setSource: function(source) {
        if (source == savedState.contentSource) {
            return;
        }

        var oldSource = savedState.contentSource;
        saveState('contentSource', source);

        var contentChecked = false;
        var appChecked = false;
        var contentDownloaded = false;
        var appDownloaded = false;

        fs.exists(this.get('contentUpdater').get('temp')[source], _.bind(function(exists) {
            contentChecked = true;
            contentDownloaded = exists;
            this._deploySource(contentChecked, appChecked, contentDownloaded, appDownloaded, oldSource);
        }, this));

        fs.exists(this.get('appUpdater').get('temp')[source], _.bind(function(exists) {
            appChecked = true;
            appDownloaded = exists;
            this._deploySource(contentChecked, appChecked, contentDownloaded, appDownloaded, oldSource);
        }, this));
    },

    _deploySource: function(contentChecked, appChecked, contentDownloaded, appDownloaded, oldSource) {
        if (appChecked && contentChecked) {
            if (contentDownloaded && appDownloaded) {
                this._onDownloaded(contentDownloaded, appDownloaded, oldSource);
            } else {
                this.updateContent();
            }
        }
    },

    updateContent: function() {
        var contentDownloaded = false;
        var appDownloaded = false;

        source = savedState.contentSource;

        if (source) {
            logger.info('Updating from ' + source);
        }

        // Download content update.
        this.get('contentUpdater').download(source, _.bind(function(error) {
            contentDownloaded = true;
            this._onDownloaded(contentDownloaded, appDownloaded);
            if (!error) {
                logger.info('Content download complete! ' + (this.get('contentUpdater').get('needsUpdate') ? '' : 'Nothing new was found.'));
            }
        }, this));

        // Download app update.
        this.get('appUpdater').download(source, _.bind(function(error) {
            appDownloaded = true;
            this._onDownloaded(contentDownloaded, appDownloaded);
            if (!error) {
                logger.info('App download complete! ' + (this.get('appUpdater').get('needsUpdate') ? '' : 'Nothing new was found.'));
            }
        }, this));
    },

    _onDownloaded: function(contentDownloaded, appDownloaded, oldSource) {
        if (!contentDownloaded || !appDownloaded) {
            return;
        }

        // New stuff was downloaded, so shut down the app and process the downloaded files.
        if (!oldSource) {
            var contentUpdated = !this.get('contentUpdater').get('needsUpdate');
            var appUpdated = !this.get('appUpdater').get('needsUpdate');
            if (contentUpdated && appUpdated) {
                return;
            }
        }

        this.get('persistence').shutdownApp(_.bind(function() {
            // Copy content files from the temp folder.
            this.get('contentUpdater').deploy(oldSource, _.bind(function(error) {
                if (!error) {
                    logger.info('Content deploy complete! ' + this.get('contentUpdater').get('updated').toString());
                }

                // Copy the app from the temp folder, and unzip it.
                this.get('appUpdater').deploy(oldSource, _.bind(function(error) {
                    if (!error) {
                        logger.info('App deploy complete! ' + this.get('appUpdater').get('updated').toString());
                    }

                    this.get('persistence').restartApp();
                }, this));
            }, this));
        }, this));
    },

    // Shut down the app, roll back content, and restart it.
    rollBackContent: function() {
        this.get('persistence').shutdownApp(_.bind(function() {
            this.get('contentUpdater').rollBack(_.bind(function() {
                this.get('appUpdater').rollBack(_.bind(function() {
                    logger.info('Rollback complete!');
                    this.get('persistence').restartApp();
                }, this));
            }, this));
        }, this));
    }
});