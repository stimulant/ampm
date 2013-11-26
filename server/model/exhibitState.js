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

	getState: function(hostname) {
		var appStates = this.get('appStates');
		var appState = appStates[hostname];
		if (!appState) {
			appState = appStates[hostname] = new AppState();
		}

		return appState;
	}
});