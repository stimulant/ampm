var View = Backbone.View.extend({

	events: {
		'click #update': '_onUpdateClicked'
	},

	_socket: null,

	initialize: function() {
		this._socket = io.connect('http://localhost:3000');
		this._socket.on('connect', _.bind(this._onConnect, this));
	},

	_onConnect: function(socket) {
		this._socket.on('serverState', _.bind(this._onServerState, this));
		this._socket.emit('getServerState');
	},

	_onServerState: function(message) {
		this._socket.emit('getServerState');
	},

	_onUpdateClicked: function() {
		this._socket.emit('updateContent');
	}
});