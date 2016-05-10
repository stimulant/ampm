var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var XRegExp = require('xregexp'); // Fancy regular expressions. http://xregexp.com/

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
        configs: []
    },

    // The interval to update stats.
    _updateStatsTimeout: 0,
    _updateMemoryTimeout: 0,
    _updateStatsRate: 1000,

    // How many updates of historical data to keep.
    _statHistory: 60,
    _statIndex: 0,

    // A console process in which TYPEPERF is run continuously to update CPU usage on Windows.
    _cpuConsole: null,

    // A console process in which 'top' is run continuously to update CPU and memory usage on Mac.
    _topConsole: null,

    // A timeout to throttle the speed of updates to the console.
    _updateConsoleTimeout: 0,
    _updateConsoleRate: 1000 / 1,

    // The last time the app was running to compute uptime.
    _startupTime: 0,

    // Set up update loops.
    initialize: function() {
        BaseModel.prototype.initialize.apply(this);

        $$persistence.on('heart', this._onHeart, this);
        this._updateStats();
        this._updateCpuWin();
        this._updateMemoryWin();
        this._updateMemoryCpuMac();
        $$network.transports.socketToConsole.sockets.on('connection', _.bind(this._onConnection, this));
    },

    // Build an object representing the whole configuration of the server.
    fullConfig: function(user) {
        var config = _.cloneDeep($$config);

        var network = _.cloneDeep($$network.attributes);
        delete network.config;

        var persistence = _.cloneDeep($$persistence.attributes);
        delete persistence.config;

        var logging = _.cloneDeep($$logging.attributes);
        delete logging.config;
        delete logging.logCache;
        delete logging.eventCache;

        var permissions = user ? $$config.permissions[user] : null;

        return _.merge(_.cloneDeep($$config), {
            network: network,
            persistence: persistence,
            logging: logging,
            permissions: permissions
        });
    },

    // On initial socket connection with the console, listen for commands and send out the config.
    _onConnection: function(socket) {

        var username = null;
        var permissions = null;
        if (socket.handshake.headers.authorization) {
            username = socket.handshake.headers.authorization.match(/username="([^"]+)"/)[1];
            permissions = $$config.permissions ? $$config.permissions[username] : null;
        }

        // Responds to requests for appState updates, but throttle it to _updateConsoleRate.
        var updateConsole = _.bind(this._updateConsole, this);
        socket.on('appStateRequest', _.bind(function() {
            clearTimeout(this._updateConsoleTimeout);
            this._updateConsoleTimeout = setTimeout(updateConsole, this._updateConsoleRate);
        }, this));

        socket.on('start', _.bind(function() {
            if (permissions && !permissions.app) {
                return;
            }

            logger.info('Startup requested from console.');
            $$serverState.saveState('runApp', true);
            $$persistence.startApp(true);
        }, this));

        socket.on('restart-app', _.bind(function() {
            if (permissions && !permissions.app) {
                return;
            }

            logger.info('Restart requested from console.');
            $$serverState.saveState('runApp', true);
            $$persistence.restartApp(true);
        }, this));

        socket.on('shutdown-app', _.bind(function() {
            if (permissions && !permissions.app) {
                return;
            }

            logger.info('Shutdown requested from console.');
            $$serverState.saveState('runApp', false);
            $$persistence.shutdownApp();
        }, this));

        socket.on('restart-pc', _.bind(function() {
            if (permissions && !permissions.computer) {
                return;
            }

            logger.info('Reboot requested from console.');
            $$persistence.restartMachine();
        }, this));

        socket.on('shutdown-pc', _.bind(function() {
            if (permissions && !permissions.computer) {
                return;
            }

            logger.info('Shutdown requested from console.');
            $$persistence.shutdownMachine();
        }, this));

        socket.on('switchConfig', _.bind(function(config) {
            $$serverState.saveState('config', config, $$persistence.restartServer);
        }, this));

        $$network.transports.socketToConsole.sockets.emit('config', this.fullConfig(username), this.get('configs'));
    },

    // Send the console new data on an interval.
    _updateConsole: function() {
        var message = _.clone(this.attributes);
        message.restartCount = $$persistence.get('restartCount');
        message.logs = $$logging.get('logCache');
        message.events = $$logging.get('eventCache');

        $$network.transports.socketToConsole.sockets.emit('appState', message);
    },

    // Update the internal objects which specify the FPS, whether the app is running, memory usage,
    // and uptime.
    _updateStats: function() {
        var fpsHistory = this.get('fps');

        if (!fpsHistory) {
            fpsHistory = [];
            this.set({
                fps: fpsHistory,
            });
        }

        // Update FPS.
        if (this._tickSum) {
            var fps = 1000 / (this._tickSum / this._maxTicks);
            fps *= 100;
            fps = Math.round(fps);
            fps /= 100;
            fpsHistory.push(fps);
            while (fpsHistory.length > this._statHistory) {
                fpsHistory.shift();
            }
        }

        if ($$persistence.processId()) {
            // Update the uptime.
            var wasRunning = this.get('isRunning');
            if (!wasRunning) {
                this._startupTime = Date.now();
            }
            this.set('uptime', Date.now() - this._startupTime);
            this.set('isRunning', true);
        } else {
            // Not running, so reset everything.
            this.set({
                isRunning: false,
                fps: null,
                memory: null,
                uptime: 0
            });
        }

        clearTimeout(this._updateStatsTimeout);
        this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateStatsRate);
    },

    // Request to update the memory.
    _updateMemoryWin: function() {
        if (process.platform !== 'win32') {
            return;
        }

        var id = $$persistence.processId();
        if (id) {
            child_process.exec('tasklist /FI "PID eq ' + id + '" /FO LIST', _.bind(function(error, stdout, stderror) {
                /*
                // tasklist.exe output looks like this:
                Image Name:   Client.exe
                PID:          12008
                Session Name: Console
                Session#:     1
                Mem Usage:    39,384 K
                */

                stdout = stdout.toString();
                var match = XRegExp.exec(stdout, XRegExp('[\\d,]+\\sK'));
                if (!match) {
                    return;
                }

                match = match[0]; // "39,384 K"
                match = match.replace(',', '').replace(' K', ''); // "39384"
                var memory = parseInt(match) * 1024; // 40329216
                this._memoryFrame(memory);

                clearTimeout(this._updateMemoryWinTimeout);
                this._updateMemoryWinTimeout = setTimeout(_.bind(this._updateMemoryWin, this), this._updateStatsRate);

                $$persistence.checkMemory(memory);
            }, this));
        } else {
            clearTimeout(this._updateMemoryWinTimeout);
            this._updateMemoryWinTimeout = setTimeout(_.bind(this._updateMemoryWin, this), this._updateStatsRate);
        }
    },

    // Run typeperf to get total CPU usage -- haven't figured out how to get it per process.
    _updateCpuWin: function() {
        if (process.platform !== 'win32') {
            return;
        }

        this._cpuConsole = child_process.spawn('typeperf', ['\\Processor(_Total)\\% Processor Time']);
        this._cpuConsole.stdout.on('data', _.bind(function(stdout) {

            stdout = stdout.toString();
            if (stdout && stdout.indexOf(',') === 0) {
                var cpu = parseFloat(stdout.substr(2, stdout.length - 3));
                this._cpuFrame(cpu);
            }
        }, this));
    },

    // Run 'top' to get the CPU and memory usage of the app process on Mac.
    _updateMemoryCpuMac: function() {
        if (process.platform !== 'darwin') {
            return;
        }

        // top is running in logging mode, spewing process info to stdout every second.
        this._topConsole = child_process.spawn('/usr/bin/top', ['-l', '0', '-stats', 'pid,cpu,mem,command']);
        this._topConsole.stdout.on('data', _.bind(function(stdout) {
            var id = $$persistence.processId();
            if (!id) {
                return;
            }

            // Find the line with the process id that matches what we're watching.
            stdout = stdout.toString();
            var lines = stdout.split('\n');
            var line = lines.filter(function(line) {
                return line.indexOf(id) === 0;
            })[0];
            if (!line) {
                return;
            }
            var parts = line.split(/\s+/g);

            // Add to the CPU history.
            var cpu = parseFloat(parts[1]);
            this._cpuFrame(cpu);

            // Add to the memory history.
            var memory = parts[2];
            var unit = 1;
            if (memory.indexOf('K') !== -1) {
                unit = 1024;
            } else if (memory.indexOf('M') !== -1) {
                unit = 1024 * 1024;
            } else if (memory.indexOf('G') !== -1) {
                unit = 1024 * 1024 * 1024;
            }
            memory = memory.replace(/[\D]/g, '');
            memory = parseInt(memory) * unit;
            this._memoryFrame(memory);

        }, this));
    },

    // Add a CPU sample to the history.
    _cpuFrame: function(cpu) {
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
    },

    // Add a memory usage sample to the history.
    _memoryFrame: function(memory) {
        var memoryHistory = this.get('memory');

        if (!memoryHistory) {
            memoryHistory = [];
            this.set({
                memory: memoryHistory
            });
        }

        memoryHistory.push(memory);
        while (memoryHistory.length > this._statHistory) {
            memoryHistory.shift();
        }
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
    }
});
