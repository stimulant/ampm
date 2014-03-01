:: Check for the node installation.
WHERE node.exe
IF %ERRORLEVEL% NEQ 0 (
	ECHO You need to install nodejs.
	PAUSE
	START http://nodejs.org
	GOTO :EOF
)

:: Install supervisor.
WHERE supervisor.cmd
IF %ERRORLEVEL% NEQ 0 (
	CALL npm install -g supervisor 
)

:: Launch ampm.
CD app\ampm
supervisor ^
	--watch .,..\ampm-test\wpf-test\config.json ^
	--ignore .git,node_modules,view,samples,logs,app,content,state.json ^
	--extensions js,json ^
	--no-restart-on error ^
	--quiet ^
	-- server.js ..\..\config_live.json
