@echo off
chcp 65001 >nul 2>&1
cls
title 저장 - Git Push

echo.
echo ========================================
echo   [정보] Git Push
echo ========================================
echo.

cd /d "%~dp0"

:: 현재 브랜치 감지
for /f %%A in ('git branch --show-current') do set BRANCH=%%A
echo 현재 브랜치: %BRANCH%
echo.

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
for /f %%A in ('git log origin/%BRANCH%..HEAD --oneline 2^>nul') do set HAS_UNPUSHED=1

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

:: 날짜/시간 기본 메시지 생성
for /f "tokens=1-3 delims=/" %%a in ("%date%") do set TODAY=%%a-%%b-%%c
for /f "tokens=1-2 delims=:" %%a in ("%time: =0%") do set NOW=%%a:%%b
set DEFAULT_MSG=%TODAY% %NOW% 저장

echo.
set /p msg="커밋 메시지 (기본값: '%DEFAULT_MSG%'): "
if "%msg%"=="" set msg=%DEFAULT_MSG%

echo.
echo [업로드 중...]
git add .
if errorlevel 1 (
  echo.
  echo [오류] git add 실패.
  goto :end
)

git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo [오류] 커밋 실패.
  goto :end
)

:push
echo.
echo [원격 저장소와 동기화 중...]
git pull --rebase origin %BRANCH%
if errorlevel 1 (
  echo.
  echo [오류] Pull 실패. 충돌을 확인하세요.
  goto :end
)

git push origin %BRANCH%
if errorlevel 1 (
  echo.
  echo [오류] 푸시 실패.
  goto :end
)

echo.
echo 완료!
echo.

:end
pause