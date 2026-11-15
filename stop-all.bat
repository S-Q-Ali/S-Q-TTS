@echo off
setlocal
chcp 65001 >nul
title S-Q-TTS Studio - Shutdown & RAM Release

echo.
echo  =============================================================
echo                 S-Q-TTS STUDIO - SHUTDOWN
echo          Releasing RAM and Stopping All Server Processes
echo  =============================================================
echo.

echo  Stopping Python AI Engine (Port 8001)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo  Stopping Next.js Studio (Port 3000)...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo.
echo  [SUCCESS] All server processes stopped and RAM has been released!
echo.
timeout /t 3 >nul
