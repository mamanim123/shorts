@echo off
chcp 65001 >nul
title 저장 - Git Push

echo.
echo ========================================
echo   [정보] Git Push
echo ========================================
echo.

cd /d "%~dp0"

set /p confirm="Git push를 시작할까요? (Y/N): "
if /i not "%confirm%"=="Y" (
  echo 취소되었습니다.
  goto :end
)

echo.
echo [변경사항 확인 중]
git status --short

set HAS_CHANGES=
for /f %%A in ('git status --short') do set HAS_CHANGES=1

set HAS_UNPUSHED=
for /f %%A in ('git log origin/master..HEAD --oneline 2^>nul') do set HAS_UNPUSHED=1

if not defined HAS_CHANGES (
  if not defined HAS_UNPUSHED (
    echo.
    echo 저장할 변경사항과 푸시할 커밋이 없습니다.
    goto :end
  )
  echo.
  echo 새 변경사항은 없지만 푸시되지 않은 커밋이 있습니다. 푸시 중...
  goto :push
)

echo.
set /p msg="커밋 메시지를 입력하세요 (기본값: 'save'): "
if "%msg%"=="" set msg=save

echo.
echo [업로드 중...]
git add .
if errorlevel 1 (
  echo.
  echo [오류] git add 실패. 파일/경로를 확인하세요.
  goto :end
)

git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo [오류] 커밋 실패. 메시지/파일/상태를 확인하세요.
  goto :end
)

:push
git push origin master
if errorlevel 1 (
  echo.
  echo [오류] 푸시 실패. 인증(PAT) 또는 네트워크를 확인하세요.
  echo   - 해결: git config --global credential.helper store
  echo   - 다음 실행 시 토큰을 입력하세요
  goto :end
)

echo.
echo 완료!
echo.

:end
pause