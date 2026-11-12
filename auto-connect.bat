@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo ClaudePlus needs Node.js 18 or newer.
  echo Install the current LTS from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

node -e "if (Number(process.versions.node.split('.')[0]) < 18) process.exit(1)"
if errorlevel 1 (
  echo.
  echo Your Node.js version is too old. ClaudePlus needs Node.js 18 or newer.
  echo Update Node.js from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

node "%~dp0bin\cplus.js" connect
set "CPLUS_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CPLUS_EXIT%
