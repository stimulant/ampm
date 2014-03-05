var _ = require('lodash'); // Utilities. http://underscorejs.org/
var Backbone = require('backbone'); // Data model utilities. http://backbonejs.org/

// A base class from which the other models are derived in order to share some utility functions.
var BaseModel = Backbone.Model.extend({

    // Map the properties of the config object to the model properties.
    // Should be called as the first line of the initialize method of any subclass.
    initialize: function() {
        var config = this.get('config');
        if (!config) {
            return;
        }

        for (var i in config) {
            if (_.isString(config[i])) {
                this.set(i, config[i]);
            } else {
                this.set(i, _.clone(this.get(i)) || {});
                for (var j in config[i]) {
                    this.get(i)[j] = config[i][j];
                }
            }
        }
    },

    // Convert a model to a simple object which can then be passed to JSON.stringify.
    // https://blog.andyet.com/2011/feb/15/re-using-backbonejs-models-on-the-server-with-node/
    xport: function(opt) {
        var result = {},
            settings = _({
                recurse: true
            }).extend(opt || {});

        function process(targetObj, source) {
            targetObj.id = source.id || null;
            targetObj.cid = source.cid || null;
            targetObj.attrs = source.toJSON();
            _.each(source, function(value, key) {
                // since models store a reference to their collection
                // we need to make sure we don't create a circular refrence
                if (settings.recurse) {
                    if (key !== 'collection' && source[key] instanceof Backbone.Collection) {
                        targetObj.collections = targetObj.collections || {};
                        targetObj.collections[key] = {};
                        targetObj.collections[key].models = [];
                        targetObj.collections[key].id = source[key].id || null;
                        _.each(source[key].models, function(value, index) {
                            process(targetObj.collections[key].models[index] = {}, value);
                        });
                    } else if (source[key] instanceof Backbone.Model) {
                        targetObj.models = targetObj.models || {};
                        process(targetObj.models[key] = {}, value);
                    }
                }
            });
        }

        process(result, this);

        return result;
    },

    // Convert a simple object to a model.
    // https://blog.andyet.com/2011/feb/15/re-using-backbonejs-models-on-the-server-with-node/
    mport: function(data, silent) {
        function process(targetObj, data) {
            targetObj.id = data.id || null;
            targetObj.set(data.attrs, {
                silent: silent
            });
            // loop through each collection
            if (data.collections) {
                _.each(data.collections, function(collection, name) {
                    targetObj[name].id = collection.id;
                    //Skeleton.models[collection.id] = targetObj[name];
                    _.each(collection.models, function(modelData, index) {
                        var newObj = targetObj[name].add({}, {
                            silent: silent
                        });
                        process(newObj, modelData);
                    });
                });
            }

            if (data.models) {
                _.each(data.models, function(modelData, name) {
                    process(targetObj[name], modelData);
                });
            }
        }

        process(this, data);

        return this;
    }
});

exports.BaseModel = BaseModel;
