$path = "F:\test\쇼츠대본생성기-v3.5.3\save.bat"
$text = [IO.File]::ReadAllText($path)
$text = $text.Replace("`r`n", "`n").Replace("`n", "`r`n")
[IO.File]::WriteAllText($path, $text, [Text.Encoding]::GetEncoding(949))
