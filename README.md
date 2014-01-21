<p align="center">
  <img src="https://github.com/stimulant/ampm/blob/master/README.png?raw=true"/>
  <br/><strong>application<br/>management<br/>+<br/>performance<br/>monitoring</strong>
</p>

## Configuration

ampm will look for a JSON config file at startup. By default this is config.json in the current working directory, but you can pass another path in like this:

```node server.js /some/other/path/config.json```

Below are all the defaults for the various modules. Your JSON file only needs to contain the sections that you want to override.

```JavaScript

// Port settings for the various network connections.
"network": {
    "socketToConsolePort": 3000, // The port used to communicate between node and the browser. 
                                 // This is also the URL you'd use to access the console, such as http://localhost:3000.
    "socketToAppPort": 3001, // The port used to communicate between node and the client app over a TCP socket.
                             // This is used for the app to send log messages and event tracking.
    "oscFromAppPort": 3004, // The port used to communicate from the client app to the server over UDP/OSC.
                            // This is used to send heartbeat messages and syncronize state between clients.
    "oscToAppPort": 3005, // The port used to communicate from the server to the client app over UDP/OSC.
                          // This is used to syncronize state between clients.
    "socketLogLevel": 2 // How much socket.io logging you want to see in the console. Higher is more debug info.
},

// URLs and paths for the content updater.
"contentUpdater": {
    "remote": null, // The path to fetch new content from. If this is a URL, ampm will look for an XML file and parse it
                    // for additional URLs to fetch. If it's a local/network path, it will use robocopy to fetch a directory.
    "local": "content/", // The local path to deployed content, relative to server.js.
    "temp": "content.tmp/", // The local path to the temp download folder, relative to server.js.
},

// URLs and paths for the application updater.
"appUpdater": {
    "remote": null, // The path to fetch a new application binary from. This should be a single zip file. If it's a URL, ampm
                    // will download it. If it's a local/network path, it will use robocopy.
    "local": "app.tmp/", // The local path to deployed content, relative to server.js.
    "temp": "app.tmp/", // The local path to the temp download folder, relative to server.js.
},

// Settings for the persistence manager.
"persistence": {
    "processName": "", // The name of the executable file for the client app.
    "startupTimeout": 10, // Restart the app if it doesn't start up in this much time.
    "heartbeatTimeout": 5, // Restart the app this many seconds of no heartbeat messages.
    "restartMachineAfter": Infinity, // Restart the machine after this many app restarts.
    "shutdownSchedule": null, // Shut down the app on this schedule -- see cronmaker.com for the format.
    "startupSchedule": null, // Start up the app on this schedule -- see cronmaker.com for the format.
    "updateSchedule": null, // Update the content and app on this schedule -- see cronmaker.com for the format.
    "restartSchedule": null // Restart the app on this schedule -- see cronmaker.com for the format.
},

// Settings for the logging module.
"logging": {

	// Settings for the file logger.
    "file": {
        "enabled": true, // false to turn off
        "filename": "logs/server.log", // Path to the log file, relative to server.js.
        "maxsize": 1048576, // The max size of the log file before rolling over (1MB default)
        "json": false, // Whether to log in JSON format.
        "level": "info" // The logging level to write: info, warning, error.
    },

    // Settings for the console logger.
    "console": {
        "enabled": true, // false to turn off
        "colorize": true, // Colors are fun.
        "timestamp": true, // Include timestamps.
        "level": "info" // The logging level to write: info, warning, error.
    },

    // Settings for the Windows event logger.
    "eventLog": {
        "enabled": true // Whether to log Windows events at all.
    },

    // Settings for Google Analytics.
    "google": {
        "enabled": true, // false to turn off
        "accountId": "UA-46432303-2", // The property ID -- this should be unique per project.
        "userId": "3e582629-7aad-4aa3-90f2-9f7cb3f89597" // The user ID -- this should always be the same.
    },

    // Settings for loggly.com.
    "loggly": {
        "enabled": true, // false to turn off
        "subdomain": "stimulant", // The account name. https://stimulant.loggly.com/dashboards
        "inputToken": "b8eeee6e-12f4-4f2f-b6b4-62f087ad795e", // The API token.
        "json": true, // Whether to log as JSON -- this should be true.
        "token": "b8eeee6e-12f4-4f2f-b6b4-62f087ad795e" // The um, other token.
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
        "level": "error" // The logging level to write: info, warning, error.
        "to": "josh@stimulant.io" // Where the emails should go.
    },

    "cacheAmount": 20 // How many lines of logs and events to show in the web console.
}

```