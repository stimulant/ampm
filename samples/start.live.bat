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

:: Run the local ampm and just watch the restart file.
cd app\ampm
supervisor ^
	--watch restart.json ^
	--ignore * ^
	--extensions js,json ^
	--no-restart-on error ^
	--quiet ^
	-- server.js ..\..\config.live.json
