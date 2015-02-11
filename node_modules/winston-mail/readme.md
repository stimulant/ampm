# winston-mail [![Build Status](https://travis-ci.org/wavded/winston-mail.svg?branch=master)](https://travis-ci.org/wavded/winston-mail)

A email transport for [winston][0].

## Installation

### Installing npm (node package manager)

``` sh
  $ curl http://npmjs.org/install.sh | sh
```

### Installing winston-mail

``` sh
  $ npm install winston
  $ npm install winston-mail
```

## Usage
``` js
  var winston = require('winston');

  //
  // Requiring `winston-mail` will expose
  // `winston.transports.Mail`
  //
  require('winston-mail').Mail;

  winston.add(winston.transports.Mail, options);
```

The Mail transport uses [emailjs](https://github.com/eleith/emailjs) behind the scenes.  Options are the following:

* __to:__ The address(es) you want to send to. *[required]*
* __from:__ The address you want to send from. (default: `winston@[server-host-name]`)
* __host:__ SMTP server hostname (default: localhost)
* __port:__ SMTP port (default: 587 or 25)
* __username__ User for server auth
* __password__ Password for server auth
* __subject__ Subject for email (default: winston: {{level}} {{msg}})
* __ssl:__ Use SSL (boolean or object { key, ca, cert })
* __tls:__ Boolean (if true, use starttls)
* __level:__ Level of messages that this transport should log.
* __silent:__ Boolean flag indicating whether to suppress output.

## License
The MIT License (MIT)

Copyright (c) 2014 Marc Harter

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://github.com/flatiron/winston
