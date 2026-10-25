@echo off
title Push JobCopilot to GitHub (Balu-142)
cd /d "c:\Users\DELL\.gemini\antigravity-ide\scratch\job_copilot"
cls
echo ================================================================================
echo       JobCopilot Pro - Pushing to GitHub (Balu-142/job-copilot)
echo ================================================================================
echo.
echo Linking remote and pushing to GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/Balu-142/job-copilot.git
git branch -M main
echo.
echo Uploading project files to https://github.com/Balu-142/job-copilot ...
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ================================================================================
    echo  🎉 SUCCESS! All files are now live on GitHub:
    echo  https://github.com/Balu-142/job-copilot
    echo.
    echo  Opening Render Dashboard in your browser...
    start https://dashboard.render.com
    echo.
    echo  On Render:
    echo  1. Click "New +" -^> "Web Service"
    echo  2. Select "job-copilot"
    echo  3. Click "Deploy Web Service"
    echo ================================================================================
) else (
    echo.
    echo [NOTE] If a browser tab popped up asking to Authorize GitHub, click "Authorize".
)
echo.
pause
