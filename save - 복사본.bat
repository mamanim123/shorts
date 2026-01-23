@echo off
title Save - Git Push

echo.
echo ========================================
echo   [INFO] Git Push
echo ========================================
echo.

cd /d "%~dp0"

set /p confirm="Start git push? (Y/N): "
if /i not "%confirm%"=="Y" (
  echo Cancelled.
  goto :end
)

echo.
echo [Checking changes]
git status --short

set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1

set HAS_UNPUSHED=
for /f %%A in ('git log origin/master..HEAD --oneline 2^>nul') do set HAS_UNPUSHED=1

if not defined HAS_CHANGES (
  if not defined HAS_UNPUSHED (
    echo.
    echo No changes to save and no commits to push.
    goto :end
  )
  echo.
  echo No new changes, but found unpushed commits. Pushing...
  goto :push
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

:push
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
