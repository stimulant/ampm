
1.0.1 / 2015-12-11
==================

  * Update emailjs and underscore dependency

1.0.0 / 2015-11-06
==================

  * No breaking changes, just locking in a stable semver
  * Testing for Node 4/5
  * Support Winston >=0.5.0 <3.0.0
  * Add timeout option for setting SMTP timeout

0.5.0 / 2015-09-16
==================

  * Handle Error meta [perrin4869]
  * Enable boolean to log only the selected level and none above [jamie-ez]
  * Docs for subject templating

0.4.0 / 2015-04-13
==================

  * add; option to send html mails [Thelmos]
  * mod; support winston 1.0.0
  * mod; update license info

0.3.2 / 2015-03-06
==================

  * dep; emailjs@0.3.13 to fix multiple callback issue

0.3.1 / 2015-02-11
==================

  * fix; emailjs [msecs must be header] issue [ivan-kleshnin]

0.3.0 / 2014-12-08
==================

  * mod; support node >= 0.10
  * mod; allow override of name [shannonmpoole]

0.2.9 / 2014-09-18
==================

 * mod; bump peer dep to <1.0.0

0.2.8 / 2014-08-27
==================

 * mod; throw Error instance instead of string [jabclab]
 * add; license to readme

0.2.7 / 2013-07-09 
==================

 * fixed; Do not add meta into the email body if the object is empty (has not properties) [lobodpav]

0.2.5 / 2013-03-03 
==================

  * added; peer deps
  * language fixes [eitanpo]

0.2.4 / 2013-02-12 
==================

  * fixed; allow only single line messages in the subject [emergence]
  * fixed; changing global underscore templateSettings breaks underscore templating [shawnburke]

0.2.3 / 2012-07-09 
==================

  * removed; support for node 0.4.x
  * added; travis for 0.8.x

0.2.2 / 2012-06-14 
==================

  * updated; test suite
  * adding; underscore templating to subject line [danielschwartz]

0.2.1 / 2012-02-27 
==================

  * updated; test suite

0.2.0 / 2012-02-24 
==================

  * updated; changed email module to emailjs

0.1.3 / 2012-01-13 
==================

  * added; dummy SMTP server for tests
  * updated; test config
  * added; Travis CI integration

0.1.2 / 2011-11-30 
==================

  * added; pretty json printing

0.1.1 / 2011-11-30 
==================

  * fixed; uncaughtException not firing

0.1.0 / 2011-11-29 
==================

  * updated; readme docs
  * updated; changed default from to winston@[server-host]
  * updated; tests

0.0.1 / 2011-11-28 
==================

  * initial release
