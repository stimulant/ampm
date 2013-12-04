/*
 * windowslogs-config.js: Config that conform to commonly used Windows logging levels. 
 *
 * (C) 2012 Jose Fernando Romaniello
 * MIT LICENCE
 *
 */
 
var winlogconfig = exports;

winlogconfig.levels = {
  info: 0,
  warning: 1,
  error: 2
};

winlogconfig.colors = {
  info: 'green',
  warning: 'yellow',
  error: 'red'
};