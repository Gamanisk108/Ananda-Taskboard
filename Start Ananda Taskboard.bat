@echo off
title Ananda Taskboard
cd /d "%~dp0backend"

echo ============================================
echo   Ananda Taskboard - starting up...
echo   (Keep this window open while you use it.)
echo   Close this window to stop the app.
echo ============================================
echo.

REM Apply any database updates
venv\Scripts\python.exe manage.py migrate --noinput

REM Open the app in your default browser after a short delay
start "" cmd /c "timeout /t 3 >nul & start http://localhost:8000"

REM Run the server (serves both the app and the data). This blocks - that's normal.
venv\Scripts\python.exe manage.py runserver 8000

echo.
echo Ananda Taskboard stopped. You can close this window.
pause
