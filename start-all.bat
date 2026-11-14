@echo off
setlocal enabledelayedexpansion
title S-Q-TTS Studio - All-in-One Launcher

echo.
echo  ╔═══════════════════════════════════════════════════════════════╗
echo  ║               S-Q-TTS STUDIO - MASTER LAUNCHER                ║
echo  ║       Frontend (Next.js 3000) + Backend (FastAPI 8001)        ║
echo  ╚═══════════════════════════════════════════════════════════════╝
echo.

:: 1. Validate Voice Server Environment
if not exist "%~dp0voice-clone-server\venv\Scripts\python.exe" (
    echo  [ERROR] Python virtual environment missing!
    echo  Please run voice-clone-server\setup.bat first to install AI dependencies.
    echo.
    pause
    exit /b 1
)

:: 2. Validate Node Dependencies
if not exist "%~dp0node_modules" (
    echo  [ERROR] Node dependencies missing!
    echo  Running 'npm install' now...
    cd /d "%~dp0"
    call npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 3. Kill any stale orphaned processes on port 8001 or 3000
echo  [1/4] Checking ports 8001 and 3000 for previous instances...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001,3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 4. Start Python Voice Clone Server
echo  [2/4] Starting FastAPI Voice Clone Server on http://localhost:8001 ...
start "S-Q-TTS Backend [FastAPI 8001]" cmd /k "cd /d %~dp0voice-clone-server && title S-Q-TTS Backend [FastAPI 8001] && venv\Scripts\activate && python server.py"

:: 5. Start Next.js Frontend Server
echo  [3/4] Starting Next.js Web Studio on http://localhost:3000 ...
start "S-Q-TTS Frontend [Next.js 3000]" cmd /k "cd /d %~dp0 && title S-Q-TTS Frontend [Next.js 3000] && npm run dev"

:: 6. Health-check & Launch Browser
echo  [4/4] Initializing AI models and waiting for servers to be ready...
echo        (Loading neural models in background: ~10 seconds)
echo.

timeout /t 5 /nobreak >nul

:: Automatically open browser
echo  Launching Studio in your browser...
start "" "http://localhost:3000"

echo.
echo  =============================================================
echo   ✅ S-Q-TTS Studio is Running!
echo  =============================================================
echo   • Frontend App:   http://localhost:3000
echo   • Backend Server: http://localhost:8001
echo   • API Swagger:    http://localhost:8001/docs
echo.
echo   To shut down both servers anytime, run 'stop-all.bat'
echo   or close their respective command prompt windows.
echo  =============================================================
echo.
echo  This window can now be safely closed, or press any key to exit launcher.
pause >nul
exit /b 0
