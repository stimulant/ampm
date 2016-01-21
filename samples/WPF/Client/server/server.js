var _ = require('lodash'); // Utilities. http://lodash.com/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/

exports.Plugin = Backbone.Model.extend({
    boot: function () {
        // Listen to OSC data from the app. This could then be sent to other instances of the app, logged, etc.
		$$network.transports.oscFromApp.on('mouse', _.bind(function(data) {
			console.log(data);
		}, this));
	}
});
