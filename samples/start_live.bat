@ECHO OFF

SETLOCAL
SET NODEFOUND=0
FOR %%x IN (node.exe) DO IF NOT [%%~$PATH:x]==[] SET NODEFOUND=1
IF %NODEFOUND% == 0 GOTO INSTALLNODE

IF EXIST .\ampm GOTO START
ECHO Unzipping ampm...
tools\7z x -y ampm.zip > NUL
DEL ampm.zip
RMDIR /S /Q tools

:START
node ampm/server.js ../config_live.json
EXIT

:INSTALLNODE
ECHO You need to install nodejs.
PAUSE
EXIT