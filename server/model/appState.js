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
		fps: 0,
		cpu: 0,
		memory: 0,
		uptime: 0
	},

	// How often to update stats.
	_updateFrequency: 1000,
	// The interval to update stats.
	_updateTimeout: 0,
	// The last time the app was running to compute uptime.
	_startupTime: 0,

	initialize: function() {
		this._tickList = [];
		while (this._tickList.length < this._maxTicks) {
			this._tickList.push(0);
		}

		serverState.get('persistence').on('heart', _.bind(this._onHeart, this));
		this._updateStats();
	},

	_updateStats: function() {
		clearTimeout(this._updateTimeout);
		var process = serverState.get('persistence').get('processName').toUpperCase();

		/*
		// tasklist.exe output looks like this:
		Image Name:   Client.exe
		PID:          12008
		Session Name: Console
		Session#:     1
		Mem Usage:    39,384 K
		*/

		// Is the app running?
		child_process.exec('tasklist /FI "IMAGENAME eq ' + process + '" /FO LIST', _.bind(function(error, stdout, stderr) {

			// Update isRunning.
			var wasRunning = this.get('isRunning');
			var isRunning = stdout.toUpperCase().indexOf(process) != -1;
			this.set('isRunning', isRunning);

			if (!isRunning) {
				// Not running, so reset everything.
				this.set('memory', 0);
				this.set('cpu', 0);
				this.set('uptime', 0);
				this.set('fps', 0);
				this._updateTimeout = setTimeout(_.bind(this._updateStats, this), this._updateFrequency);
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
			this.set('fps', fps);

			// Update the memory.
			var bytes = parseInt(stdout.split('\r\n')[5].split('    ')[1].split(' ')[0].replace(',', ''), 10) * 1024;
			this.set('memory', bytes);

			// Get CPU usage.
			child_process.exec('wmic path Win32_PerfFormattedData_PerfProc_Process where name=\'' + process.split('.')[0] + '\' get PercentProcessorTime', _.bind(function(error, stdout, stderr) {

				/*
				// wmic.exe output looks like this:
				PercentProcessorTime
				0
				*/

				var cpu = parseInt(stdout.split('\r\r\n')[1], 10);
				this.set('cpu', cpu);

				// Update again.
				this._updateTimeout = setTimeout(_.bind(this._updateStats, this), this._updateFrequency);
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