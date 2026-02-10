Set-Location $PSScriptRoot
$bytes = [IO.File]::ReadAllBytes(".\save.bat")
$text = [Text.Encoding]::UTF8.GetString($bytes)
$text = $text.Replace("`r`n", "`n").Replace("`n", "`r`n")
$enc = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllBytes(".\save.bat", $enc.GetBytes($text))
Write-Host "save.bat CRLF OK"
