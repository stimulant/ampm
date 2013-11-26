var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;
var AppState = require('./appState.js').AppState;

ExhibitState = exports.ExhibitState = BaseModel.extend({
	defaults: {
		appStates: null
	},

	initialize: function() {
		this.set('appStates', {});
	},

	updateHeart: function(hostname) {
		this.getState(hostname).set('lastHeart', moment());
	},

	updateAppState: function(hostname, state) {
		var appState = this.getState(hostname);

		if (!state) {
			delete this.get('appStates')[hostname];
			return;
		}

		appState.set('x', state.Point.X);
		appState.set('y', state.Point.Y);
	},

	getState: function(hostname) {
		var appStates = this.get('appStates');
		var appState = appStates[hostname];
		if (!appState) {
			appState = appStates[hostname] = new AppState(config.clients[hostname]);
		}

		return appState;
	}
});