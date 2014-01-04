# winston-mail [![Build Status](https://secure.travis-ci.org/wavded/winston-mail.png)](http://travis-ci.org/wavded/winston-mail)

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

[0]: https://github.com/flatiron/winston
