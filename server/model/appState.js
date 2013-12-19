var _ = require('underscore'); // Utilities. http://underscorejs.org/
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
		serverState.get('persistence').on('heart', _.bind(this._onHeart, this));
		this._updateStats();

		this._updateConsoleTimeout = setTimeout(_.bind(this._updateConsole, this), this._updateFrequency);
	},

	_updateConsole: function() {
		var message = _.clone(this.attributes);
		message.restartCount = serverState.get('persistence').get('restartCount');
		message.logs = serverState.get('logging').get('logCache');
		message.events = serverState.get('logging').get('eventCache');
		comm.socketToConsole.sockets.emit('appState', message);
		this._updateConsoleTimeout = setTimeout(_.bind(this._updateConsole, this), this._updateFrequency);
	},

	_updateStats: function() {
		var fpsHistory = this.get('fps');
		var cpuHistory = this.get('cpu');
		var memoryHistory = this.get('memory');

		if (!fpsHistory || !cpuHistory || !memoryHistory) {
			fpsHistory = [];
			cpuHistory = [];
			memoryHistory = [];
			this.set({
				fps: fpsHistory,
				cpu: cpuHistory,
				memory: memoryHistory
			});
		}

		clearTimeout(this._updateStatsTimeout);
		var process = serverState.get('persistence').get('processName').toUpperCase();

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
					cpu: null,
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

			// Update FPS.
			var fps = 1000 / (this._tickSum / this._maxTicks);
			fps *= 100;
			fps = Math.round(fps);
			fps /= 100;
			fpsHistory.push(fps);
			while (fpsHistory.length > this._statHistory) {
				fpsHistory.shift();
			}

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

			// Get CPU usage.
			child_process.exec('wmic path Win32_PerfFormattedData_PerfProc_Process where name=\'' + process.split('.')[0] + '\' get PercentProcessorTime', _.bind(function(error, stdout, stderr) {

				/*
				// wmic.exe output looks like this:
				PercentProcessorTime
				0
				*/

				var cpu = parseInt(stdout.split('\r\r\n')[1], 10);
				cpuHistory.push(cpu);
				while (cpuHistory.length > this._statHistory) {
					cpuHistory.shift();
				}

				this._updateStatsTimeout = setTimeout(_.bind(this._updateStats, this), this._updateFrequency);
			}, this));
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