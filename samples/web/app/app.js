// Set up namespaces, create root model and view.
APP = _.extend({

    Views: {},

    Models: {},

    initialize: function() {
        ampm.getConfig(function(config) {
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
    }
});
