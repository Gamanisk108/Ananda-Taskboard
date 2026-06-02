@echo off
title Ananda Taskboard - Setup
cd /d "%~dp0"

echo ============================================
echo   Ananda Taskboard - one-time setup
echo   This installs everything and builds the app.
echo   It may take a few minutes. Please wait.
echo ============================================
echo.

echo [1/4] Setting up the server (Python)...
cd backend
if not exist venv (
  py -3.13 -m venv venv
)
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt
venv\Scripts\python.exe manage.py migrate --noinput

echo.
echo [2/4] Creating demo logins (admin@ananda.test / taskboard123)...
venv\Scripts\python.exe manage.py seed_demo

echo.
echo [3/4] Building the app screen (frontend)...
cd ..\frontend
call npm install
call npm run build

echo.
echo [4/4] Done!
echo.
echo ============================================
echo   Setup complete.
echo   To use the app: double-click "Start Ananda Taskboard.bat"
echo ============================================
cd ..
pause
