@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Git Import

echo.
echo ========================================
echo   Git Import
echo ========================================
echo.

echo [1] GitHub 확인중...
git fetch origin

echo.
echo ========================================
echo GitHub 신규 커밋
echo ========================================
git log HEAD..origin/master --oneline

echo.
echo ========================================
echo 내 작업 상태
echo ========================================
git status --short

echo.
set /p confirm=가져오기를 진행할까요? (Y/N):

if /i not "%confirm%"=="Y" goto end

echo.
echo [2] 가져오기 진행중...
git pull --no-rebase --no-edit origin master

if not errorlevel 1 goto success

echo.
echo ========================================
echo 충돌 발생
echo ========================================
echo.
echo 1 = 내 파일 유지
echo 2 = GitHub 파일 사용
echo 3 = 취소
echo.

set /p choice=선택:

if "%choice%"=="1" goto keepmine
if "%choice%"=="2" goto keepremote
goto cancel

:keepmine
git checkout --ours .
git add .
git commit -m "keep local version"
goto success

:keepremote
git merge --abort 2>nul
git rebase --abort 2>nul
git revert --abort 2>nul
git reset --hard origin/master
git clean -fd
goto success

:cancel
git merge --abort 2>nul
git rebase --abort 2>nul
git revert --abort 2>nul
echo 취소됨
goto end

:success
echo.
echo ========================================
echo 완료
echo ========================================
git log --oneline -5

:end
pause