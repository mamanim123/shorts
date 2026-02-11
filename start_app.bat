@echo off
:: 한글 깨짐 방지를 위한 UTF-8 설정
chcp 65001 > nul

:: 기존에 실행 중인 특정 포트의 프로세스만 종료 (포트 충돌 방지)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002') do taskkill /F /PID %%a > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a > nul 2>&1

echo.
echo ======================================================================
echo  쇼츠 대본 생성기 V3 (Web Automation Edition)
echo  서버와 클라이언트를 시작합니다...
echo ======================================================================
echo.

:: 현재 배치 파일이 있는 폴더로 이동
cd /d "%~dp0"

:: 5초 뒤에 브라우저를 자동으로 엽니다 (백그라운드 작업)
echo [알림] 서버 로딩 중... (10초 대기)
start "" cmd /c "timeout /t 10 > nul & start http://localhost:3000"

:: npm run dev 실행 (프론트엔드 + 백엔드 동시 실행)
echo [실행] 서버를 가동합니다. 잠시만 기다려주세요...
call npm run dev

pause
