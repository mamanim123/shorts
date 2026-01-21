import os

start_content = '''@echo off
chcp 949 > nul
title Git Pull - 작업 시작

echo.
echo ========================================
echo   작업 시작 - 최신 코드 가져오기
echo ========================================
echo.

cd /d "%~dp0"

echo 최신 코드 가져오는 중...
git pull

if %errorlevel% neq 0 (
    echo.
    echo 오류 발생! 수동으로 확인해주세요.
    pause
    exit /b 1
)

echo.
echo 완료! 최신 코드로 업데이트되었습니다.
echo.

pause
'''

end_content = '''@echo off
chcp 949 > nul
title Git Push - 작업 끝

echo.
echo ========================================
echo   작업 끝 - 코드 저장하고 올리기
echo ========================================
echo.

cd /d "%~dp0"

echo 변경된 파일:
git status --short

echo.
set /p msg="커밋 메시지 입력 (Enter만 누르면 '작업 저장'): "
if "%msg%"=="" set msg=작업 저장

echo.
echo 파일 추가 중...
git add .

echo 커밋 중...
git commit -m "%msg%"

echo GitHub에 올리는 중...
git push

if %errorlevel% neq 0 (
    echo.
    echo 오류 발생! 수동으로 확인해주세요.
    pause
    exit /b 1
)

echo.
echo 완료! GitHub에 저장되었습니다.
echo 수고하셨습니다!
echo.

pause
'''

with open('start.bat', 'w', encoding='cp949') as f:
    f.write(start_content)
print('start.bat 생성 완료')

with open('end.bat', 'w', encoding='cp949') as f:
    f.write(end_content)
print('end.bat 생성 완료')
