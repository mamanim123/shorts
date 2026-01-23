@echo off
title Save - Git Push

echo.
echo ========================================
echo   [INFO] Git Push
echo ========================================
echo.

cd /d "%~dp0"

echo [Checking changes]
git status --short

set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1
if not defined HAS_CHANGES (
  echo.
  echo No changes to save. Skipping upload.
  goto :end
)

echo.
set /p msg="Enter commit message (default: 'save'): "
if "%msg%"=="" set msg=save

echo.
echo [Uploading...]
git add .
if errorlevel 1 (
  echo.
  echo [ERROR] git add failed. Check files/path.
  goto :end
)

git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo [ERROR] Commit failed. Check message/files/status.
  goto :end
)

git push origin master
if errorlevel 1 (
  echo.
  echo [ERROR] Push failed. Check auth (PAT) or network.
  echo   - Fix: git config --global credential.helper store
  echo   - Enter token on next run
  goto :end
)

echo.
echo Done!
echo.

:end
pause
