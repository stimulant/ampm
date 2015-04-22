var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var path = require('path'); //http://nodejs.org/api/path.html
var fs = require('node-fs'); // Recursive directory creation. https://github.com/bpedro/node-fs

var _ = require('lodash'); // Utilities. http://underscorejs.org/
_.str = require('underscore.string');
var moment = require('moment'); // Date processing. http://momentjs.com/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var later = require('later'); // Schedule processing. http://bunkat.github.io/later/ 

var BaseModel = require('./baseModel.js').BaseModel;

// Startup and shutdown the app on demand and on schedule.
exports.Persistence = BaseModel.extend({
    defaults: {
        // The command to run to launch the client, relative to server.js.
        // {config} will be replaced with the contents of the config file.
        launchCommand: "",

        // The command to run to launch a parallel process, relative to
        // server.js. {config} will be replaced with the contents of the config
        // file. This process will be stopped and started at the same time as the
        // main process.
        sideCommand: "",

        // A command to run after the first heartbeat to do any additional
        // system configuration.
        postLaunchCommand: "",

        // Restart the app if it doesn't start up in this much time. Set to
        // zero (default) to allow the app to take forever to start up.
        startupTimeout: 0,

        // Restart the app this many seconds of no heartbeat messages. Set to
        // zero (default) to never restart due to lack of heartbeats.
        heartbeatTimeout: 0,

        // Restart the machine after this many app restarts.
        restartMachineAfter: Infinity,

        // Shut down the app on this schedule -- see cronmaker.com for the format.
        shutdownSchedule: null,

        // Shut down the PC on this schedule -- see cronmaker.com for the format.
        shutdownPcSchedule: null,

        // Start up the app on this schedule -- see cronmaker.com for the format.
        startupSchedule: null,

        // Update the content and app on this schedule -- see cronmaker.com for the format.
        updateSchedule: null,

        // Restart the app on this schedule -- see cronmaker.com for the format. 
        restartSchedule: null,

        // How many times the app has been restarted.
        restartCount: 0,

        // Whether or not the Windows cursor should be hidden by default.
        // ctrl-shift-0 will also hide it, and ctrl-shift-1 will show it.
        hideCursor: false,

        // An array of hosts to ping and send alerts if not responsive.
        pingList: null,

        // Number of missed pings to the ping list before sending out an alert.
        pingLostCount: 5,

        // Restart the app if it uses more than this much memory.
        maxMemory: Infinity
    },

    // The spawned application process.
    _appProcess: null,
    // The spawned side process.
    _sideProcess: null,

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

        // Desktop apps will send hearts over OSC.
        $$network.transports.oscFromApp.on('heart', _.bind(this._onHeart, this));

        // Web apps will send them over the app socket.
        $$network.transports.socketToApp.sockets.on('connection', _.bind(function(socket) {
            socket.on('heart', _.bind(this._onHeart, this));
            socket.emit('config', $$config);
        }, this));

        this._initSchedules();
        this._initPingList();

        this.on('change:hideCursor', _.bind(this.updateHideCursor, this));
    },

    boot: function() {
        if ($$serverState.get('runApp')) {
            this.startApp();
        } else {
            logger.warn('App was shut down last time, launch it from the console.');
        }
    },

    // Initialize the various cron schedules.
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
                if (!$$serverState.get('runApp')) {
                    logger.info('Startup disabled by console.');
                    return;
                }

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
                if (!$$serverState.get('runApp')) {
                    logger.info('Startup disabled by console.');
                    return;
                }

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
                var isRunning = this.get('appState').get('isRunning');
                this.shutdownApp(_.bind(function() {
                    consoleState.update(appUpdater, _.bind(function() {
                        consoleState.update(contentUpdater, _.bind(function() {
                            if (isRunning) {
                                this.restartServer();
                            }
                        }, this));
                    }, this));
                }, this));

            }, this), this._updateSchedule);
        }
    },

    // Determine whether the app should be running, based on the cron schedules.
    _shouldBeRunning: function() {
        if (!this._startupSchedule || !this._shutdownSchedule) {
            return true;
        }

        var lastStartup = later.schedule(this._startupSchedule).prev().getTime();
        var lastShutdown = later.schedule(this._shutdownSchedule).prev().getTime();
        return lastStartup > lastShutdown;
    },

    // Handle heartbeat messages from the app.
    _onHeart: function(message) {
        this._resetRestartTimeout(this.get('heartbeatTimeout'));
        if (!this._lastHeart) {
            this._isStartingUp = false;
            this._firstHeart = Date.now();
            logger.info('App started.');

            if (this.get('postLaunchCommand')) {
                child_process.exec('start ' + this.get('postLaunchCommand'));
            }

            if (this._startupCallback) {
                this._startupCallback();
                this._startupCallback = null;
            }
        }

        this._lastHeart = Date.now();
        this.trigger('heart');
    },

    // Cancel and reset the timeout that restarts the app.
    _resetRestartTimeout: function(time) {
        clearTimeout(this._restartTimeout);
        if (!time) {
            return;
        }
        if (!this._isShuttingDown) {
            this._restartTimeout = setTimeout(_.bind(this._onRestartTimeout, this), time * 1000);
        }
    },

    // When a heartbeat hasn't been received for a while, restart the app or the whole machine.
    _onRestartTimeout: function() {
        var restartCount = this.get('restartCount');
        restartCount++;

        var logList = 'App went away: ' + restartCount + ' times\n\n';
        _.each($$logging.get('logCache'), function(log) {
            logList += log.time + ' ' + log.level + ': ' + log.msg + '\n';
        });
        logger.error(logList);

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

    processId: function() {
        return this._appProcess ? this._appProcess.pid : 0;
    },

    sideProcessId: function() {
        return this._sideProcess ? this._sideProcess.pid : 0;
    },

    // Kill the app process.
    shutdownApp: function(callback) {
        if (this._isShuttingDown) {
            return;
        }

        this._isShuttingDown = true;

        // See if the app is running.
        if (!this.processId() && !this.sideProcessId()) {
            this._isShuttingDown = false;
            // Nope, not running.
            if (callback) {
                callback();
            }

            return;
        }

        // Kill the app.
        clearTimeout(this._restartTimeout);
        this._appProcess.kill();
        this._sideProcess.kill();

        // Check on an interval to see if it's dead.
        var check = setInterval(_.bind(function() {
            if (this.processId() || this.sideProcessId()) {
                return;
            }

            clearInterval(check);
            logger.info('App shut down by force.');
            this._isShuttingDown = false;
            if (callback) {
                callback();
            }
        }, this), 250);
    },

    // Start the app process.
    startApp: function(force, callback) {

        // Don't start if we're waiting for it to finish starting already.
        var should = !this._isStartingUp;

        // Don't start if we're outside the schedule, unless requested by the console.
        should = should && (this._shouldBeRunning() || force === true);

        // Don't start if it's already running.
        should = should && !this.processId();

        // Don't start if there's no start command.
        should = should && this.get('launchCommand');

        if (!should) {
            return;
        }

        if (this.get('startupTimeout')) {
            this._isStartingUp = true;
        }

        if (this.processId()) {
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

        var parts = this._parseCommand(this.get('launchCommand'));

        if (!fs.existsSync(parts[0])) {
            this._isStartingUp = false;
            logger.error('Application not found.');
            if (callback) {
                callback(false);
            }
            return;
        }

        // Start the app.
        logger.info('App starting up.');
        this._appProcess = child_process.spawn(parts[0], parts.slice(1), {
            cwd: path.dirname(parts[0])
        }).on('exit', _.bind(function() {
            this._appProcess = null;
        }, this));
        this._resetRestartTimeout(this.get('startupTimeout'));

        if (!this.get('sideCommand')) {
            return;
        }

        // Start the side process.
        parts = this._parseCommand(this.get('sideCommand'));
        this._sideProcess = child_process.spawn(parts[0], parts.slice(1), {
            cwd: path.dirname(parts[0])
        }).on('exit', _.bind(function() {
            this._sideProcess = null;
        }, this));
    },

    // Given a command line, parse into an array where the first item is the executable and the rest are the arguments.
    // cmd = "'my command' arg1 arg2 'long arg' {config}"
    _parseCommand: function(cmd) {
        var split = cmd.split(' ');
        var parts = [];
        var i = 0;
        while (i < split.length) {
            var part = split[i];
            var first = part[0];
            if (first == "'" || first == '"') {
                part = part.substr(1);
                var j = i + 1;
                while (j < split.length) {
                    part += ' ' + split[j];
                    var last = part[part.length - 1];
                    if (last == first) {
                        part = part.substr(0, part.length - 1);
                        i = j;
                        break;
                    }

                    j++;
                }
            }

            if (part == '{config}') {
                part = JSON.stringify($$config);
            }

            parts.push(part);
            i++;
        }

        parts[0] = path.resolve(parts[0]);
        return parts;
    },

    // Kill the app process, then start it back up.
    restartApp: function(force, callback) {
        this.shutdownApp(_.bind(function() {
            this.startApp(force, callback);
        }, this));
    },

    // Shut down the whole PC.
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

    // Reboot the whole PC.
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
    },

    // Restart the ampm server via node-administrator.
    restartServer: function() {
        // This should cause node-supervisor to reboot us.
        logger.info('Triggering server restart.');
        fs.writeFile('restart.json', new Date().getTime());
    },

    updateHideCursor: function() {
        var cmd = this.get('hideCursor') ? 'tools/cursor.hide.ahk' : 'tools/cursor.show.ahk';
        child_process.spawn('tools/AutoHotKey.exe', [cmd], {
            detached: true
        }).unref();
    },

    // For each entry in the ping list, set up a process to ping it and an object that represents its status.
    _initPingList: function() {
        var pingList = this.get('pingList');
        if (!pingList) {
            return;
        }

        var self = this;
        this._pingStatus = {};
        for (var i in pingList) {
            var host = pingList[i];
            var p = child_process.spawn('ping', ['-t', host]);

            /* jshint ignore:start */
            // ignore "don't create functions in a loop" warning
            p.stdout.on('data', _.bind(function(data) {
                self._onPingResponse(this, data);
            }, p));
            /* jshint ignore:end */

            this._pingStatus[host] = {
                up: true,
                start: Date.now(),
                last: Date.now(),
                line: '',
                lost: 0,
                process: p
            };
        }

    },

    _onPingResponse: function(p, data) {
        // Figure out what host this response is from.
        var host = '';
        for (var i in this._pingStatus) {
            if (this._pingStatus[i].process.pid == p.pid) {
                host = i;
                break;
            }
        }

        if (!host) {
            return;
        }

        var status = this._pingStatus[host];

        // Add up the buffers until you get a full line.
        status.line += data;
        if (!_.str.endsWith(status.line, '\n')) {
            return;
        }

        var lastUp = status.up;
        var lastSeen = status.last;
        var up = _.str.contains(status.line, 'Reply from');
        if (up) {
            status.up = true;
            status.last = Date.now();
            status.lost = 0;
        } else {
            status.lost++;
        }

        if (status.lost > this.get('pingLostCount')) {
            status.up = false;
        }

        if (status.up != lastUp) {
            var notice = host + ' ' + (up ? 'returned' : 'went away') + '. Last seen ' + moment(lastSeen).format('YYYY-MM-DD HH:mm:ss');
            logger.error(notice);
        }

        status.line = '';
    },

    checkMemory: function(memory) {
        if (memory > this.get('maxMemory')) {
            logger.error('App memory is ' + memory + ', max is set to ' + this.get('maxMemory') + ', restarting.');
            this.restartApp();
        }
    }
});
