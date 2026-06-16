@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Git Save

echo.
echo ========================================
echo   Git Save - push local work
echo ========================================
echo.

git status --short

echo.
set /p confirm=Start save and push? Y/N: 
if /i not "%confirm%"=="Y" goto end

set /p msg=Commit message default save: 
if "%msg%"=="" set msg=save

git add .
git commit -m "%msg%"

echo.
echo Pushing...
git push origin master
if not errorlevel 1 goto success

echo.
echo ========================================
echo   Push failed
echo ========================================
echo Remote has changes or conflict.
echo.
set /p force=Force push local state? Y/N: 
if /i not "%force%"=="Y" goto end

git push --force-with-lease origin master
if errorlevel 1 goto fail

:success
echo.
echo SUCCESS
git log --oneline -5
goto end

:fail
echo.
echo FAILED

:end
echo.
pause
