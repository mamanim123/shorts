@echo off
title SAFE PULL - Git

cd /d "%~dp0"

echo.
echo ========================================
echo   SAFE PULL - Git
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
  echo [WARNING] HEAD is detached! Fixing...
  git checkout master
  if errorlevel 1 (
    echo.
    echo ========================================
    echo   [ERROR] Cannot fix detached HEAD!
    echo ========================================
    goto :fail
  )
  echo Fixed.
  echo.
)

echo [1/4] Checking local status...
echo.

REM Check for uncommitted changes
set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1

if defined HAS_CHANGES (
  echo ========================================
  echo   [WARNING] You have local changes:
  echo ========================================
  git status --short
  echo.
  echo These will be DISCARDED if you continue!
  echo.
  set /p confirm1="Discard local changes and pull? (Y/N): "
  if /i not "!confirm1!"=="Y" (
    echo.
    echo Cancelled.
    goto :end
  )
)

REM Check for revert/merge in progress
if exist ".git\REVERT_HEAD" (
  echo [WARNING] Revert in progress. Aborting...
  git revert --abort 2>nul
)
if exist ".git\MERGE_HEAD" (
  echo [WARNING] Merge in progress. Aborting...
  git merge --abort 2>nul
)

echo.
echo [2/4] Fetching from GitHub...
git fetch origin
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] Cannot connect to GitHub!
  echo   - Check your internet connection
  echo   - Check your token/authentication
  echo ========================================
  goto :fail
)
echo Done.

echo.
echo [3/4] Comparing local and remote...
for /f %%A in ('git rev-parse HEAD') do set LOCAL_HEAD=%%A
for /f %%A in ('git rev-parse origin/master') do set REMOTE_HEAD=%%A

if "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
  echo.
  echo Already up to date!
  echo Local and GitHub are the same.
  goto :success
)

echo.
echo Local:  %LOCAL_HEAD%
echo Remote: %REMOTE_HEAD%
echo.
echo There are new changes on GitHub.
echo.
set /p confirm2="Download and overwrite local? (Y/N): "
if /i not "%confirm2%"=="Y" (
  echo.
  echo Cancelled.
  goto :end
)

echo.
echo [4/4] Force pulling from GitHub...
echo.

REM Reset any local changes
git reset --hard HEAD >nul 2>&1

REM Force pull
git reset --hard origin/master
if errorlevel 1 (
  echo.
  echo ========================================
  echo   [ERROR] Reset failed!
  echo   Trying alternative method...
  echo ========================================
  
  git clean -fd >nul 2>&1
  git checkout master >nul 2>&1
  git reset --hard origin/master
  
  if errorlevel 1 (
    echo.
    echo ========================================
    echo   [ERROR] All methods failed!
    echo   
    echo   Try manually:
    echo   1. Delete this folder
    echo   2. Clone again from GitHub
    echo ========================================
    goto :fail
  )
)

echo.
echo ========================================
echo   VERIFYING PULL...
echo ========================================
for /f %%A in ('git rev-parse HEAD') do set LOCAL_HEAD=%%A
for /f %%A in ('git rev-parse origin/master') do set REMOTE_HEAD=%%A

if "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
  goto :success
) else (
  echo.
  echo ========================================
  echo   [ERROR] Verification failed!
  echo   Local: %LOCAL_HEAD%
  echo   Remote: %REMOTE_HEAD%
  echo ========================================
  goto :fail
)

:success
echo.
echo ========================================
echo ========================================
echo.
echo        PULL SUCCESS!!!
echo.
echo   Local is now up to date with GitHub.
echo.
echo ========================================
echo ========================================
echo.
goto :end

:fail
echo.
echo ========================================
echo ========================================
echo.
echo        PULL FAILED!!!
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
  echo Retrying...
  git fetch origin
  if errorlevel 1 (
    echo [ERROR] Still cannot connect!
    goto :retry
  )
  git reset --hard origin/master
  if errorlevel 1 (
    echo [ERROR] Still failed!
    goto :retry
  )
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
echo Pull was not completed.
echo.

:end
pause
exit /b 0
