@echo off
if not "%~1"=="__RUN__" (
    cmd /k "%~f0" __RUN__
    exit /b
)

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
echo [Uncommitted changes]
git status --short

set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1

set HAS_UNPUSHED=
for /f %%A in ('git log origin/master..HEAD --oneline 2^>nul') do set HAS_UNPUSHED=1

echo.
echo ----------------------------------------
echo   [Unpushed commits]
echo ----------------------------------------
git log origin/master..HEAD --oneline 2>nul
if not defined HAS_UNPUSHED (
  echo   (none)
)
echo ----------------------------------------
echo.

if not defined HAS_CHANGES (
  if not defined HAS_UNPUSHED (
    echo No changes to save and no commits to push.
    goto :end
  )
  echo No new changes, but found unpushed commits. Pushing...
  goto :push
)

set /p msg="Enter commit message (default: 'save'): "
if "%msg%"=="" set msg=save

echo.
echo [Uploading...]
git add .
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] git add failed.
  echo ========================================
  goto :end
)

git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] Commit failed.
  echo ========================================
  goto :end
)

:push
echo.
echo [Pushing to origin/master...]
git push origin master
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [FAIL] Push failed!
  echo   - Check auth or network.
  echo   - Fix: git config --global credential.helper store
  echo ========================================
  goto :end
)

echo.
echo ========================================
echo   [SUCCESS] Push complete!
echo ========================================
echo.
git log origin/master --oneline -5
echo.

:end
echo.
echo ========================================
echo   Done. You can close this window.
echo ========================================
