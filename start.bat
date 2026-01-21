@echo off
title START - Git Pull

echo.
echo ========================================
echo   START - Git Pull
echo ========================================
echo.

cd /d "%~dp0"

git pull

if %errorlevel% neq 0 (
    echo.
    echo ERROR!
    pause
    exit /b 1
)

echo.
echo DONE! Ready to work.
echo.

pause
