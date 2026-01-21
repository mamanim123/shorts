@echo off
title END - Git Push

echo.
echo ========================================
echo   END - Git Push
echo ========================================
echo.

cd /d "%~dp0"

echo Changed files:
git status --short

echo.
set /p msg="Commit message (Enter=save): "
if "%msg%"=="" set msg=save

echo.
git add .
git commit -m "%msg%"
git push

if %errorlevel% neq 0 (
    echo.
    echo ERROR!
    pause
    exit /b 1
)

echo.
echo DONE! Pushed to GitHub.
echo.

pause
