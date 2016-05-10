// Root view, contains all subviews.
APP.View = Backbone.View.extend({
    events: {
        'click #crash': '_onCrashClicked',
        'click #hang': '_onHangClicked',
        'click #log': '_onLogClicked',
        'click #event': '_onEventClicked',
        'click #console': '_onConsoleClicked',
        'click #restart': '_onRestartClicked'
    },

    _subView: null,

    initialize: function() {

        // Initializing a sub view with a model.
        this._subView = new APP.Views.SomeView({
            el: this.$el,
            model: this.model.get('someModel')
        });

        $('#config', this.$el).html(JSON.stringify(APP.config, null, '\t'));

        // Send the mouse position back to the server.
        this.$el.mousemove(function(e) {
            ampm.socket().emit('mouse', {
                x: e.pageX,
                y: e.pageY
            });
        });
    },

    _onCrashClicked: function() {
        // Crashes will cause heartbeats to stop being sent and your app will get restarted.
        var bar = foo.bar;
    },

    _onHangClicked: function() {
        // Hangs will cause heartbeats to stop being sent and your app will get restarted.
        while (true) {}
    },

    _onLogClicked: function() {
        // Example of how to send log messages.
        ampm.info('informational!');
        ampm.warning('warning!');
        ampm.error('error!');
    },

    _onEventClicked: function() {
        // Example of how to track events.
        ampm.logEvent('app event', 'clicked', 'button', 2);
    },

    _onRestartClicked: function() {
        ampm.socket().emit('restart');
    },

    _onConsoleClicked: function() {
        window.open('http://localhost:8888');
    }
});
