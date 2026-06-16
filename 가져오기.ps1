[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================"
Write-Host "  가져오기 - GitHub 내용을 내 PC로 받기"
Write-Host "========================================"

git fetch origin

Write-Host ""
Write-Host "[GitHub에 새로 있는 커밋]"
git log HEAD..origin/master --oneline

Write-Host ""
Write-Host "[내 PC 변경사항]"
git status --short

Write-Host ""
$confirm = Read-Host "가져오기를 진행할까요? (Y/N)"
if ($confirm -notin @("Y","y")) { pause; exit }

git pull --no-rebase --no-edit origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[완료] 가져오기 성공"
    git log --oneline -5
    pause
    exit
}

Write-Host ""
Write-Host "========================================"
Write-Host "  충돌이 발생했습니다"
Write-Host "========================================"
Write-Host "1 = 내 PC 파일 유지"
Write-Host "2 = GitHub 파일 사용"
Write-Host "3 = 취소"

$choice = Read-Host "선택"

if ($choice -eq "1") {
    git checkout --ours .
    git add .
    git commit -m "내 PC 파일 유지"
}
elseif ($choice -eq "2") {
    git merge --abort 2>$null
    git rebase --abort 2>$null
    git revert --abort 2>$null
    git reset --hard origin/master
    git clean -fd
}
else {
    git merge --abort 2>$null
    git rebase --abort 2>$null
    git revert --abort 2>$null
    Write-Host "취소했습니다."
}

pause
