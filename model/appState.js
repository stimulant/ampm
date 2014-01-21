var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var child_process = require('child_process'); // http://nodejs.org/api/child_process.html
var XRegExp = require('xregexp').XRegExp; // Fancy regular expressions. http://xregexp.com/

var BaseModel = require('./baseModel.js').BaseModel;

// Information about the app.
AppState = exports.AppState = BaseModel.extend({
	defaults: {
		isRunning: false,
		uptime: 0,
		fps: null,
		cpu: null,
		memory: null,
		canUpdate: false
	},

	// How often to update stats.
	_updateFrequency: 1000,
	// How many updates of historical data to keep.
	_statHistory: 60,
	_statIndex: 0,
	// The interval to update stats.
	_updateStatsTimeout: 0,
	_updateConsoleTimeout: 0,
	// The last time the app was running to compute uptime.
	_startupTime: 0,

	initialize: function() {
		this.set('canUpdate', ((serverState.get('contentUpdater').get('remote') && true) || (serverState.get('appUpdater').get('remote') && true)) === true);
		serverState.get('persistence').on('heart', this._onHeart, this);
		this._updateStats();
		this._updateCpu();
		this._updateConsoleTimeout = setTimeout(_.bind(this._updateConsole, this), this._updateFrequency);
	},

	clean: function() {
		clearTimeout(this._updateConsoleTimeout);
		clearTimeout(this._updateStatsTimeout);
		this._typeperf.kill();
		serverState.get('persistence').off(null, null, this);
	},

	_updateConsole: function() {
		var message = _.clone(this.attributes);
		message.restartCount = serverState.get('persistence').get('restartCount');
		message.logs = serverState.get('logging').get('logCache');
		message.events = serverState.get('logging').get('eventCache');
		message.canUpdate = this.get('canUpdate');
		comm.socketToConsole.sockets.emit('appState', message);
		this._updateConsoleTimeout = setTimeout(_.bind(this._updateConsole, this), this._updateFrequency);
	},

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
		var process = serverState.get('persistence').get('processName').toUpperCase();
		if (!process) {
			this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateFrequency);
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

				this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateFrequency);
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

			this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateFrequency);
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