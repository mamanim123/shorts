[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================"
Write-Host "  저장하기 - 내 PC 작업을 GitHub에 올리기"
Write-Host "========================================"

git fetch origin

Write-Host ""
Write-Host "[GitHub에 있고 내 PC에는 없는 커밋]"
git log HEAD..origin/master --oneline

Write-Host ""
Write-Host "[내 PC 변경사항]"
git status --short

Write-Host ""
$confirm = Read-Host "저장하고 올릴까요? (Y/N)"
if ($confirm -notin @("Y","y")) { pause; exit }

$msg = Read-Host "커밋 메시지 입력"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "save" }

git add .
git commit -m "$msg"

Write-Host ""
Write-Host "[GitHub로 업로드 중]"
git push origin master

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[완료] 저장 성공"
    git log --oneline -5
    pause
    exit
}

Write-Host ""
Write-Host "========================================"
Write-Host "  업로드 실패"
Write-Host "========================================"
Write-Host "GitHub에 내 PC에 없는 작업이 있을 수 있습니다."
$force = Read-Host "그래도 내 PC 상태를 강제로 올릴까요? (Y/N)"

if ($force -in @("Y","y")) {
    git push --force-with-lease origin master
}

pause
