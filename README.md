<p align="center">
  <img src="https://github.com/stimulant/ampm/blob/master/README.png?raw=true"/>
  <br/><strong>application<br/>management<br/>+<br/>performance<br/>monitoring</strong>
</p>


* [Startup](#startup)
* [Configuration](#configuration)
 * [Persistence](#configuration-persistence)
 * [Permissions](#configuration-permissions)
 * [Logging](#configuration-logging)
 * [Content Updater](#configuration-contentupdater)
 * [App Updater](#configuration-appupdater)
 * [Networking](#configuration-networking)
 * [State Sharing (experimental)](#configuration-statesharing)
* [Integration with Applications](#integration)
 * [Including ampm](#integration-including)
 * [Configuration Parsing](#integration-configuration)
 * [Heartbeat Monitoring](#integration-monitoring)
 * [Logging](#integration-logging)
 * [Event Tracking](#integration-state)
 * [State Sharing (experimental)](#integration-state)

<a name="startup"/>
# Startup

The simplest way to start ampm is to just run something like ```node server.js```. However, this will use all the default configuration values, which means it won't start or monitor anything. Not super useful. You will likely want to use a specific configuration file and startup script, as shown in [the samples](https://github.com/stimulant/ampm/tree/master/samples). The startup scripts use [node-supervisor](https://github.com/isaacs/node-supervisor) to restart ampm when the configuration is changed (in dev) or when the application is updated (in live).

<a name="configuration"/>
# Configuration

You can pass a configuration file path as an argument when starting ampm, like this:

```node server.js ..\..\config.json```

All paths are relative to the location of server.js.

You can include multiple configuration schemes in the same json file. For example.

```JavaScript
{
    "default": {
        // lots of configuration
    },
    "dev": {
        // only the configuration which overrides the default
    },
    "dev.foo" {
        // only the configuration which overrides default and dev
    },
    "machinename" {
        // configuration to apply on a specific machine
    },
    "machinename.dev" {
        // configuration to apply only to a specific machine in dev
    }
}
```

You can specify which configurations to use as an argument to node:

* use the default: ```supervisor server.js ..\..\config.json```
* use the dev configuration: ```supervisor server.js ..\..\config.json dev```
* use the dev.foo configuration: ```supervisor server.js ..\..\config.json dev.foo```

You don't have to explicitly specify the usage of machine-specific configurations, that will happen automatically if the current machine name matches a configuration. 

The contents of the final configuration can be passed on to the application being monitored, so you can store all configuration in one file, and take advantage of its cascading nature in the application as well.

The configuration is broken into a number of modules. You only need to specify the defaults you want to override.

<a name="configuration-persistence"/>
## Persistence

The persistence manager is in chage of starting a process, monitoring it, restarting it if it dies, and triggering updates on a schedule. At a minimum you'll need to set the launchCommand here in order to monitor anything.

```JavaScript
"persistence": {
    // The command to run to launch the client, relative to server.js.
    // {config} will be replaced with the contents of the config file.
    // example: "../Client.exe {config}"
    "launchCommand": "",

    // A command to run after the first heartbeat to do any additional
    // system configuration.
    "postLaunchCommand": "",

    // Restart the app if it doesn't start up in this much time.
    "startupTimeout": 10,

    // Restart the app this many seconds of no heartbeat messages.
    "heartbeatTimeout": 5,

    // Restart the machine after this many app restarts.
    "restartMachineAfter": Infinity,

    // Shut down the app on this schedule -- see cronmaker.com for the format.
    "shutdownSchedule": null,

    // Shut down the PC on this schedule -- see cronmaker.com for the format.
    "shutdownPcSchedule": null,

    // Start up the app on this schedule -- see cronmaker.com for the format.
    "startupSchedule": null,

    // Update the content and app on this schedule -- see cronmaker.com for the format.
    "updateSchedule": null,

    // Restart the app on this schedule -- see cronmaker.com for the format. 
    "restartSchedule": null
}
```

<a name="configuration-permissions"/>
## Permissions

If permissions are specified, the console is locked down with a username and password. Multiple users can be defined, each with different sets of permissions. By default, there is no access control.

```JavaScript
"permissions": {
    // A username.
    "test4": {
        // The password for that user.
        "password": "test4",
        
        // If true, the user can shutdown, start, and restart the app.
        "app": true,
        
        // If true, the user can shutdown and restart the computer.
        "computer": false,
        
        // If true, the user can update the app and content.
        "updaters": false
    }
}
```

<a name="configuration-logging"/>
## Logging

The logging module sends logs from ampm and the application being monitored to a number of places. In a dev environment you probably want to turn most of the logging off.

```JavaScript
// Settings for the logging module.
"logging": {
    // Settings for the file logger.
    "file": {
        "enabled": true, // false to turn off
        "filename": "logs/server.log", // Path to the log file, relative to server.js.
        "maxsize": 1048576, // The max size of the log file before rolling over (1MB default)
        "json": false, // Whether to log in JSON format.
        "level": "info" // The logging level to write: info, warn, error.
    },

    // Settings for the console logger.
    "console": {
        "enabled": true, // false to turn off
        "colorize": true, // Colors are fun.
        "timestamp": true, // Include timestamps.
        "level": "info" // The logging level to write: info, warn, error.
    },

    // Settings for the Windows event logger.
    "eventLog": {
        "eventSource": "ampm", // The source to list events under.
        "enabled": true // Whether to log Windows events at all.
    },

    // Settings for Google Analytics.
    "google": {
        "enabled": true, // false to turn off
        "accountId": "UA-46432303-2", // The property ID -- this should be unique per project.
        "userId": "3e582629-7aad-4aa3-90f2-9f7cb3f89597" // The user ID -- this should always be the same.
    },

    // Settings for the event log file.
    "eventFile": {
        "enabled": true, // false to turn off
        "filename": "logs/event-{date}.log" // Path to the log file, relative to server.js. {date} will be replaced by the current date.
    },

    // Settings for loggly.com.
    "loggly": {
        "enabled": true, // false to turn off
        "subdomain": "stimulant", // The account name. https://stimulant.loggly.com/dashboards
        "inputToken": "b8eeee6e-12f4-4f2f-b6b4-62f087ad795e", // The API token.
        "json": true, // Whether to log as JSON -- this should be true.
        "token": "b8eeee6e-12f4-4f2f-b6b4-62f087ad795e", // The um, other token.
        "tags": "ampm" // A tag to differentiate app logs from one another in loggly.
    },

    // Settings for the email logger.
    "mail": {
        "enabled": true, // false to turn off
        "host": "mail.content.stimulant.io", // The SMTP server to use.
        "ssl": false, // Whether to use SSL.
        "username": "ampm@content.stimulant.io", // The account to log in with.
        "from": "ampm@content.stimulant.io", // Where the emails should appear to be from.
        "password": "JPv5U9N6", // The password to log in with.
        "subject": "ERROR: {hostname}", // The subject of the emails. "{hostname}" is replaced by the output of os.hostname().
        "level": "error", // The logging level to write: info, warn, error.
        "to": "josh@stimulant.io" // Where the emails should go.
    },

    "cacheAmount": 20 // How many lines of logs and events to show in the web console.
}
```

<a name="configuration-contentupdater"/>
## Content Updater

The content updater handles downloading and deploying of updated content. It can also handle content from different sources (such as dev and live environments) and perform rollbacks of bad content.

```JavaScript
"contentUpdater": {
    // The path to fetch new content from. If this is a URL, ampm will look for an XML file and
    // parse it for additional URLs to fetch. If it's a local/network path, it will use robocopy
    // to fetch a directory. This can also be a mapping of content sources and URLs, such as:
    // {dev: url, live: url }
    "remote": null,

    // The local path to deployed content, relative to server.js.
    "local": "content/",
}
```

<a name="configuration-appupdater"/>
## App Updater

The app updater is just about the same as the content updater, except it updates the application (and ampm) itself.

```JavaScript
"appUpdater": {
    // The path to fetch new content from. If this is a URL, ampm will look for an XML file and
    // parse it for additional URLs to fetch. If it's a local/network path, it will use robocopy
    // to fetch a directory. This can also be a mapping of content sources and URLs, such as:
    // {dev: url, live: url }
    "remote": null,

    // The local path to deployed content, relative to server.js.
    "local": "content/",
}
```

<a name="configuration-networking"/>
## Networking

The networking module coordinates connections between ampm, the application its monitoring, the web console, and other ampm instances.

```JavaScript
"network": {
    // The port used to communicate between node and the browser. This is also the URL you'd use
    // to access the console, such as http://localhost:81.
    "socketToConsolePort": 81,

    // The port used to communicate between node and the client app over a TCP socket. This is
    // used for the app to send log messages and event tracking.
    "socketToAppPort": 3001,

    // The port used to communicate from the client app to the server over UDP/OSC. 
    "oscFromAppPort": 3002,

    // The port used to communicate from the server to the client app over UDP/OSC.
    "oscToAppPort": 3003,

    // The port used to communicate from the server to another peer over UDP/OSC.
    "oscToPeerPort": 3004,

    // How often in ms to send state changes to peers.
    "stateSyncRate": 1000 / 60,

    // How much socket.io logging you want to see in the console. Higher is more debug info. 
    "socketLogLevel": 2,

    // A listing of hostnames of peers with whom to share state.
    "peers": null,

    // Which hostname is the "master" keeper of shared state.
    "master": null
}
```

<a name="configuration-statesharing"/>
## State Sharing (experimental)

This barely works right now, but the general idea is that you can include an additional file via the configuration, like this:

```JavaScript
    "sharedState": "../../../sharedState.js"
```

This should be a [backbone model](https://github.com/stimulant/ampm-test/blob/master/sharedState.js) called SharedState with a "shared" property which is an object which will be shared across all ampm instances and applications. The other ampm instances and the master server are specified in the ```network.peers``` and ```network.master``` properties.

<a name="integration"/>
# Integration with Applications

Your application can talk to ampm in a number of different ways. For specific implementation details and examples, see the [ampm-test](https://github.com/stimulant/ampm-test/) repo.

<a name="integration-including"/>
## Including ampm

ampm should be included as a submodule at the root of your application. Then you shouldn't mess with it -- only update it if ampm gets new features or fixes that you care about. You should then look at the configuration and startup script examples in [the samples directory](https://github.com/stimulant/ampm/tree/master/samples). These should probably live in the root of your repository.

<a name="integration-configuration"/>
## Configuration Parsing

The contents of the ampm configuration will be passed to the application as a command line argument. You should parse this argument as JSON to get your configuration data.

<a name="integration-monitoring"/>
## Heartbeat Monitoring

The persistence layer works by listening for a heartbeat message from the app on an interval. If it doesn't get one, it will restart the app (or the machine, if you want). To send a heartbeat message, send an OSC message over UDP to localhost on the port specified in ```network.oscFromAppPort``` (default is 3003) that's simply the string ```heart```. You should probably do this when every frame is rendered.

For web applications, use a TCP message to ```network.socketToAppPort``` (default is 3002) via a web socket that is also just ```heart```.

<a name="integration-logging"/>
## Logging

You can log any message to ampm and it will go through its logging mechanism, including emailing errors out, etc. To send a log message, send a TCP message over a web socket on ```network.socketToAppPort``` (default is 3002). The event name should be ```log``` and the payload should be an object like this:

```JavaScript
{
    "level": "info",
    "message": "my log message"
}
```

The ```level``` can be ```error```, ```warning```, or ```info```. ```error``` is the most severe, and is emailed out by default. This can be configured with ```logging.mail.level```.

It is probably a good idea to log very severe things like crashes to the local machine on your own if possible, in case the app is in such a bad state that it can't even send messages to ampm. (However in a basic test, a .NET app can get crash call stack to ampm before it goes down.)

<a name="integration-events"/>
## Event Tracking

ampm can track events indicating normal usage, such as button clicks or accesses to various content. These are sent to Google Analytics and configured via ```logging.google```. To track an event, send a TCP message over a web socket on ```network.socketToAppPort``` (default is 3002). The event name should be ```event``` and the payload should be an object like this: 

```JavaScript
{
    "Category": "a name that you supply as a way to group objects that you want to track",
    "Action": "name the type of event or interaction you want to track",
    "Label": "provide additional information for events that you want to track, such as title of content",
    "Value": "you could use it to provide the time in seconds for an player to load",
}
```

More information about the types of data to include in the event tracking message can be found on the [Google Analytics](https://developers.google.com/analytics/devguides/collection/gajs/eventTrackerGuide#Anatomy) site.

To set up event tracking on a new project, it will need to be set up in the Google Analytics portal -- talk to Josh about that.

<a name="integration-state"/>
## State Sharing (experimental)

ampm's state sharing is set up to be very flexible depending on the type of application being developed and the type of state you want to share. In your [sharedState.js](https://github.com/stimulant/ampm-test/blob/master/sharedState.js) file, you should set up listeners for the TCP and UDP message you want to get from the app, and update your state accordingly.
