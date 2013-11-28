var child_process = require('child_process'); // http://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
var path = require('path'); //http://nodejs.org/api/path.html

var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var later = require('later'); // Schedule processing. http://bunkat.github.io/later/ 

var BaseModel = require('./baseModel.js').BaseModel;

exports.Persistence = BaseModel.extend({
    defaults: {
        restartAppAfter: 5000,
        restartMachineAfter: 5,

        // http://www.generateit.net/cron-job/
        // M-F at midnight
        shutdownSchedule: "0 0 * * 1-5",
        // M-F at 8a
        startupSchedule: "0 0 * * 1-5",

        firstHeart: null,
        lastHeart: null,
        restartCount: 0
    },

    _restartTimeout: null,

    initialize: function() {
        comm.fromApp.on('heart', _.bind(this._onHeart, this));
    },

    _onHeart: function(message) {
        this._resetRestartTimeout();
        if (!this.get('lastHeart')) {
            this.set('firstHeart', moment());
            console.log('App started.');
        }

        this.set('lastHeart', moment());
    },

    _resetRestartTimeout: function() {
        clearTimeout(this._restartTimeout);
        this._restartTimeout = setTimeout(_.bind(this._onRestartTimeout, this), this.get('restartAppAfter'));
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
            callback(stdout.toUpperCase().indexOf(process) != -1);
        });
    },

    shutdownApp: function(callback) {
        // See if the app is running.
        this._isAppRunning(function(isRunning) {
            if (!isRunning) {
                // Nope, not running.
                if (callback) {
                    callback();
                }

                return;
            }

            // Kill the app.
            clearTimeout(this._restartTimeout);
            var process = serverState.get('appUpdater').get('processName').toUpperCase();
            child_process.exec('taskkill /IM ' + process + ' /F', function(error, stdout, stderr) {
                console.log('App shut down by force.');
                if (callback) {
                    callback();
                }
            });
        });
    },

    startApp: function() {
        var shutdown = later.parse.cron(this.get('shutdownSchedule'));
        var startup = later.parse.cron(this.get('startupSchedule'));
        var nextShutdown = later.schedule(shutdown).next();
        nextShutdown = new Date(nextShutdown.getTime() + 480 * 60 * 1000);
        console.log(nextShutdown);

        this._isAppRunning(_.bind(function(isRunning) {
            if (isRunning) {
                // It's already running.
                return;
            }

            // Start the app.
            var appUpdater = serverState.get('appUpdater');
            var appPath = path.join(appUpdater.get('local'), appUpdater.get('processName'));

            // Config length limited to 8191 characters. (DOT was about 1200)
            this.set('lastHeart', null);
            this.set('firstHeart', null);
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