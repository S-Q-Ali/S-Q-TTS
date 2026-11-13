@echo off
echo ========================================
echo   S-Q-TTS Voice Clone Server Setup
echo ========================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.11 from python.org
    pause
    exit /b 1
)

REM Create virtual environment
if not exist "venv" (
    echo [1/4] Creating virtual environment...
    python -m venv venv
) else (
    echo [1/4] Virtual environment already exists.
)

REM Activate venv
echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

REM Install PyTorch CPU (for MX250 2GB VRAM - CPU is better)
echo [3/4] Installing PyTorch (CPU)...
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

REM Install requirements
echo [4/4] Installing Chatterbox TTS and dependencies...
pip install -r requirements.txt

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo To start the server, run:
echo   venv\Scripts\activate.bat
echo   python server.py
echo.
echo Server will be available at: http://localhost:8001
echo First run will download the model (~2GB).
echo.
pause
