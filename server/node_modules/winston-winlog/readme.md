
# Windows Log transport for Winston

  Windows Event Log logger for node.js [Winston](https://github.com/flatiron/winston) module.

## Installation

    $ npm install winston-winlog
    $ npm install winston


## Usage

Configure :

```js
  var winston = require('winston'),
      winlog = require("winston-winlog");

  winston.add(winlog.EventLog, { source: 'myapp' });
  winston.setLevels(winlog.config.levels);
```

Then you can do:

```bash
  winston.info("this is an info message");
  winston.warning("this is an warning message");
  winston.error("this is an error message");
```

And you will see

![2012-04-07_1148.png](http://joseoncodecom.ipage.com/wp-content/uploads/images/2012-04-07_1148.png)

### Custom event log

When adding the transport you can define a custom event log as follows:

```js
  winston.add(winlog.EventLog, { source: 'myapp', eventLog: 'MyCustomEventLog' });
```

Then you will find your logs under "Applications and Services Logs"

![2012-04-20_0904.png](http://joseoncodecom.ipage.com/wp-content/uploads/images/2012-04-20_0904.png)

## How it works

This transport uses the module [windows-eventlog](http://jfromaniello.github.com/windowseventlogjs/) to log events. 

In order to write entries to the eventlog your application has to run with an elevated account: ie administrator or system account. 

The transport will do nothing (*doesn't throw!*) if you run it on a platform other than win32.

## Esta bueno, pero...

The only reason to use this adapter and not windows-eventlog directly is if you are working on a multi-platform project or you are already using winston.

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