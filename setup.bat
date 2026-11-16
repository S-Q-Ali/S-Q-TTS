@echo off
setlocal
chcp 65001 >nul
title S-Q-TTS Studio - Complete Setup

cd /d "%~dp0voice-clone-server"
call setup.bat
cd /d "%~dp0"
