// Set up namespaces, create root model and view.
APP = _.extend({

    Views: {},

    Models: {},

    initialize: function() {
        ampm.socket().on('configRequest', function(config) {
            console.log('Configuration loaded');

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
        ampm.socket().emit('configRequest');
        console.log('Configuration requested');
    }
});
