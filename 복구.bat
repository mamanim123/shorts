@echo off
title Git 복구 도구

echo.
echo ========================================
echo   Git 복구 도구
echo ========================================
echo.

cd /d "%~dp0"

echo [로컬 변경사항 확인]
git status --short
echo.

echo   복구 방법 선택
echo ----------------------------------------
echo   1. revert (안전, 기록 남김)
echo   2. reset --force (기록 삭제, 위험)
echo   3. 취소
echo ----------------------------------------
echo.

set /p choice="선택하세요 (1/2/3): "

if "%choice%"=="1" goto REVERT
if "%choice%"=="2" goto RESET
if "%choice%"=="3" goto CANCEL
goto CANCEL

:REVERT
echo.
echo [최근 커밋 목록]
echo ----------------------------------------
setlocal enabledelayedexpansion
set i=0
for /f "tokens=*" %%a in ('git log --pretty^=format:"%%h [%%ci] %%s" -10') do (
    set /a i+=1
    echo   !i!. %%a
)
endlocal
echo ----------------------------------------
echo.
set /p count="몇 번째 전 커밋으로 되돌릴까요? (1=직전, 2=두번째전...): "
if "%count%"=="" set count=1
echo.
echo [revert 방식으로 복구 - 최근 %count%개 커밋 되돌리기]
git stash
git revert HEAD~%count%..HEAD --no-edit
if errorlevel 1 (
    echo.
    echo [에러] revert 실패!
    git stash pop
    goto END
)
git stash pop
echo.
set /p confirm="push 하시겠습니까? (y/n): "
if /i "%confirm%"=="y" (
    git push
    echo 복구 완료!
) else (
    echo push 취소됨. 로컬 revert 커밋은 유지됩니다.
)
goto END

:RESET
echo.
echo [최근 커밋 목록]
echo ----------------------------------------
setlocal enabledelayedexpansion
set i=0
for /f "tokens=*" %%a in ('git log --pretty^=format:"%%h [%%ci] %%s" -10') do (
    set /a i+=1
    echo   !i!. %%a
)
endlocal
echo ----------------------------------------
echo.
set /p count="몇 번째 전 커밋으로 되돌릴까요? (1=직전, 2=두번째전...): "
if "%count%"=="" set count=1
echo.
echo ※ 주의: 최근 %count%개 커밋이 완전히 삭제됩니다!
set /p confirm="정말 진행하시겠습니까? (y/n): "
if /i not "%confirm%"=="y" goto CANCEL
echo.
echo [reset 방식으로 복구]
git reset --hard HEAD~%count%
if errorlevel 1 (
    echo.
    echo [에러] reset 실패!
    goto END
)
git push --force
echo 복구 완료!
goto END

:CANCEL
echo.
echo 취소되었습니다.
goto END

:END
echo.
pause