var View = Backbone.View.extend({

	events: {
		'click #update': '_onUpdateClicked'
	},

	_socket: null,

	initialize: function() {
		this._socket = io.connect('http://localhost:3000');
		this._socket.on('appState', function(msg) {
			//console.log(moment(msg.attrs.lastHeart));
		});
	},

	_onUpdateClicked: function() {
		this._socket.emit('updateContent');
	}
});
