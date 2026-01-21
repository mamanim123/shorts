@echo off
title 종료 - Git Push

echo.
echo ========================================
echo   [종료] Git Push
echo ========================================
echo.

cd /d "%~dp0"

echo [변경사항 확인]
git status --short

echo.
set /p msg="커밋 메시지를 입력하세요 (엔터 시 'save'): "
if "%msg%"=="" set msg=save

echo.
echo [업로드 중...]
git add .
git commit -m "%msg%"
git push

echo.
echo 완료되었습니다!
echo.

pause
