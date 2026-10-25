@echo off
title Push JobCopilot to GitHub (Balu-142)
cd /d "c:\Users\DELL\.gemini\antigravity-ide\scratch\job_copilot"
cls
echo ================================================================================
echo       JobCopilot Pro - Push to GitHub (Account: Balu-142)
echo ================================================================================
echo.
echo 1. Open your browser and go to:
echo    https://github.com/new
echo.
echo 2. Type repository name: job-copilot
echo    (Leave everything else default, do NOT check README or gitignore)
echo.
echo 3. Click "Create repository"
echo.
echo ================================================================================
echo Once created, press any key to push your code automatically...
pause >nul
echo.
echo Linking remote and pushing to GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/Balu-142/job-copilot.git
git branch -M main
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo ================================================================================
    echo  SUCCESS! Your code is now live on GitHub:
    echo  https://github.com/Balu-142/job-copilot
    echo.
    echo  FINAL STEP FOR 24/7 HOSTING (Laptop can be off):
    echo  1. Open https://dashboard.render.com
    echo  2. Click "New +" -^> "Web Service"
    echo  3. Select "job-copilot" -^> Click "Deploy Web Service"
    echo ================================================================================
) else (
    echo.
    echo [ERROR] Push failed. Make sure you created 'job-copilot' at https://github.com/new
)
echo.
pause
