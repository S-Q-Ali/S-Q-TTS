@echo off
setlocal
title S-Q-TTS Studio - Split Windows Terminal

:: Check if wt.exe is available
where wt.exe >nul 2>&1
if errorlevel 1 (
    echo  Windows Terminal not found. Falling back to unified single window runner...
    call "%~dp0start-all.bat"
    exit /b 0
)

:: Clear previous port conflicts
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001,3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Auto-open browser in background
start /b "" powershell -NoProfile -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000'" >nul 2>&1

:: Launch Windows Terminal with side-by-side split panes
wt.exe -d "%~dp0" cmd /k "title Next.js Frontend && npm run dev" ; split-pane -V -d "%~dp0voice-clone-server" cmd /k "title FastAPI Voice Backend && venv\Scripts\activate && python server.py"
exit /b 0
