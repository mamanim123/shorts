@echo off
chcp 65001 > nul

echo ======================================================================
echo  Lite Studio Launcher (Standalone-Lite)
echo ======================================================================

echo [1/3] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do taskkill /F /PID %%a > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /F /PID %%a > nul 2>&1
timeout /t 2 /nobreak > nul

echo [2/3] Starting Lite Studio...
cd /d "%~dp0"

start "LiteStudioBrowser" cmd /c "timeout /t 10 > nul && start http://localhost:3001"

echo [3/3] Running dev server...
call npm run dev

pause
