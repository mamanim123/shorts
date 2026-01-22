@echo off

echo.
echo ========================================
echo   [시작] Git Pull
echo ========================================
echo.

cd /d "%~dp0"

echo 최신 코드 가져오는 중...
git pull --ff-only origin master
if errorlevel 1 (
  echo.
  echo [오류] 가져오기 실패. 인증 또는 로컬 변경/충돌을 확인하세요.
  echo   - 인증: git config --global credential.helper store
  echo   - 변경 보관: git stash push -u -m "home-local-backup"
  goto :end
)

echo.
echo 완료! 작업을 시작하세요.
echo.

:end
pause