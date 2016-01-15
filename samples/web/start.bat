@ECHO OFF

:: The ampm config file to load.
SET CONFIGFILE=samples\web\config.json

:: The version of node to check for.
SET TESTEDNODE=v4.2.4

:: Make sure node is installed.
WHERE node.exe 2>NUL
IF %ERRORLEVEL% NEQ 0 (
	ECHO You need to install nodejs %TESTEDNODE%. Go to nodejs.org.
	PAUSE
	GOTO :EOF
)

:: Make sure node is the right version.
for /f "delims=" %%a in ('node -v') do @set NODEVER=%%a
IF %NODEVER% NEQ %TESTEDNODE% (
	ECHO You need to install nodejs %TESTEDNODE%. Go to nodejs.org.
	PAUSE
	GOTO :EOF
)

:: Make sure nodemon is installed.
WHERE nodemon.cmd 2>NUL
IF %ERRORLEVEL% NEQ 0 (
	ECHO You need to install nodemon. Run "npm install -g nodemon" from an admin command prompt.
	PAUSE
	GOTO :EOF
)

:: Install server dependencies.
cd server
call npm install
cd ..

:: Start ampm, watch the config.json file for changes.
:START
CD ..\..\
call npm install
SET RESTARTFILE=restart.json
nodemon ^
	--verbose ^
	--watch %CONFIGFILE% ^
	--watch %RESTARTFILE% ^
	--watch . ^
	--ignore logs ^
	--ignore state.json ^
	server.js %CONFIGFILE% %AMPMMODE%
