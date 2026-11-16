@echo off
setlocal
chcp 65001 >nul
title S-Q-TTS Voice Clone Server - Setup

echo ========================================
echo   S-Q-TTS Voice Clone Server Setup
echo ========================================
echo.

:: 1. Locate Python 3.11 or uv
set "PY_CMD="
if exist "E:\dev-cache\uv\python\cpython-3.11-windows-x86_64-none\python.exe" (
    set "PY_CMD=E:\dev-cache\uv\python\cpython-3.11-windows-x86_64-none\python.exe"
) else if exist "%USERPROFILE%\.local\bin\python3.11.exe" (
    set "PY_CMD=%USERPROFILE%\.local\bin\python3.11.exe"
) else (
    where uv >nul 2>&1
    if not errorlevel 1 (
        set "PY_CMD=uv"
    ) else (
        set "PY_CMD=python"
    )
)

:: 2. Create or verify venv
if not exist "venv\Scripts\python.exe" (
    echo [1/4] Creating virtual environment with Python 3.11...
    if "%PY_CMD%"=="uv" (
        uv venv venv --python 3.11
    ) else (
        "%PY_CMD%" -m venv venv
    )
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
) else (
    echo [1/4] Virtual environment ready.
)

:: 3. Activate venv
echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

:: 4. Install PyTorch CPU and NumPy 2.x
echo [3/4] Ensuring PyTorch (CPU) and NumPy are installed...
where uv >nul 2>&1
if not errorlevel 1 (
    uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu --python venv\Scripts\python.exe
    uv pip install "numpy>=2.0.0" --python venv\Scripts\python.exe
) else (
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    pip install "numpy>=2.0.0"
)

:: 5. Install Chatterbox TTS and dependencies
echo [4/4] Installing Chatterbox TTS and dependencies...
where uv >nul 2>&1
if not errorlevel 1 (
    uv pip install -r requirements.txt --python venv\Scripts\python.exe
    uv pip install "numpy>=2.0.0" --python venv\Scripts\python.exe
) else (
    pip install -r requirements.txt
    pip install "numpy>=2.0.0"
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo To start the server, run:
echo   venv\Scripts\activate.bat
echo   python server.py
echo.
echo Server will be available at: http://localhost:8001
echo.
pause
