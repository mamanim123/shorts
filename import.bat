@echo off
if not "%~1"=="__RUN__" (
    cmd /k "%~f0" __RUN__
    exit /b
)

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
  echo [ERROR] Pull failed. Check auth or local conflicts.
  echo   - Auth: git config --global credential.helper store
  echo   - Stash local: git stash push -u -m "home-local-backup"
  goto :end
)

echo.
echo ========================================
echo   [SUCCESS] Pull complete!
echo ========================================
echo.

:end
echo.
echo ========================================
echo   Done. You can close this window.
echo ========================================
