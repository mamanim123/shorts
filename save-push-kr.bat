@echo off
setlocal

if /i not "%~1"=="__in__" (
  start "save-push-kr" powershell -NoExit -ExecutionPolicy Bypass -File "%~f0" __in__
  exit /b
)

powershell -NoExit -ExecutionPolicy Bypass -File "%~f0"
