var View = Backbone.View.extend({

    events: {
        'click #shutdown-app': '_onShutdownAppClicked',
        'click #restart-app': '_onRestartAppClicked',
        'click #shutdown-pc': '_onShutdownPcClicked',
        'click #restart-pc': '_onRestartPcClicked',
        'click #start-app': '_onStartClicked',
        'click .update': '_onUpdateClicked',
        'click .rollback': '_onRollbackClicked',
        'click #hide-cursor': '_onCursorClicked',
        'click #show-cursor': '_onCursorClicked'
    },

    _socket: null,
    _config: null,

    initialize: function() {
        this._socket = io.connect();

        this._socket.on('connect', _.bind(function() {
            this._socket.emit('appStateRequest');
        }, this));

        this._socket.on('appState', _.bind(function(message) {
            this._onAppState(message);
            this._socket.emit('appStateRequest');
        }, this));

        this._socket.on('config', _.bind(function(message, configs) {
            this._onConfig(message, configs);
        }, this));
    },

    _onAppState: function(message) {
        $(document.body).show();

        message.uptime = moment.duration(message.uptime, 'milliseconds').format('dd:hh:mm:ss');
        message.fps = message.fps ? message.fps[message.fps.length - 1] : '';
        message.cpu = message.cpu ? message.cpu[message.cpu.length - 1] : '';
        message.memory = message.memory && message.memory.length ? humanize.filesize(message.memory[message.memory.length - 1]) : '';
        message.logList = '';
        _.each(message.logs, function(log) {
            message.logList += log.time + ' ' + log.level + ': ' + log.msg + '\n';
        });

        message.eventList = '';
        _.each(message.events, function(e) {
            message.eventList += JSON.stringify(e) + '\n';
        });

        var template = _.unescape($('#info-template').html()).trim();
        $('#info').html(_.template(template, message));

        $('#controls-updaters fieldset').toggle(!message.isUpdating && (message.updaters.app.source !== null || message.updaters.content.source !== null));
        $('#shutdown-app').toggle(message.isRunning);
        $('#start-app').toggle(!message.isRunning);
        $('#restart-app').toggle(message.isRunning);
        $('#hide-cursor').toggle(message.isCursorShown);
        $('#show-cursor').toggle(!message.isCursorShown);

        $('#controls').prop('disabled', message.updaters.content.isUpdating || message.updaters.app.isUpdating);
        this._updateUpdater($('#controls-updaters-content'), message.updaters.content);
        this._updateUpdater($('#controls-updaters-app'), message.updaters.app);
    },

    _updateUpdater: function(container, state) {
        container.toggle(state.source !== null);
        $('.rollback', container).toggle(state.canRollback);
        $('.current', container).html(state.source);
        $('.sources button', container).each(_.bind(function(index, value) {
            var button = $(value);
            button.toggle(!button.hasClass(state.source));
        }, this));
    },

    _onConfig: function(message, configs) {
        this._config = message;
        console.log(message);
        this._makeSources($('#controls-updaters-content .sources'), 'content', message.contentUpdater.remote);
        this._makeSources($('#controls-updaters-app .sources'), 'app', message.appUpdater.remote);
        this._addConfigs($('#controls-configs #configs-list'), configs);
        $('#controls-configs').toggle(configs.length > 1);

        if (!message.permissions) {
            return;
        }

        $('#controls-app').toggle(message.permissions.app);
        $('#controls-configs').toggle(message.permissions.app && configs.length > 1);
        $('#controls-computer').toggle(message.permissions.computer);
        $('#controls-updaters').toggle(message.permissions.updaters);
        $('#controls-cursor').toggle(message.permissions.cursor);
        $('#controls').toggle(message.permissions.app || message.permissions.computer || message.permissions.updaters || message.permissions.cursor);
    },

    _makeSources: function(buttons, updater, sources) {
        var template = _.unescape($('#update-button-template').html()).trim();
        var click = _.bind(function(e) {
            var data = $(e.target).data();
            this._onSetSourceClicked(e, data.updater, data.source);
        }, this);

        buttons.empty();
        for (var source in sources) {
            var data = {
                updater: updater,
                source: source
            };
            var button = $(_.template(template, data));
            button.addClass(source);
            button.data(data);
            button.click(click);
            buttons.append(button);
        }
    },

    _addConfigs: function(list, configs) {
        var template = _.unescape($('#config-button-template').html()).trim();

        var click = _.bind(function(e) {
            var data = $(e.target).data();
            this._onConfigClicked(e, data.config);
        }, this);

        list.empty();
        if (configs.length <= 1) {
            return;
        }

        for (var i = 0; i < configs.length; i++) {
            var data = {
                config: configs[i]
            };

            var button = $(_.template(template, data));
            //button.addClass(source);
            button.data(data);
            button.click(click);
            list.append(button);
        }
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

    _onSetSourceClicked: function(event, updater, source) {
        this._socket.emit('setUpdaterSource', updater, source);
    },

    _onConfigClicked: function(event, config) {
        if (window.confirm('Are you sure you want to shut down the app and launch ' + config + ' ?')) {
            this._socket.emit('switchConfig', config);
        }
    },

    _onUpdateClicked: function(event) {
        var updater = $(event.target).parents('fieldset').first().attr('id').indexOf('content') != -1 ? 'content' : 'app';
        this._socket.emit('updateUpdater', updater);
    },

    _onRollbackClicked: function() {
        var updater = $(event.target).parents('fieldset').first().attr('id').indexOf('content') != -1 ? 'content' : 'app';
        this._socket.emit('rollbackUpdater', updater);
    },

    _onCursorClicked: function() {
        this._socket.emit('toggleCursor');
    }
});
