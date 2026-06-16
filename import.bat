@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Git Import

echo.
echo ========================================
echo   Git Import - pull from GitHub
echo ========================================
echo.

set /p confirm=Start import from GitHub? Y/N: 
if /i not "%confirm%"=="Y" goto end

git fetch origin
git pull --no-rebase --no-edit origin master
if not errorlevel 1 goto success

echo.
echo ========================================
echo   Import failed
echo ========================================
echo Conflict or local changes detected.
echo.
set /p force=Discard local state and use GitHub? Y/N: 
if /i not "%force%"=="Y" goto cancel

git merge --abort 2>nul
git rebase --abort 2>nul
git revert --abort 2>nul
git reset --hard origin/master
git clean -fd
goto success

:cancel
git merge --abort 2>nul
git rebase --abort 2>nul
git revert --abort 2>nul
echo Cancelled.

goto end

:success
echo.
echo SUCCESS
git log --oneline -5

:end
echo.
pause
