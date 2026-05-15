# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ampm (application management + performance monitoring) is a Node.js process supervisor and dashboard for long-running, public-facing installations (kiosks, exhibits, signage). It launches a target application, monitors heartbeats over WebSocket/OSC, restarts on crash/leak/schedule, ships logs to email/Loggly/Google Analytics, and exposes a web console at `http://localhost:8888`.

It is published to npm as a global CLI (`bin: start.js`), and is intended to be installed alongside `nodemon` globally.

## Commands

There is no build, lint, or test pipeline in this repo — it's plain CommonJS Node.

```sh
npm install            # install deps
npm install -g nodemon # required peer; ampm spawns it
npm link               # install this checkout as the global `ampm` command (preferred for local dev)

ampm                   # run with ./ampm.json, default scheme
ampm ampm.json dev     # run with a specific scheme
ampm a.json,b.json dev # multiple configs; first is active, switch via console
sudo ampm ampm.json    # required if you want machine restart/shutdown to work
```

There is no `package.json` `scripts` block and no test runner configured. If you add tests or linting, also wire pre-push hooks per the user's global rules.

## Architecture

`start.js` → `server.js` → 5 globals. Read this in order before changing process behavior.

### Two-process supervisor pattern

`start.js` (the `ampm` bin) does **not** run the server directly. It spawns `nodemon` as a child, which then runs `server.js`. This indirection exists so ampm can restart itself by touching `ampm-restart.json` (which nodemon watches). On Windows, `start.js` jumps through hoops to resolve `nodemon` and `ampm` paths via `where` and rewrite `Program Files` → `PROGRA~1` to dodge a long-standing Node child_process spaces-in-path bug (see GH issue link in `start.js`). If you change install layout or yarn detection, retest on Windows.

`server.js` runs the actual supervisor. It boots five global singletons in a fixed order (network → persistence → logging → consoleState → plugin), exposed as `$$network`, `$$persistence`, `$$logging`, `$$consoleState`, `$$plugin`, plus `$$config` (merged config) and `$$serverState` (persisted state). Modules talk to each other via these globals — there is no DI. Adding a new module means following this same pattern.

### Layered config merge (server.js:46-80)

Config files are JSONC (parsed by `comment-json`) with `%ENVVAR%` interpolation done before parse. The merge order matters and is not obvious:

1. `default` scheme
2. Each segment of the CLI scheme arg, accumulated. `dev.foo` merges `default` → `dev` → `dev.foo`.
3. `<hostname>` scheme (machine-specific, applied automatically)
4. `<hostname>.<scheme-segments>`, accumulated the same way

So a key set in `MACHINENAME.dev` overrides `dev`, which overrides `default`. If a config has no `default` key at all, the whole file is ingested as-is (single-config mode). After merge, `process.chdir` moves into the config file's directory so all relative paths in the config resolve against the config file, not the ampm install.

### The five subsystems (model/)

All extend `BaseModel` (Backbone-on-Node). `BaseModel.initialize` copies the `config` constructor option onto model attributes — subclasses must call `BaseModel.prototype.initialize.apply(this)` first.

- **`network.js`** — owns Express, the HTTP server, socket.io (two ports: console and app), and a node-osc client/server pair. Wires up Passport HTTP digest auth only when `$$config.permissions` exists. The console's `/` route, the JSON `/config` endpoint, and `/static` (serves `view/`) all live here.
- **`persistence.js`** — spawns and supervises the target app (`launchCommand`) and optional `sideCommand`. Listens for `heart` events from both OSC and the app socket, manages `heartbeatTimeout` / `startupTimeout` / `maxMemory` restart triggers, and runs `later.js` cron schedules for shutdown/restart of app and PC. PC-level restart on Windows uses `tools/nircmd.exe`.
- **`logging.js`** — fan-out winston logger to file, console, daily-rotating event TSV, screenshot-on-crash, Google Analytics (universal-analytics), Loggly, and SMTP. Levels: `info` / `warn` / `error`; mail defaults to `error` only.
- **`consoleState.js`** — backs the web console. Polls CPU/memory (uses `TYPEPERF` on Windows, `top` on Mac via long-lived child processes), throttles updates over the console socket, exposes `fullConfig()` which strips passwords before sending to the browser.
- **`serverState.js`** — tiny KV store persisted to `ampm-state.json` with a 1s debounce. Holds `runApp` (so a manual shutdown survives an ampm restart) and `configFile` (so the active config in multi-config mode survives restarts).

### Custom plugins

`$$config.plugin` points to a JS file exporting a `Plugin` class with a `boot()` method. `boot()` is called after persistence boots. Plugins are how you add app-specific endpoints, custom socket message handlers, or sync between multiple ampm instances. See `samples/web/server/server.js` for the canonical example.

### Web console (view/)

Static, no build step. `view/index.html` + `view/view.js` (Backbone view) + vendored libs in `view/libs/`. Loaded by Express from `network.js`. Talks to the server over the same socket.io port as the HTTP server (`socketToConsolePort`, default 8888). Auth (when enabled) is HTTP digest at the page level, then `passport.socketio` rides the session cookie to the socket.

### Application integration contract

The monitored app talks to ampm via two channels (samples in `samples/{web,Cinder,Unity3D,WPF,processing,python3,Unreal}` show each):

- **Web/Node apps**: socket.io to `network.socketToAppPort` (default 3001). Emit `heart`, `log {level,message}`, `event {Category,Action,Label,Value}`, `restart`. `configRequest` round-trips the merged config.
- **Native apps**: OSC over UDP. App → server on `oscFromAppPort` (3002), server → app on `oscToAppPort` (3003). Same message names; payload is JSON-encoded as the OSC string arg (see `network.js:_handleOsc`).

When changing the protocol, update **all** sample apps — they're the docs and the regression suite.

## Conventions specific to this repo

- Globals are intentional (`$$config`, `$$network`, etc.). Don't refactor to DI without a strong reason — every module reaches across via these.
- The codebase is ES5 / pre-class CommonJS targeting old Node. No async/await, no `let`/`const`, no arrow functions in `model/`. Match the surrounding style when editing existing files.
- Dependencies are pinned to old majors (lodash 3, socket.io 1.x, express 4, winston 2). Upgrades are breaking and should be scoped deliberately.
- `tools/nircmd.exe` is a vendored Windows utility used for PC shutdown/restart and crash screenshots — do not delete.
- `ampm-state.json` and `ampm-restart.json` are written next to the config file at runtime and are gitignored.

## Releasing

The npm version, the git tag (commit subject like `1.7.10`), and `package.json#version` are kept in lockstep manually — there is no release script.
