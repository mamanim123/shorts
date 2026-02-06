@echo off
setlocal

if /i not "%~1"=="__in__" (
  start "save-push" cmd /k ""%~f0" __in__"
  exit /b
)

title save-push

echo [INFO] Started. Press any key to continue.
pause >nul

echo [INFO] Checking status before push...
git status -sb
echo.

set /p userChoice="Proceed with push? (y/n): "
if /i not "%userChoice%"=="y" (
  echo [INFO] Push canceled.
  echo.
  pause
  exit /b 0
)

echo [INFO] Pushing...
git push

if %errorlevel%==0 (
  echo [SUCCESS] Push completed.
) else (
  echo [FAIL] Push failed. Check the output above.
)

echo.
pause
