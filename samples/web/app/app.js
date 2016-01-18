// Set up namespaces, create root model and view.
APP = _.extend({

    Views: {},

    Models: {},

    initialize: function() {
        this.getConfig(function(config) {
            APP.config = config;

            this.model = new APP.Model();
            this.view = new APP.View({
                el: document.body,
                model: this.model
            });

            console.log('Starting App heartbeat');

            function heart() {
                ampm.heart();
                requestAnimationFrame(heart);
            }
            requestAnimationFrame(heart);
        });
    },

    // Load configuration data from ampm.
    getConfig: function(callback) {
        console.log('Requesting configuration');
        $.getJSON('http://localhost:8888/config')
            .done(function(config) {
                console.log('Configuration loaded');
                callback(config);
            }).fail(function(jqxhr, textStatus, error) {
                console.error('Config load failed');
                throw error;
            });
    }
});
