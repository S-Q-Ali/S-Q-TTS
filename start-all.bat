@echo off
title S-Q-TTS Studio
echo.
echo  ╔═══════════════════════════════════════════╗
echo  ║      S-Q-TTS Studio - Full Launch         ║
echo  ║   Frontend (Next.js) + Backend (FastAPI)  ║
echo  ╚═══════════════════════════════════════════╝
echo.

:: Check if voice-clone-server venv exists
if not exist "voice-clone-server\venv" (
    echo  [ERROR] Voice server not set up! Run voice-clone-server\setup.bat first.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo  [ERROR] Node modules missing! Run: npm install
    pause
    exit /b 1
)

echo  [1/2] Starting Python Voice Clone Server on http://localhost:8001 ...
start "S-Q-TTS Backend" /MIN cmd /k "cd /d %~dp0voice-clone-server && venv\Scripts\activate && python server.py"

echo  Waiting 3s for backend to start...
timeout /t 3 /nobreak >nul

echo  [2/2] Starting Next.js Frontend on http://localhost:3000 ...
start "S-Q-TTS Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo  ✅ Both servers launching!
echo.
echo  ┌─────────────────────────────────────────┐
echo  │  Frontend:  http://localhost:3000        │
echo  │  Backend:   http://localhost:8001        │
echo  │  API Docs:  http://localhost:8001/docs   │
echo  └─────────────────────────────────────────┘
echo.
echo  Press any key to open the app in your browser...
pause >nul
start "" "http://localhost:3000"
