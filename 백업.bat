@echo off
chcp 65001 > nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\project-backup.ps1"
if %errorlevel% neq 0 (
  echo 백업 도중 오류가 발생했습니다.
) else (
  echo 백업이 완료되었습니다.
)
pause
