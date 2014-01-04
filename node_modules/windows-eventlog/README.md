# Windows Event Log Js

  Native node.js module to log messages to the Windows Event Log.

## Installation

    $ npm install windows-eventlog

## Requisites

You need to have these two things installed in your system for now:

- [Visual c++ 2010 redistributable fox x86](http://www.microsoft.com/en-us/download/details.aspx?id=5555)
- [Microsoft .Net Framework 4.0](http://www.microsoft.com/en-us/download/confirmation.aspx?id=17851)

## Usage

Initialize somewhere the logger like:

```js
  var EventLog = require('windows-eventlog').EventLog;
  var myeventlog = new EventLog("mySource");
  myeventlog.log("a message");
```

And you will see this:

![2012-04-09_1007.png](http://joseoncodecom.ipage.com/wp-content/uploads/images/2012-04-09_1007.png)

### new EventLog(source[, logName])

This create an instance of the EventLog with the given source. You can optionally pass a logName, defaults to "Application".

If the source doesn't exist in the event log database it will be created with the givne log name.


### eventLog.log(message[, logEntryType])

This method will create an entry in the event log with the given message. 

Optionally you can specify a [logEntryType](http://msdn.microsoft.com/es-es/library/system.diagnostics.eventlogentrytype.aspx). The possible values for logEntryType are "Information", "Warning", "Error" and others two that you will never use :) 

## How it works

This module was built on c++/cli (.Net) and uses [System.Diagnostics.EventLog](http://msdn.microsoft.com/en-us/library/system.diagnostics.eventlog.aspx). 

In order to log events you need to run the application with an elevated account: ie administrator or system account. Windows services typically run under the system account, if you are looking on how to run node.js applications as a Windows Service have a look to [WinSer](http://jfromaniello.github.com/winser/).


## TODO

- Use uv_queue_work to execute the writelog method in a different thread ( ? )

## About win32 native modules

If you are looking on how to create native modules in windows follow [this great tutorial](https://github.com/saary/node.net/) and [this other post](http://joseoncode.com/2012/04/10/writing-your-first-native-module-for-node-dot-js-on-windows/) by me.

## License 

(The MIT License)

Copyright (c) 2012 Jose Romaniello &lt;jfromaniello@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.