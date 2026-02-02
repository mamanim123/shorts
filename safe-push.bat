@echo off
title SAFE PUSH - Git

cd /d "%~dp0"

echo.
echo ========================================
echo   SAFE PUSH - Git
echo ========================================
echo.

REM Check if on master branch, if not switch to it
for /f "tokens=*" %%A in ('git branch --show-current 2^>nul') do set CURRENT_BRANCH=%%A
if not "%CURRENT_BRANCH%"=="master" (
  echo [WARNING] Not on master branch! Current: %CURRENT_BRANCH%
  echo Switching to master...
  git checkout master
  if errorlevel 1 (
    echo.
    echo ========================================
    echo   [ERROR] Cannot switch to master!
    echo   Fix this manually before push.
    echo ========================================
    goto :fail
  )
  echo Switched to master.
  echo.
)

REM Check for detached HEAD
git symbolic-ref HEAD >nul 2>&1
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] HEAD is detached!
  echo   Run: git checkout master
  echo ========================================
  goto :fail
)

echo [1/5] Checking changes...
git status --short
echo.

set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1

set HAS_UNPUSHED=
for /f %%A in ('git log origin/master..HEAD --oneline 2^>nul') do set HAS_UNPUSHED=1

if not defined HAS_CHANGES (
  if not defined HAS_UNPUSHED (
    echo No changes and no unpushed commits.
    echo Nothing to do.
    goto :success
  )
  echo No new changes, but found unpushed commits.
  goto :push
)

echo [2/5] Enter commit message
set /p msg="Message (default: 'save'): "
if "%msg%"=="" set msg=save

echo.
echo [3/5] Adding files...
git add .
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] git add failed!
  echo ========================================
  goto :fail
)
echo Done.

echo.
echo [4/5] Committing...
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] git commit failed!
  echo ========================================
  goto :fail
)
echo Done.

:push
echo.
echo [5/5] Pushing to GitHub...
git push origin master
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] git push failed!
  echo   Check your internet or token.
  echo ========================================
  goto :fail
)

echo.
echo ========================================
echo   VERIFYING PUSH...
echo ========================================
git fetch origin >nul 2>&1
for /f %%A in ('git rev-parse HEAD') do set LOCAL_HEAD=%%A
for /f %%A in ('git rev-parse origin/master') do set REMOTE_HEAD=%%A

if "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
  goto :success
) else (
  echo.
  echo ========================================
  echo   [ERROR] Push verification failed!
  echo   Local and remote do not match.
  echo ========================================
  goto :fail
)

:success
echo.
echo ========================================
echo ========================================
echo.
echo        PUSH SUCCESS!!!
echo.
echo   GitHub is now up to date.
echo.
echo ========================================
echo ========================================
echo.
pause
exit /b 0

:fail
echo.
echo ========================================
echo ========================================
echo.
echo        PUSH FAILED!!!
echo.
echo   DO NOT CLOSE THIS WINDOW.
echo   Check the error message above.
echo.
echo ========================================
echo ========================================
echo.
:retry
echo.
set /p retry="Try again? (Y/N): "
if /i "%retry%"=="Y" (
  echo.
  echo Retrying push...
  git push origin master
  if errorlevel 1 (
    echo.
    echo [ERROR] Still failed!
    goto :retry
  )
  echo.
  echo Verifying...
  git fetch origin >nul 2>&1
  for /f %%A in ('git rev-parse HEAD') do set LOCAL_HEAD=%%A
  for /f %%A in ('git rev-parse origin/master') do set REMOTE_HEAD=%%A
  if "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
    goto :success
  ) else (
    echo Verification failed!
    goto :retry
  )
)
echo.
echo Push was not completed. Fix the issue and try again.
echo.
pause
exit /b 1