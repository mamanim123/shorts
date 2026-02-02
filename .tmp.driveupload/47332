@echo off
chcp 65001 > nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\project-backup-src.ps1"
if %errorlevel% neq 0 (
  echo Source backup failed. Please check the console output.
) else (
  echo Source backup completed successfully.
)
pause
