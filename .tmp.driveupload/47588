@echo off
chcp 65001 > nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\project-backup.ps1"
if %errorlevel% neq 0 (
  echo Backup failed. Please check the console output.
) else (
  echo Backup completed successfully.
)
pause
