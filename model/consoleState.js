var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var BaseModel = require('./baseModel.js').BaseModel;

// Model for app logic specific to the server.
exports.ConsoleState = BaseModel.extend({
    initialize: function() {

        // Spew config for documentation.
        // console.log(JSON.stringify(this.fullConfig(), null, '\t'));

        network.transports.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    fullConfig: function() {
        return {
            network: network.attributes,
            contentUpdater: contentUpdater.attributes,
            appUpdater: appUpdater.attributes,
            persistence: persistence.attributes,
            logging: logging.attributes
        };
    },

    _onConnection: function(socket) {
        socket.on('setSource', _.bind(this.setSource, this));
        socket.on('update', _.bind(this.update, this));
        socket.on('rollback', _.bind(this.rollback, this));
    },

    setSource: function(updater, source) {
        if (_.isString(updater)) {
            updater = global[updater + 'Updater'];
        }

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

    update: function(updater, callback) {
        if (_.isString(updater)) {
            updater = global[updater + 'Updater'];
        }

        logger.info('Updating ' + updater.get('name') + ' from ' + updater.get('source'));

        updater.download(_.bind(function(error) {
            if (error) {
                return;
            }

            logger.info(updater.get('name') + ' download complete! ' + (updater.get('needsUpdate') ? '' : 'Nothing new was found.'));
            if (!updater.get('needsUpdate')) {
                if (callback) {
                    callback();
                }
                return;
            }

            this.deploy(updater, false);
        }, this));
    },

    deploy: function(updater, force) {
        if (_.isString(updater)) {
            updater = global[updater + 'Updater'];
        }

        persistence.shutdownApp(_.bind(function() {
            updater.deploy(force, _.bind(function(error) {
                if (error) {
                    return;
                }

                logger.info(updater.get('name') + ' deploy complete!');
                if (updater.get('name') == 'app') {
                    persistence.restartServer();
                } else {
                    persistence.restartApp();
                }
            }, this));
        }, this));
    },

    // Shut down the app, roll back content, and restart it.
    rollback: function(updater) {
        if (_.isString(updater)) {
            updater = global[updater + 'Updater'];
        }

        persistence.shutdownApp(_.bind(function() {
            updater.rollBack(_.bind(function(error) {
                if (error) {
                    return;
                }

                logger.info('Rollback complete!');
                if (updater.get('name') == 'app') {
                    persistence.restartServer();
                } else {
                    persistence.restartApp();
                }
            }, this));
        }, this));
    }
});
