$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$baseDir = Split-Path -Parent $scriptDir
$backupRoot = Join-Path $baseDir 'backups\project-backups'
if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
}
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $backupRoot ($timestamp + '-project-backup.zip')

$excludeDirs = @('backups\project-backups', 'node_modules\.cache')
$excludeExt = @('.png','.jpg','.jpeg','.gif','.webp','.mp4','.mov','.avi','.mkv','.webm')

$basePrefix = if ($baseDir.EndsWith('\')) { $baseDir } else { $baseDir + '\' }
$files = Get-ChildItem -Path $baseDir -Recurse -File -Force | Where-Object {
    $relative = $_.FullName.Substring($basePrefix.Length)
    $inExcludedDir = $false
    foreach ($dir in $excludeDirs) {
        if ($relative -like ("$dir*")) { $inExcludedDir = $true; break }
    }
    if ($inExcludedDir) { return $false }
    $excludeExt -notcontains $_.Extension.ToLower()
}

if ($files.Count -eq 0) {
    Write-Host '백업할 파일을 찾지 못했습니다.' -ForegroundColor Yellow
    exit 0
}

if (Test-Path $archivePath) {
    Remove-Item $archivePath
}

$paths = $files | ForEach-Object { $_.FullName }
Compress-Archive -CompressionLevel Optimal -DestinationPath $archivePath -Path $paths

Write-Host 'Project backup completed.' -ForegroundColor Green
Write-Host "- Backup file: $archivePath"
Write-Host '- Excluded: backups/project-backups, node_modules/.cache, image/video extensions'
Write-Host 'You can copy the zip file to another location if needed.'
