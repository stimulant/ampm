var _ = require('underscore'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/
var moment = require('moment'); // Date processing. http://momentjs.com/
var BaseModel = require('./baseModel.js').BaseModel;
var AppState = require('./appState.js').AppState;

ExhibitState = exports.ExhibitState = BaseModel.extend({
	defaults: {},

	appState: null,

	initialize: function() {
		this.appStates = new AppStates();
	},

	updateHeart: function(hostname) {
		//console.log(hostname);
		//console.log(this.getState(hostname));
		//this.getState(hostname).set('lastHeart', moment());
	},

	updateAppState: function(hostname, state) {
		var appState = this.getState(hostname);

		if (!state) {

			this.appStates.remove(appState);
			return;
		}

		appState.set('x', state.Point.X);
		appState.set('y', state.Point.Y);
	},

	getState: function(hostname) {
		var appStates = this.appStates;
		var appState = _.find(appStates.models, function(model) {
			return model.get('hostname') == hostname;
		});

		if (!appState) {
			appState = new AppState(config.clients[hostname]);
			appState.set('hostname', hostname);
			appState.set('lastHeart', moment());

			if (!appStates.add) {
				console.log(appStates.models);
			}

			appStates.add(appState);
		}

		return appState;
	}
});

AppStates = exports.AppStates = Backbone.Collection.extend({
	model: AppState
});