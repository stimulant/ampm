
:: Check for the node installation.
WHERE node.exe
IF %ERRORLEVEL% NEQ 0 (
	ECHO You need to install nodejs.
	PAUSE
	START http://nodejs.org
	GOTO :EOF
)

:: Install nodemon.
WHERE nodemon.cmd
IF %ERRORLEVEL% NEQ 0 (
	CALL npm install -g nodemon 
)

:: Launch ampm.
CD app\ampm
nodemon server.js ..\..\config_live.json
