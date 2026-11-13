@echo off
echo ========================================
echo   Starting S-Q-TTS Voice Clone Server
echo ========================================
echo.

if not exist "venv" (
    echo [ERROR] Virtual environment not found! Please run setup.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
echo Starting FastAPI server on http://localhost:8001 ...
python server.py
pause
