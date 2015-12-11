<p align="center">
  <img src="https://github.com/stimulant/ampm/blob/master/README.png?raw=true"/>
  <br/><strong>application<br/>management<br/>+<br/>performance<br/>monitoring</strong>
</p>

At [Stimulant](http://stimulant.com) we consider it very important to know how our installations are doing out in the wild, whether they are permanent or temporary. To that end we’ve developed a toolkit referred to as “ampm”, which quickly adds monitoring and management functions to our applications without much work from the application developer. It’s now standard practice to integrate these tools into our deployments, and they’re out in the wild on projects at [tourist attractions](http://stimulant.com/portfolio-item/space-needle/) and [trade shows](http://stimulant.com/portfolio-item/pipeline-explorer/).

At its most basic you can use it to launch your app, monitor the process, and restart it if it crashes. You can also schedule intentional restarts, do all sorts of logging/analytics, and view current status such as frames/second and CPU usage via a basic web interface. There are [samples](https://github.com/stimulant/ampm-samples) of how to use it with Cinder apps, web apps, and WPF apps. 

<p align="center">
  <img src="https://github.com/stimulant/ampm/blob/master/console.png?raw=true" width="500"/>
</p>

If you find these utilities helpful, definitely let us know. If you find a bug or make an improvement, please enter an issue or pull request.

* [Startup](#startup)
* [Configuration](#configuration)
 * [Persistence](#configuration-persistence)
 * [Permissions](#configuration-permissions)
 * [Logging](#configuration-logging)
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

The simplest way to start ampm is to just run something like ```node server.js```. However, this will use all the default configuration values, which means it won't start or monitor anything. Not super useful. You will likely want to use a specific configuration file and startup script, as shown in [the samples](https://github.com/stimulant/ampm-samples). The startup scripts use [node-supervisor](https://github.com/isaacs/node-supervisor) to restart ampm when the configuration is changed (in dev) or when the application is updated (in live).

<a name="configuration"/>
# Configuration

You can pass a configuration file path as an argument when starting ampm, like this:

```node server.js ..\..\config.json```

If you have multiple apps on the same machine, you can also pass paths to multiple configuration files, like this: 

```node server.js ..\..\app1\config.json,..\..\app2\config.json,..\..\app3\config.json ```

These will show up on the console page and allow you to switch between multiple apps. All paths are relative to the location of server.js.

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

    // The command to run to launch a parallel process, relative to
    // server.js. {config} will be replaced with the contents of the config
    // file. This process will be stopped and started at the same time as the
    // main process.
    "sideCommand": "",

    // A command to run after the first heartbeat to do any additional
    // system configuration.
    "postLaunchCommand": "",

    // Restart the app if it doesn't start up in this much time. Set to
    // zero (default) to allow the app to take forever to start up.
    "startupTimeout": 0,

    // Restart the app this many seconds of no heartbeat messages. Set to
    // zero (default) to never restart due to lack of heartbeats.
    "heartbeatTimeout": 0,

    // Restart the machine after this many app restarts.
    "restartMachineAfter": Infinity,

    // Shut down the app on this schedule -- see cronmaker.com for the format.
    "shutdownSchedule": null,

    // Shut down the PC on this schedule -- see cronmaker.com for the format.
    "shutdownPcSchedule": null,

    // Start up the app on this schedule -- see cronmaker.com for the format.
    "startupSchedule": null,

    // Restart the app on this schedule -- see cronmaker.com for the format. 
    "restartSchedule": null,

    // A list of hostnames to ping. An error is logged when they go down and return.
    "pingList": null,

    // The number of pings which can be lost before an error is logged.
    "pingLostCount": 5,

    // Restart the app if it uses more than this much memory.
    "maxMemory": Infinity,

    // Whether to let ampm die if it throws an unhandled exception.
    "exitOnError": true
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
        "computer": true
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
        "filename": "logs/server", // Path to the log file, relative to server.js.
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
    },

    // Settings for the event log file.
    "eventFile": {
        "enabled": true, // false to turn off
        "filename": "logs/event-{date}.tsv" // Path to the log file, relative to server.js. {date} will be replaced by the current date.
    },

    // Settings for screenshots taken after crashes.
    "screenshots": {
        "enabled": true, // false to turn off
        "filename": "logs/capture-{date}.jpg" // Path to save screen shots, relative to server.js. {date} will be replaced by the current date.
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
        "ssl": false, // Whether to use SSL.
        "subject": "ERROR: {hostname}", // The subject of the emails. "{hostname}" is replaced by the output of os.hostname(). Paths to anything in the config object can be used as well.
        "level": "error", // The logging level to write: info, warn, error.
        "host": "", // The SMTP server to use.
        "username": "", // The account to log in with.
        "from": "", // Where the emails should appear to be from.
        "password": "", // The password to log in with.
        "to": "" // Where the emails should go.
    },

    "cacheAmount": 20 // How many lines of logs and events to show in the web console.
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

This should be a [backbone model](https://github.com/stimulant/ampm-samples/blob/master/sharedState.js) called SharedState with a "shared" property which is an object which will be shared across all ampm instances and applications. The other ampm instances and the master server are specified in the ```network.peers``` and ```network.master``` properties.

<a name="integration"/>
# Integration with Applications

Your application can talk to ampm in a number of different ways. For specific implementation details and examples, see the [ampm-samples](https://github.com/stimulant/ampm-samples/) repo.

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

ampm's state sharing is set up to be very flexible depending on the type of application being developed and the type of state you want to share. In your [sharedState.js](https://github.com/stimulant/ampm-samples/blob/master/sharedState.js) file, you should set up listeners for the TCP and UDP message you want to get from the app, and update your state accordingly.
