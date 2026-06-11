@echo off
chcp 949 >nul

if not "%~1"=="__RUN__" (
    cmd /k "%~f0" __RUN__
    exit /b
)

title 가져오기 - Git Pull

cd /d "%~dp0"

set "PROJECT_DIR=%cd%"
set "BACKUP_ROOT=%PROJECT_DIR%\_backup"

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "DATE_TAG=%%i"
set "BACKUP_DIR=%BACKUP_ROOT%\backup_%DATE_TAG%"

echo.
echo ========================================
echo   [정보] Git Pull
echo ========================================
echo.
echo 현재 폴더: %PROJECT_DIR%
echo.

set /p confirm="가져오기를 실행할까요? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo 취소되었습니다.
    goto :end
)

:pull
echo.
echo 최신 코드 가져오는 중...
git pull --ff-only origin master

if not errorlevel 1 (
    echo.
    echo ========================================
    echo   [성공] 가져오기 완료!
    echo ========================================
    goto :end
)

echo.
echo ========================================
echo   [오류] 가져오기에 실패했습니다.
echo ========================================
echo.
echo 로컬 변경사항 또는 충돌 때문에 실패했을 수 있습니다.
echo.
echo 1. 현재 폴더를 백업하고 가져오기
echo 2. 취소
echo.

set /p menu="선택하세요 (1/2): "

if "%menu%"=="1" goto :backup_and_pull
if "%menu%"=="2" goto :cancel

echo 잘못 선택했습니다.
goto :end

:backup_and_pull
echo.
echo ========================================
echo   [정보] 백업 중...
echo ========================================
echo.

mkdir "%BACKUP_DIR%" >nul 2>&1

robocopy "%PROJECT_DIR%" "%BACKUP_DIR%" /E /XD ".git" "_backup" /XF "*.lock"

if errorlevel 8 (
    echo.
    echo [오류] 백업에 실패했습니다.
    goto :end
)

echo.
echo [성공] 백업 완료
echo 백업 위치: %BACKUP_DIR%

echo.
echo 로컬 변경사항 정리 중...
git reset --hard
git clean -fd

echo.
echo 다시 가져오는 중...
git pull --ff-only origin master

if errorlevel 1 (
    echo.
    echo [오류] 백업 후에도 가져오기에 실패했습니다.
    goto :end
)

echo.
echo ========================================
echo   [성공] 백업 후 가져오기 완료!
echo ========================================
goto :end

:cancel
echo 취소되었습니다.
goto :end

:end
echo.
echo ========================================
echo   완료되었습니다. 창을 닫아도 됩니다.
echo ========================================