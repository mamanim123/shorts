Set-Location $PSScriptRoot
foreach ($f in @(".\import.bat")) {
    $bytes = [IO.File]::ReadAllBytes($f)
    $text = [Text.Encoding]::UTF8.GetString($bytes)
    $text = $text.Replace("`r`n", "`n").Replace("`n", "`r`n")
    $enc = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllBytes($f, $enc.GetBytes($text))
    Write-Host "$f CRLF OK"
}
