var child_process = require('child_process'); // http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
var path = require('path'); //http://nodejs.org/api/path.html

var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var later = require('later'); // Schedule processing. http://bunkat.github.io/later/ 

var BaseModel = require('./baseModel.js').BaseModel;

exports.Persistence = BaseModel.extend({
    defaults: {
        // Restart the app if there's no heartbeat for this much time.
        restartAppAfter: 5000,
        // After this many app restarts, give up ans restart the whole machine.
        restartMachineAfter: 5,
        // How many times the app has been restarted.
        restartCount: 0,

        /*
        // http://www.generateit.net/cron-job/
        minute  0-59    The exact minute that the command sequence executes
        hour    0-23    The hour of the day that the command sequence executes
        day     1-31    The day of the month that the command sequence executes
        month   1-12    The month of the year that the command sequence executes
        weekday 0-6     The day of the week that the command sequence executes. Sunday=0, Monday = 1, Tuesday = 2, and so forth.
        */

        // Shut down the app according to this schedule.
        shutdownSchedule: "0 0 * * 1-5", // Midnight, M-F
        // Start up the app according to this schedule.
        startupSchedule: "0 8 * * 1-5", // 8a, M-F

        // The first heartbeat since startup, in ms since epoch.
        firstHeart: null,
        // The most recent heartbeat, in ms since epoch.
        lastHeart: null
    },

    // The timeout which restarts the app if no heartbeat is received in restartAppAfter ms.
    _restartTimeout: null,
    // The timeout which shuts down the app on the appointed schedule.
    _shutDownTimeout: null,
    // The timeout which starts up the app on the appointed schedule.
    _startupTimeout: null,
    // Flag indicating a shutdown was requested but not yet completed.
    _isShuttingDown: false,
    // Flag indicating that a startup was requested but not yet completed.
    _isStartingUp: false,
    // A callback which is passed to startApp(), fired when it's started.
    _startupCallback: null,

    initialize: function() {
        // Important to configure later to not use UTC.
        later.date.localTime();

        this._setupSchedule();
        this.on('change:shutdownSchedule', _.bind(this._setupSchedule, this));
        this.on('change:startupSchedule', _.bind(this._setupSchedule, this));

        comm.fromApp.on('heart', _.bind(this._onHeart, this));
    },

    _setupSchedule: function() {
        this._restartTimeout = 0;

        if (this._shutdownTimeout) {
            this._shutdownTimeout.clear();
        }

        this._shutdownTimeout = later.setTimeout(_.bind(function() {
            console.log('Shutdown time has arrived.');
            this.shutdownApp(_.bind(function() {
                this._setupSchedule();
            }, this));
        }, this), later.parse.cron(this.get('shutdownSchedule')));

        if (this._startupTimeout) {
            this._startupTimeout.clear();
        }

        this._startupTimeout = later.setTimeout(_.bind(function() {
            console.log('Startup time has arrived.');
            this.startApp(_.bind(function() {
                this._setupSchedule();
            }, this));
        }, this), later.parse.cron(this.get('startupSchedule')));
    },

    _onHeart: function(message) {
        this._resetRestartTimeout();
        if (!this.get('lastHeart')) {
            this._isStartingUp = false;
            this.set('firstHeart', Date.now());
            console.log('App started.');
            if (this._startupCallback) {
                this._startupCallback();
                this._startupCallback = null;
            }
        }

        this.set('lastHeart', Date.now());
    },

    _resetRestartTimeout: function() {
        clearTimeout(this._restartTimeout);
        if (!this._isShuttingDown) {
            this._restartTimeout = setTimeout(_.bind(this._onRestartTimeout, this), this.get('restartAppAfter'));
        }
    },

    _onRestartTimeout: function() {
        var restartCount = this.get('restartCount');
        restartCount++;
        console.log('App went away. ' + restartCount);

        if (restartCount >= this.get('restartMachineAfter')) {
            this._restartMachine();
            return;
        }

        this.set('restartCount', restartCount);
        this.restartApp();
    },

    _isAppRunning: function(callback) {
        if (!callback) {
            return;
        }

        var process = serverState.get('appUpdater').get('processName').toUpperCase();
        child_process.exec('tasklist /FI "IMAGENAME eq ' + process + '"', function(error, stdout, stderr) {
            var isRunning = stdout.toUpperCase().indexOf(process) != -1;
            callback(isRunning);
        });
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
            var process = serverState.get('appUpdater').get('processName').toUpperCase();
            child_process.exec('taskkill /IM ' + process + ' /F', _.bind(function(error, stdout, stderr) {
                console.log('App shut down by force.');
                this._isShuttingDown = false;
                if (callback) {
                    callback();
                }
            }, this));
        }, this));
    },

    startApp: function(callback) {
        if (this._isStartingUp) {
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

            // Start the app.
            var appUpdater = serverState.get('appUpdater');
            var appPath = path.join(appUpdater.get('local'), appUpdater.get('processName'));

            // Config length limited to 8191 characters. (DOT was about 1200)
            this.set('lastHeart', null);
            this.set('firstHeart', null);
            this._startupCallback = callback;
            child_process.spawn(appPath, [JSON.stringify(config)]);
            console.log('App starting up.');
        }, this));
    },

    restartApp: function() {
        this.shutdownApp(_.bind(this.startApp, this));
    },

    _restartMachine: function() {
        console.log('Already restarted app ' + this.get('restartMachineAfter') + ' times, rebooting machine.');

        // Restart but wait a bit to log things.
        // /t 0 - shutdown now
        // /r - restart
        // /f - don't wait for anything to shut down gracefully
        setTimeout(child_process.exec('shutdown /T 0 /R /F'), 3000);
    }
});