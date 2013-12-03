var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;

// Class for sync logic specific to the application.
AppState = exports.AppState = BaseModel.extend({
	defaults: {
		fps: 0
	},

	_maxTicks: 180,
	_tickList: null,
	_tickSum: 0,
	_tickIndex: 0,
	_lastHeart: 0,
	_lastFpsUpdate: 0,

	initialize: function() {
		this._tickList = [];
		while (this._tickList.length < this._maxTicks) {
			this._tickList.push(0);
		}

		comm.fromApp.on('heart', _.bind(this._onHeart, this));
	},

	_onHeart: function(message) {
		if (!this._lastHeart) {
			this._lastHeart = Date.now();
			this._lastFpsUpdate = this._lastHeart;
			return;
		}

		var newHeart = Date.now();
		var newTick = newHeart - this._lastHeart;
		this._lastHeart = newHeart;

		// Compute FPS in a fast way. http://stackoverflow.com/a/87732/468472
		this._tickSum -= this._tickList[this._tickIndex];
		this._tickSum += newTick;
		this._tickList[this._tickIndex] = newTick;
		if (++this._tickIndex == this._maxTicks) {
			this._tickIndex = 0;
		}

		// Throttle updates to the indicator to once per second.
		if (newHeart - this._lastFpsUpdate < 1000) {
			return;
		}

		this._lastFpsUpdate = newHeart;

		// Round to two decimal points.
		var fps = 1000 / (this._tickSum / this._maxTicks);
		fps *= 100;
		fps = Math.round(fps);
		fps /= 100;

		this.set('fps', fps);
	}
});