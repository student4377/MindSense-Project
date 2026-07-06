@echo off
REM MindSense Full Stack Startup Batch File
REM Starts both ML API (port 8000) and Frontend (port 8080)

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo =========================================
echo   MindSense Stack Startup
echo =========================================
echo.

REM Start ML API in new window
echo [1/2] Starting ML API on port 8000...
start "MindSense ML API" cmd /k "cd ml && call .venv\Scripts\activate.bat && python predict_api.py --host 127.0.0.1 --port 8000"

REM Wait for ML API to initialize
echo [Waiting 6 seconds for ML API to start...]
timeout /t 6 /nobreak

REM Start Frontend in new window
echo [2/2] Starting Frontend on port 8080...
start "MindSense Frontend" cmd /k "npm run dev"

echo.
echo =========================================
echo   Stack Started!
echo =========================================
echo.
echo ML API:  http://127.0.0.1:8000
echo Frontend: http://localhost:8080
echo.
echo Close these windows to stop services.
echo =========================================
echo.
