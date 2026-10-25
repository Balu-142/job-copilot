@echo off
title JobCopilot Pro - Global Live Server & QR Code Launcher
set "APP_DIR=c:\Users\DELL\.gemini\antigravity-ide\scratch\job_copilot"
if exist "%~dp0package.json" (
    cd /d "%~dp0"
) else (
    cd /d "%APP_DIR%"
)
cls
echo ================================================================================
echo               JobCopilot Pro - Launching Live Global Service
echo ================================================================================
echo.
echo Starting backend server and establishing high-reliability Cloudflare HTTP/2 tunnel...
echo.
npm run share
pause
