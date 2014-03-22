@ECHO OFF

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

:: Don't run if node is already running.
TASKLIST /FI "IMAGENAME eq node.exe" 2>NUL | FIND /I /N "node.exe">NUL
IF %ERRORLEVEL% == 0 (
	ECHO Looks like node is already running.
	PAUSE
	GOTO: EOF
)

:: Run the local ampm and just watch the restart file.
cd app\ampm
supervisor ^
	--watch restart.json ^
	--ignore * ^
	--extensions js,json ^
	--no-restart-on error ^
	--quiet ^
	-- server.js ..\..\config.json live
