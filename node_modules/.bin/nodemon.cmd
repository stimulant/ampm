@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\nodemon\bin\nodemon.js" %*
) ELSE (
  node  "%~dp0\..\nodemon\bin\nodemon.js" %*
)