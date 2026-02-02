$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$baseDir = Split-Path -Parent $scriptDir
$backupRoot = Join-Path $baseDir 'backups\project-backups'
if (-not (Test-Path $backupRoot)) {
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
}
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archivePath = Join-Path $backupRoot ($timestamp + '-project-src-backup.zip')

$excludeDirs = 'node_modules','dist','backups\project-backups','.git','user_data','user_data_debug','user_data_stealth'
$excludeExt = '.png','.jpg','.jpeg','.gif','.webp','.mp4','.mov','.avi','.mkv','.webm'

$basePrefix = if ($baseDir.EndsWith('\')) { $baseDir } else { $baseDir + '\' }
$files = Get-ChildItem -Path $baseDir -Recurse -File -Force | Where-Object {
    $relative = $_.FullName.Substring($basePrefix.Length)
    if ($_.Name -ieq 'nul') { return $false }
    foreach ($dir in $excludeDirs) {
        if ($relative -like ("$dir*")) { return $false }
    }
    $excludeExt -notcontains $_.Extension.ToLower()
}

if ($files.Count -eq 0) {
    Write-Host 'No files to back up.' -ForegroundColor Yellow
    exit 0
}

if (Test-Path $archivePath) {
    Remove-Item $archivePath
}

$paths = $files | ForEach-Object { $_.FullName }
Compress-Archive -CompressionLevel Optimal -DestinationPath $archivePath -Path $paths

Write-Host 'Source backup completed.' -ForegroundColor Green
Write-Host "- Backup file: $archivePath"
Write-Host '- Excluded: node_modules, dist, backups/project-backups, .git, image/video extensions'
Write-Host 'Copy the zip to another location if needed.'
