var View = Backbone.View.extend({

	events: {
		'click #update': '_onUpdateClicked'
	},

	_socket: null,

	initialize: function() {
		this._socket = io.connect('http://localhost:3000');
		this._socket.on('appState', _.bind(this._onAppState, this));
	},

	_onAppState: function(message) {
		message.uptime = moment.duration(message.uptime, 'milliseconds').format('dd:hh:mm:ss');
		message.fps = message.fps ? message.fps[message.fps.length - 1] : '';
		message.cpu = message.cpu ? message.cpu[message.cpu.length - 1] : '';
		message.memory = message.memory ? humanize.filesize(message.memory[message.memory.length - 1]) : '';
		var template = _.template($('#info-template').html(), message);
		$('#info').html(template);
	},

	_onUpdateClicked: function() {
		this._socket.emit('updateContent');
	}
});