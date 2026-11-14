@echo off
rem Starts FanMap locally (development server) and opens it in the browser.
rem Double-click this file. Keep the black window open while you use the app;
rem close it to stop the server.
cd /d "%~dp0"
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
npm run dev
pause
