var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var later = require('later'); // Schedule processing. http://bunkat.github.io/later/ 
var winston = require('winston'); // Logging. https://github.com/flatiron/winston

var BaseModel = require('./baseModel.js').BaseModel;

// Startup and shutdown the app on demand and on schedule.
exports.Persistence = BaseModel.extend({
    defaults: {
        // The name of the executable.
        processName: '',
        // Restart the app if it doesn't start up in this much time.
        startupTimeout: 10,
        // Restart the app if there's no heartbeat for this much time.
        heartbeatTimeout: 5,
        // After this many app restarts, give up ans restart the whole machine.
        restartMachineAfter: Infinity,
        // How many times the app has been restarted.
        restartCount: 0,
        // Shut down the app according to this schedule.
        shutdownSchedule: null,
        // Shut down the machine according to this schedule.
        shutdownPcSchedule: null,
        // Start up the app according to this schedule.
        startupSchedule: null,
        // Update the content and the app according to this schedule.
        updateSchedule: null,
        // Restart the app according to this schedule.
        restartSchedule: null
    },

    // The first heartbeat since startup, in ms since epoch.
    _firstHeart: null,
    // The most recent heartbeat, in ms since epoch.
    _lastHeart: null,

    // The timeout which restarts the app if no heartbeat is received in heartbeatTimeout seconds.
    _restartTimeout: null,
    // Flag indicating a shutdown was requested but not yet completed.
    _isShuttingDown: false,
    // Flag indicating that a startup was requested but not yet completed.
    _isStartingUp: false,
    // A callback which is passed to startApp(), fired when it's started.
    _startupCallback: null,

    // The timeout which shuts down the app on the appointed schedule.
    _shutdownSchedule: null,
    _shutDownInterval: null,
    // The timeout which shuts down the PC on the appointed schedule.
    _shutdownPcSchedule: null,
    _shutDownPcInterval: null,
    // The timeout which starts up the app on the appointed schedule.
    _startupSchedule: null,
    _startupInterval: null,
    // The timeout which triggers the content updater on the appointed schedule.
    _updateSchedule: null,
    _updateInterval: null,
    // The timeout which restarts the app on the appointed schedule.
    _restartSchedule: null,
    _restartInterval: null,

    initialize: function() {
        BaseModel.prototype.initialize.apply(this);
        comm.oscFromApp.on('heart', _.bind(this._onHeart, this));

        this._initSchedules();
        if (this._shouldBeRunning()) {
            this.restartApp();
        } else {
            this.shutdownApp();
        }

        comm.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    _onConnection: function(socket) {
        socket.on('restart-app', _.bind(function() {
            logger.info('Restart requested from console.');
            this.restartApp();
        }, this));

        socket.on('shutdown-app', _.bind(function() {
            logger.info('Shutdown requested from console.');
            this.shutdownApp();
        }, this));

        socket.on('restart-pc', _.bind(function() {
            logger.info('Reboot requested from console.');
            this.restartMachine();
        }, this));

        socket.on('shutdown-pc', _.bind(function() {
            logger.info('Shutdown requested from console.');
            this.shutdownMachine();
        }, this));

        socket.on('start', _.bind(function() {
            logger.info('Startup requested from console.');
            this.startApp();
        }, this));
    },

    _initSchedules: function() {
        // Important to configure later to not use UTC.
        later.date.localTime();

        // Shutdown on schedule.
        if (this.get('shutdownSchedule')) {
            this._shutdownSchedule = later.parse.cron(this.get('shutdownSchedule'));
            if (this._shutdownInterval) {
                this._shutdownInterval.clear();
            }

            this._shutdownInterval = later.setInterval(_.bind(function() {
                logger.info('Shutdown time has arrived. ' + new Date());
                this.set('restartCount', 0);
                this.shutdownApp();
            }, this), this._shutdownSchedule);
        }

        // Shutdown on schedule.
        if (this.get('shutdownPcSchedule')) {
            this._shutdownPcSchedule = later.parse.cron(this.get('shutdownPcSchedule'));
            if (this._shutdownPcInterval) {
                this._shutdownPcInterval.clear();
            }

            this._shutdownPcInterval = later.setInterval(_.bind(function() {
                logger.info('Shutdown time has arrived. ' + new Date());
                this.set('restartCount', 0);
                this.shutdownMachine();
            }, this), this._shutdownPcSchedule);
        }

        // Start up on schedule.
        if (this.get('startupSchedule')) {
            this._startupSchedule = later.parse.cron(this.get('startupSchedule'));
            if (this._startupInterval) {
                this._startupInterval.clear();
            }

            this._startupInterval = later.setInterval(_.bind(function() {
                logger.info('Startup time has arrived. ' + new Date());
                this.set('restartCount', 0);
                this.startApp();
            }, this), this._startupSchedule);
        }

        // Start up on schedule.
        if (this.get('restartSchedule')) {
            this._restartSchedule = later.parse.cron(this.get('restartSchedule'));
            if (this._restartInterval) {
                this._restartInterval.clear();
            }

            this._restartInterval = later.setInterval(_.bind(function() {
                logger.info('Restart time has arrived. ' + new Date());
                this.set('restartCount', 0);
                this.restartApp();
            }, this), this._restartSchedule);
        }

        // Update content on schedule.
        if (this.get('updateSchedule')) {
            this._updateSchedule = later.parse.cron(this.get('updateSchedule'));
            if (this._updateInterval) {
                this._updateInterval.clear();
            }

            this._updateInterval = later.setInterval(_.bind(function() {
                logger.info('Update time has arrived. ' + new Date());
                this.set('restartCount', 0);

                function doUpdate(callback) {
                    serverState.update(serverState.get('appUpdater'), _.bind(function() {
                        serverState.update(serverState.get('contentUpdater'), callback);
                    }, this));
                }

                if (serverState.get('appState').get('isRunning')) {
                    this.shutdownApp(_.bind(function() {
                        doUpdate(_.bind(function() {
                            this.restartApp();
                        }, this));
                    }, this));
                } else {
                    doUpdate();
                }

            }, this), this._updateSchedule);
        }
    },

    _shouldBeRunning: function() {
        if (!this._startupSchedule || !this._shutdownSchedule) {
            return true;
        }

        var lastStartup = later.schedule(this._startupSchedule).prev().getTime();
        var lastShutdown = later.schedule(this._shutdownSchedule).prev().getTime();
        return lastStartup > lastShutdown;
    },

    _onHeart: function(message) {
        this._resetRestartTimeout(this.get('heartbeatTimeout'));
        if (!this._lastHeart) {
            this._isStartingUp = false;
            this._firstHeart = Date.now();
            logger.info('App started.');
            if (this._startupCallback) {
                this._startupCallback();
                this._startupCallback = null;
            }
        }

        this._lastHeart = Date.now();
        this.trigger('heart');
    },

    _resetRestartTimeout: function(time) {
        clearTimeout(this._restartTimeout);
        if (!this._isShuttingDown) {
            this._restartTimeout = setTimeout(_.bind(this._onRestartTimeout, this), time * 1000);
        }
    },

    _onRestartTimeout: function() {
        var restartCount = this.get('restartCount');
        restartCount++;
        logger.error('App went away.', restartCount);
        this.trigger('crash');

        if (restartCount >= this.get('restartMachineAfter')) {
            logger.info('Already restarted app ' + this.get('restartMachineAfter') + ' times, rebooting machine.');
            this.restartMachine();
            return;
        }

        this.set('restartCount', restartCount);
        this._isStartingUp = false;
        this._isShuttingDown = false;
        this.restartApp();
    },

    _isAppRunning: function(callback) {
        if (!callback) {
            return;
        }

        if (!this.get('processName')) {
            callback(false);
            return;
        }

        var process = this.get('processName').toUpperCase();
        child_process.exec('tasklist /FI "IMAGENAME eq ' + process + '"', _.bind(function(error, stdout, stderr) {
            var isRunning = stdout.toUpperCase().indexOf(process) != -1;
            callback(isRunning);
        }, this));
    },

    shutdownApp: function(callback) {
        if (this._isShuttingDown) {
            return;
        }

        this._isShuttingDown = true;

        // See if the app is running.
        this._isAppRunning(_.bind(function(isRunning) {
            if (!isRunning) {
                this._isShuttingDown = false;
                // Nope, not running.
                if (callback) {
                    callback();
                }

                return;
            }

            // Kill the app.
            clearTimeout(this._restartTimeout);
            var process = this.get('processName').toUpperCase();
            if (!process) {
                callback();
                return;
            }

            child_process.exec('taskkill /IM ' + process + ' /T /F', _.bind(function(error, stdout, stderr) {

                // Check on an interval to see if it's dead.
                var check = setInterval(_.bind(function() {
                    this._isAppRunning(_.bind(function(isRunning) {
                        if (isRunning) {
                            return;
                        }

                        clearInterval(check);
                        logger.info('App shut down by force.');
                        this._isShuttingDown = false;
                        if (callback) {
                            callback();
                        }
                    }, this));
                }, this), 250);
            }, this));
        }, this));
    },

    startApp: function(callback) {
        if (this._isStartingUp || !this._shouldBeRunning() || !this.get('processName')) {
            return;
        }

        this._isStartingUp = true;
        this._isAppRunning(_.bind(function(isRunning) {
            if (isRunning) {
                // It's already running.
                this._isStartingUp = false;
                if (callback) {
                    callback(true);
                }

                return;
            }

            // Config length limited to 8191 characters. (DOT was about 1200)
            this._lastHeart = null;
            this._firstHeart = null;
            this._startupCallback = callback;

            // Start the app.
            var appPath = path.resolve(path.join(serverState.get('appUpdater').get('local'), this.get('processName')));
            fs.exists(appPath, _.bind(function(exists) {
                if (!exists) {
                    this._isStartingUp = false;
                    logger.error('Application not found.');
                    serverState.update(serverState.get('appUpdater'), _.bind(function() {
                        this.restartApp();
                    }, this));
                    return;
                }

                logger.info('App starting up.');
                child_process.spawn(appPath, [JSON.stringify(config)], {
                    cwd: path.dirname(appPath)
                });
                this._resetRestartTimeout(this.get('startupTimeout'));
            }, this));
        }, this));
    },

    restartApp: function() {
        this.shutdownApp(_.bind(this.startApp, this));
    },

    shutdownMachine: function() {
        if (this._isShuttingDown) {
            return;
        }
        this._isShuttingDown = true;

        // Shutdown but wait a bit to log things.
        // -S - shutdown local machine
        // -C - shutdown message
        // -T 0 - shutdown now
        // -F - don't wait for anything to shut down gracefully
        setTimeout(child_process.exec('shutdown -S -T 0 -F -C "ampm shutdown"'), 3000);
    },

    restartMachine: function() {
        if (this._isShuttingDown) {
            return;
        }
        this._isShuttingDown = true;

        // Restart but wait a bit to log things.
        // -R - restart
        // -C - shutdown message
        // -T 0 - shutdown now
        // -F - don't wait for anything to shut down gracefully
        setTimeout(child_process.exec('shutdown -R -T 0 -F -C "ampm restart"'), 3000);
    }
});