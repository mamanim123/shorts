@echo off
  chcp 65001 >nul
  title 가져오기 - Git Pull

  echo.
  echo ========================================
  echo   [정보] Git Pull
  echo ========================================
  echo.

  cd /d "%~dp0"

  for /f %%A in ('git branch --show-current') do set BRANCH=%%A
  echo 현재 브랜치: %BRANCH%
  echo.

  set /p confirm="원격 저장소에서 최신 코드를 가져올까요? (Y/N): "
  if /i not "%confirm%"=="Y" (
    echo 취소되었습니다.
    goto :end
  )

  echo.
  echo [최신 코드 가져오는 중...]
  git pull origin %BRANCH%
  if errorlevel 1 (
    echo.
    echo [오류] Pull 실패. 충돌을 확인하세요.
    goto :end
  )

  echo.
  echo 완료! 최신 코드로 업데이트되었습니다.
  echo.

  :end
  pause