@echo off
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
title S-Q-TTS Studio - Unified Engine

echo.
echo  =============================================================
echo                 S-Q-TTS STUDIO - UNIFIED RUNNER
echo         Frontend (Next.js 3000) + Backend (FastAPI 8001)
echo                  [Single Terminal Dashboard]
echo  =============================================================
echo.

:: 1. Validate Python Environment
if not exist "%~dp0voice-clone-server\venv\Scripts\python.exe" (
    echo  [ERROR] Python virtual environment missing!
    echo  Please run voice-clone-server\setup.bat first to install AI dependencies.
    echo.
    pause
    exit /b 1
)

:: 2. Validate Node Dependencies
if not exist "%~dp0node_modules" (
    echo  [ERROR] Node dependencies missing! Running 'npm install'...
    cd /d "%~dp0"
    call npm install
    if errorlevel 1 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: 3. Check if Python AI Engine is already active on port 8001
echo  [1/2] Checking AI Engine & Port Status...
set "AI_ALREADY_LOADED=0"
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue; if ($conn) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    set "AI_ALREADY_LOADED=1"
    echo   [FAST RE-CONNECT] AI Engine is ALREADY active in RAM on port 8001! (Instant 0.0s startup!)
) else (
    powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
)

:: Clear port 3000 if occupied
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: 4. Launch browser timer in background (auto-opens http://localhost:3000 in 5 seconds)
start /b "" powershell -NoProfile -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000'" >nul 2>&1

:: 5. Run Studio Pipeline
if "%AI_ALREADY_LOADED%"=="1" (
    echo  [2/2] Connecting Studio to running AI Engine on Port 8001...
    echo.
    echo  =============================================================
    echo   - Frontend App:   http://localhost:3000 (Opening in browser...)
    echo   - Backend Server: http://localhost:8001 [ACTIVE IN RAM]
    echo   - API Swagger:    http://localhost:8001/docs
    echo.
    echo   To completely shut down AI Engine & free RAM, run stop-all.bat
    echo  =============================================================
    echo.
    cd /d "%~dp0"
    call npm run dev
) else (
    echo  [2/2] Launching AI Backend and Next.js Studio together...
    echo.
    echo  =============================================================
    echo   - Frontend App:   http://localhost:3000 (Opening in browser...)
    echo   - Backend Server: http://localhost:8001 [Fast Boot & Background Warmup]
    echo   - API Swagger:    http://localhost:8001/docs
    echo.
    echo   Press CTRL+C anytime in this window to stop BOTH servers.
    echo  =============================================================
    echo.
    cd /d "%~dp0"
    call npm run dev:all
)
if errorlevel 1 (
    echo.
    echo  [ERROR] Server process stopped with an error code.
    pause
)
