@echo off
title S-Q-TTS Studio - Shutdown

echo.
echo  ╔═══════════════════════════════════════════════════════════════╗
echo  ║               S-Q-TTS STUDIO - SHUTDOWN                       ║
echo  ║       Stopping Frontend (3000) and Backend (8001)...          ║
echo  ╚═══════════════════════════════════════════════════════════════╝
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001,3000 -ErrorAction SilentlyContinue | ForEach-Object { $id = $_.OwningProcess; Write-Host ('Stopping process ' + $id + ' on port ' + $_.LocalPort + '...'); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }"

echo.
echo  ✅ All S-Q-TTS server processes stopped cleanly!
echo.
timeout /t 2 /nobreak >nul
exit /b 0
