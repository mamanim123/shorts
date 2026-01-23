@echo off
title Import - Git Pull

echo.
echo ========================================
echo   [INFO] Git Pull
echo ========================================
echo.

cd /d "%~dp0"

set /p confirm="Start git pull? (Y/N): "
if /i not "%confirm%"=="Y" (
  echo Cancelled.
  goto :end
)

echo.
echo Fetching latest code...
git pull --ff-only origin master
if errorlevel 1 (
  echo.
  echo [ERROR] Pull failed. Please check authentication or local changes/conflicts.
  echo   - Auth: git config --global credential.helper store
  echo   - Stash local: git stash push -u -m "home-local-backup"
  goto :end
)

echo.
echo Done! Ready to work.
echo.

:end
pause
