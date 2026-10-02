@echo off
cd /d "%~dp0"
if not exist ".next\BUILD_ID" call npm run build
start "" http://localhost:3077
npm run start
