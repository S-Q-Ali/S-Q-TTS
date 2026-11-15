@echo off
setlocal
title S-Q-TTS Studio - Silent Background Launcher

echo  Starting S-Q-TTS Studio in background (Zero Terminals)...

:: Clear previous port conflicts
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001,3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

:: Start Python Backend hidden
powershell -NoProfile -Command "Start-Process -FilePath '%~dp0voice-clone-server\venv\Scripts\python.exe' -ArgumentList 'server.py' -WorkingDirectory '%~dp0voice-clone-server' -WindowStyle Hidden"

:: Start Next.js Frontend hidden
powershell -NoProfile -Command "Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: Wait 4s and open browser
powershell -NoProfile -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:3000'"

echo  [SUCCESS] S-Q-TTS is running silently in the background!
echo  Use 'stop-all.bat' to stop servers anytime.
timeout /t 3 /nobreak >nul
exit /b 0
