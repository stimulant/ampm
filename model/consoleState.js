var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var XRegExp = require('xregexp').XRegExp; // Fancy regular expressions. http://xregexp.com/

var BaseModel = require('./baseModel.js').BaseModel;

// Manager of state which is displayed on the console, and responder of commands sent from the
// console.
exports.ConsoleState = BaseModel.extend({
    defaults: {
        isRunning: false,
        uptime: 0,
        fps: null,
        cpu: null,
        memory: null,
        canUpdate: false,
        isUpdating: false
    },

    // How often to update stats.
    _updateStatsRate: 1000,

    // How many updates of historical data to keep.
    _statHistory: 60,
    _statIndex: 0,

    // The interval to update stats.
    _updateStatsTimeout: 0,

    // A timeout to throttle the speed of updates to the console.
    _updateConsoleTimeout: 0,
    _updateConsoleRate: 1000 / 30,

    // The last time the app was running to compute uptime.
    _startupTime: 0,

    // Set up update loops.
    initialize: function() {
        BaseModel.prototype.initialize.apply(this);
        this.set('canUpdate', (($$contentUpdater.get('remote') && true) || ($$appUpdater.get('remote') && true)) === true);
        $$persistence.on('heart', this._onHeart, this);
        this._updateStats();
        this._updateCpu();
        $$network.transports.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    // Build an object representing the whole configuration of the server. Sent to the console on
    // initial connection, also useful to spew for documentation.
    fullConfig: function() {
        return {
            network: $$network.attributes,
            contentUpdater: $$contentUpdater.attributes,
            appUpdater: $$appUpdater.attributes,
            persistence: $$persistence.attributes,
            logging: $$logging.attributes
        };
    },

    // On initial socket connection with the console, listen for commands and send out the config.
    _onConnection: function(socket) {

        // Responsd to requests for appState updates, but throttle it to _updateConsoleRate.
        var updateConsole = _.bind(this._updateConsole, this);
        socket.on('appStateRequest', _.bind(function() {
            clearTimeout(this._updateConsoleTimeout);
            this._updateConsoleTimeout = setTimeout(updateConsole, this._updateConsoleRate);
        }, this));

        socket.on('setUpdaterSource', _.bind(this.setUpdaterSource, this));
        socket.on('updateUpdater', _.bind(this.updateUpdater, this));
        socket.on('rollbackUpdater', _.bind(this.rollbackUpdater, this));

        socket.on('restart-app', _.bind(function() {
            logger.info('Restart requested from console.');
            $$persistence.restartApp();
        }, this));

        socket.on('shutdown-app', _.bind(function() {
            logger.info('Shutdown requested from console.');
            $$persistence.shutdownApp();
        }, this));

        socket.on('restart-pc', _.bind(function() {
            logger.info('Reboot requested from console.');
            $$persistence.restartMachine();
        }, this));

        socket.on('shutdown-pc', _.bind(function() {
            logger.info('Shutdown requested from console.');
            $$persistence.shutdownMachine();
        }, this));

        socket.on('start', _.bind(function() {
            logger.info('Startup requested from console.');
            $$persistence.startApp();
        }, this));

        $$network.transports.socketToConsole.sockets.emit('config', this.fullConfig());
    },

    // Send the console new data on an interval.
    _updateConsole: function() {
        var message = _.clone(this.attributes);
        message.restartCount = $$persistence.get('restartCount');
        message.logs = $$logging.get('logCache');
        message.events = $$logging.get('eventCache');
        message.canUpdate = this.get('canUpdate');

        message.updaters = {
            content: {
                isUpdating: $$contentUpdater.get('isUpdating'),
                canRollback: $$contentUpdater.get('canRollback'),
                source: $$contentUpdater.get('source')
            },
            app: {
                isUpdating: $$appUpdater.get('isUpdating'),
                canRollback: $$appUpdater.get('canRollback'),
                source: $$appUpdater.get('source')
            }
        };

        $$network.transports.socketToConsole.sockets.emit('appState', message);
    },

    // Update the internal objects which specify the FPS, whether the app is running, memory usage,
    // and uptime.
    _updateStats: function() {
        var fpsHistory = this.get('fps');
        var memoryHistory = this.get('memory');

        if (!fpsHistory || !memoryHistory) {
            fpsHistory = [];
            memoryHistory = [];
            this.set({
                fps: fpsHistory,
                memory: memoryHistory
            });
        }

        // Update FPS.
        var fps = 1000 / (this._tickSum / this._maxTicks);
        fps *= 100;
        fps = Math.round(fps);
        fps /= 100;
        fpsHistory.push(fps);
        while (fpsHistory.length > this._statHistory) {
            fpsHistory.shift();
        }

        clearTimeout(this._updateStatsTimeout);
        var process = $$persistence.get('processName').toUpperCase();
        if (!process) {
            this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateStatsRate);
            return;
        }

        // Is the app running?
        child_process.exec('tasklist /FI "IMAGENAME eq ' + process + '" /FO LIST', _.bind(function(error, stdout, stderr) {

            // Update isRunning.
            var wasRunning = this.get('isRunning');
            var isRunning = stdout.toUpperCase().indexOf(process) != -1;
            this.set('isRunning', isRunning);

            if (!isRunning) {
                // Not running, so reset everything.
                this.set('uptime', 0);
                this.set({
                    fps: null,
                    memory: null
                });

                this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateStatsRate);
                return;
            }

            // Update the uptime.
            if (isRunning && !wasRunning) {
                this._startupTime = Date.now();
            }

            this.set('uptime', isRunning ? Date.now() - this._startupTime : 0);

            /*
            // tasklist.exe output looks like this:
            Image Name:   Client.exe
            PID:          12008
            Session Name: Console
            Session#:     1
            Mem Usage:    39,384 K
            */

            // Update the memory.
            var memory = parseInt(stdout.split('\r\n')[5].split('    ')[1].split(' ')[0].replace(',', ''), 10) * 1024;
            memoryHistory.push(memory);
            while (memoryHistory.length > this._statHistory) {
                memoryHistory.shift();
            }

            this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateStatsRate);
        }, this));
    },

    // Run typeperf to get total CPU usage -- haven't figured out how to get it per process.
    _updateCpu: function() {
        this._typeperf = child_process.spawn('typeperf', ['\\Processor(_Total)\\% Processor Time']);
        this._typeperf.stdout.on('data', _.bind(function(data) {

            data = data.toString();
            if (data && data.indexOf(',') === 0) {
                var cpu = parseFloat(data.substr(2, data.length - 3));
                if (!isNaN(cpu)) {
                    var cpuHistory = this.get('cpu');
                    if (!cpuHistory) {
                        cpuHistory = [];
                        this.set('cpu', cpuHistory);
                    }

                    cpuHistory.push(cpu);
                    while (cpuHistory.length > this._statHistory) {
                        cpuHistory.shift();
                    }
                }
            }
        }, this));
    },

    // Compute FPS in a fast way. http://stackoverflow.com/a/87732/468472
    _maxTicks: 180,
    _tickList: null,
    _tickSum: 0,
    _tickIndex: 0,
    _lastHeart: 0,

    // Update the FPS whenever a heartbeat message is received from the app.
    _onHeart: function(message) {
        if (!this._tickList) {
            this._tickList = [];
            while (this._tickList.length < this._maxTicks) {
                this._tickList.push(0);
            }
        }

        if (!this._lastHeart) {
            this._lastHeart = Date.now();
            this._lastFpsUpdate = this._lastHeart;
            return;
        }

        var newHeart = Date.now();
        var newTick = newHeart - this._lastHeart;
        this._lastHeart = newHeart;

        this._tickSum -= this._tickList[this._tickIndex];
        this._tickSum += newTick;
        this._tickList[this._tickIndex] = newTick;
        if (++this._tickIndex == this._maxTicks) {
            this._tickIndex = 0;
        }
    },

    // Change the source used by one of the updaters.
    setUpdaterSource: function(updater, source) {
        if (_.isString(updater)) {
            updater = global['$$' + updater + 'Updater'];
        }

        if (source == updater.get('source')) {
            return;
        }

        updater.set('source', source);

        fs.exists(updater.get('temp')[source], _.bind(function(exists) {
            if (exists) {
                this._deployUpdater(updater, true);
            } else {
                this.updateUpdater(updater);
            }
        }, this));
    },

    // Trigger an update on one of the updaters.
    updateUpdater: function(updater, callback) {
        if (_.isString(updater)) {
            updater = global['$$' + updater + 'Updater'];
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

            this._deployUpdater(updater, false);
        }, this));
    },

    // Deploy content downloaded by one of the updaters.
    _deployUpdater: function(updater, force) {
        if (_.isString(updater)) {
            updater = global['$$' + updater + 'Updater'];
        }

        $$persistence.shutdownApp(_.bind(function() {
            updater.deploy(force, _.bind(function(error) {
                if (error) {
                    return;
                }

                logger.info(updater.get('name') + ' deploy complete!');
                if (updater.get('name') == 'app') {
                    $$persistence.restartServer();
                } else {
                    $$persistence.restartApp();
                }
            }, this));
        }, this));
    },

    // Shut down the app, roll back content, and restart it.
    rollbackUpdater: function(updater) {
        if (_.isString(updater)) {
            updater = global['$$' + updater + 'Updater'];
        }

        $$persistence.shutdownApp(_.bind(function() {
            updater.rollBack(_.bind(function(error) {
                if (error) {
                    return;
                }

                logger.info('Rollback complete!');
                if (updater.get('name') == 'app') {
                    $$persistence.restartServer();
                } else {
                    $$persistence.restartApp();
                }
            }, this));
        }, this));
    }
});
