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

set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1
if not defined HAS_CHANGES (
  echo.
  echo 변경사항이 없습니다. 업로드를 건너뜁니다.
  goto :end
)

echo.
set /p msg="커밋 메시지를 입력하세요 (엔터 시 'save'): "
if "%msg%"=="" set msg=save

echo.
echo [업로드 중...]
git add .
if errorlevel 1 (
  echo.
  echo [오류] git add 실패. 권한/경로를 확인하세요.
  goto :end
)

git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo [오류] 커밋 실패. 메시지/훅/상태를 확인하세요.
  goto :end
)

git push origin master
if errorlevel 1 (
  echo.
  echo [오류] 푸쉬 실패. 인증(PAT) 또는 네트워크를 확인하세요.
  echo   - 해결: git config --global credential.helper store
  echo   - 다음 실행에서 토큰 입력
  goto :end
)

echo.
echo 완료되었습니다!
echo.

:end
pause