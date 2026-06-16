$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "========================================"
Write-Host "  가져오기 (GitHub -> 내 PC)"
Write-Host "========================================"
Write-Host ""

$confirm = Read-Host "가져오기 할까요? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "취소했습니다."
    return
}

Write-Host ""
Write-Host "최신 코드 가져오는 중..."
git pull --no-rebase --no-edit origin master
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[성공] 가져오기 완료!" -ForegroundColor Green
    return
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  [경고] 가져오기 실패 - 충돌 또는 로컬 변경" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
$force = Read-Host "내 PC 작업 버리고 GitHub 것으로 덮어쓸까요? (Y/N)"
if ($force -ne "Y" -and $force -ne "y") {
    Write-Host "덮어쓰기 취소. 되돌립니다..."
    git merge --abort 2>$null
    Write-Host "아무것도 변경하지 않았습니다."
    return
}

Write-Host ""
Write-Host "GitHub 것으로 강제 동기화 중..."
git merge --abort 2>$null
git fetch origin
git reset --hard origin/master
git clean -fd
Write-Host ""
Write-Host "[성공] GitHub 것으로 덮어쓰기 완료!" -ForegroundColor Green