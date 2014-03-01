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
            name: 'content',
            config: config.contentUpdater
        }));
        this.set('appUpdater', new AppUpdater({
            name: 'app',
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
        socket.on('update', _.bind(this.update, this));
        socket.on('rollBack', _.bind(this.rollback, this));
    },

    setSource: function(updater, source) {
        updater = this.get(updater + 'Updater');
        if (source == updater.get('source')) {
            return;
        }

        updater.set('source', source);

        fs.exists(updater.get('temp')[source], _.bind(function(exists) {
            if (exists) {
                this.deploy(updater, true);
            } else {
                this.update(updater);
            }
        }, this));
    },

    _deploySource: function(contentChecked, appChecked, contentDownloaded, appDownloaded, force) {
        if (appChecked && contentChecked) {
            if (contentDownloaded && appDownloaded) {
                this._onDownloaded(contentDownloaded, appDownloaded, force);
            } else {
                this.update();
            }
        }
    },

    update: function(updater) {
        if (_.isString(updater)) {
            updater = this.get(updater + 'Updater');
        }

        logger.info('Updating ' + updater.get('name') + ' from ' + updater.get('source'));

        updater.download(_.bind(function(error) {
            if (error) {
                return;
            }

            logger.info(updater.get('name') + ' download complete! ' + (updater.get('needsUpdate') ? '' : 'Nothing new was found.'));
            if (!updater.get('needsUpdate')) {
                return;
            }

            this.deploy(updater);
        }, this));
    },

    deploy: function(updater, force) {
        this.get('persistence').shutdownApp(_.bind(function() {

            // Copy content files from the temp folder.
            updater.deploy(force, _.bind(function(error) {
                if (!error) {
                    logger.info(updater.get('name') + ' deploy complete! ' + updater.get('updated').toString());
                }

                this.get('persistence').restartApp();
            }, this));
        }, this));
    },

    // Shut down the app, roll back content, and restart it.
    rollback: function(updater) {
        updater = this.get(updater + 'Updater');
        this.get('persistence').shutdownApp(_.bind(function() {
            updater.rollBack(_.bind(function() {
                logger.info('Rollback complete!');
                this.get('persistence').restartApp();
            }, this));
        }, this));
    }
});