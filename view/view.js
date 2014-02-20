var View = Backbone.View.extend({

	events: {
		'click #shutdown-app': '_onShutdownAppClicked',
		'click #restart-app': '_onRestartAppClicked',
		'click #shutdown-pc': '_onShutdownPcClicked',
		'click #restart-pc': '_onRestartPcClicked',
		'click #start': '_onStartClicked',
		'click #update': '_onUpdateClicked'
	},

	_socket: null,

	initialize: function() {
		this._socket = io.connect();
		this._socket.on('appState', _.bind(this._onAppState, this));
	},

	_onAppState: function(message) {
		$(document.body).show();

		message.uptime = moment.duration(message.uptime, 'milliseconds').format('dd:hh:mm:ss');
		message.fps = message.fps ? message.fps[message.fps.length - 1] : '';
		message.cpu = message.cpu ? message.cpu[message.cpu.length - 1] : '';
		message.memory = message.memory && message.memory.length ? humanize.filesize(message.memory[message.memory.length - 1]) : '';
		message.logList = '';
		_.each(message.logs, function(log) {
			message.logList += log.level + ': ' + log.msg + '\n';
		});

		message.eventList = '';
		_.each(message.events, function(e) {
			message.eventList += JSON.stringify(e) + '\n';
		});

		var template = _.template($('#info-template').html(), message);
		$('#info').html(template);

		$('#buttons-app').toggle(!message.isUpdating);
		$('#shutdown-app').toggle(message.isRunning);
		$('#start').toggle(!message.isRunning);
		$('#restart-app').toggle(message.isRunning);
		$('#update').toggle(message.canUpdate);
	},

	_onShutdownAppClicked: function() {
		if (window.confirm('Are you sure you want to shut down the app? It will not restart automatically.')) {
			this._socket.emit('shutdown-app');
		}
	},

	_onRestartAppClicked: function() {
		if (window.confirm('Are you sure you want to shut down and restart the app?')) {
			this._socket.emit('restart-app');
		}
	},

	_onShutdownPcClicked: function() {
		if (window.confirm('Are you sure you want to shut down the computer? It will not restart automatically.')) {
			this._socket.emit('shutdown-pc');
		}
	},

	_onRestartPcClicked: function() {
		if (window.confirm('Are you sure you want to shut down and restart the computer?')) {
			this._socket.emit('restart-pc');
		}
	},

	_onStartClicked: function() {
		this._socket.emit('start');
	},

	_onUpdateClicked: function() {
		this._socket.emit('updateContent');
	}
});