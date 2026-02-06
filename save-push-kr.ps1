[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Write-Host "[INFO] 시작되었습니다. 계속하려면 Enter 키를 누르세요."
Read-Host | Out-Null

Write-Host "[INFO] 푸쉬 전 변경사항을 확인합니다..."
git status -sb
Write-Host ""

$answer = Read-Host "푸쉬를 진행할까요? (y/n)"
if ($answer -ne 'y' -and $answer -ne 'Y') {
  Write-Host "[INFO] 푸쉬를 취소했습니다."
  Read-Host "계속하려면 Enter 키를 누르세요" | Out-Null
  exit 0
}

Write-Host "[INFO] 푸쉬를 시작합니다..."
git push

if ($LASTEXITCODE -eq 0) {
  Write-Host "[SUCCESS] 푸쉬가 완료되었습니다."
} else {
  Write-Host "[FAIL] 푸쉬에 실패했습니다. 위 메시지를 확인하세요."
}

Read-Host "계속하려면 Enter 키를 누르세요" | Out-Null
