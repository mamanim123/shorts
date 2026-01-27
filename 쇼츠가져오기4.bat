@echo off
chcp 65001 >nul 2>&1
title Git Pull

echo.
echo ========================================
echo   [Info] Git Pull
echo ========================================
echo.

cd /d "%~dp0"

for /f %%A in ('git branch --show-current') do set BRANCH=%%A
echo Current Branch: %BRANCH%
echo.

set /p confirm="Pull latest code from remote? (Y/N): "
if /i not "%confirm%"=="Y" (
  echo Cancelled.
  goto :end
)

echo.
echo [Resetting local changes...]
git reset --hard HEAD

echo [Pulling latest code...]
git pull origin %BRANCH%
if errorlevel 1 (
  echo.
  echo [ERROR] Pull failed. Please check manually.
  goto :end
)

echo.
echo Done! Updated to latest code.
echo.

:end
pause