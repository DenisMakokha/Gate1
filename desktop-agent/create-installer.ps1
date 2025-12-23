# Gate 1 Agent Installer Creator
# This script creates a ZIP installer package

$AppName = "Gate 1 Agent"
$Version = "1.0.0"
$SourceDir = "release\Gate 1 Agent-win32-x64"
$OutputDir = "installer"
$ZipName = "Gate1Agent-$Version-Setup.zip"

# Create output directory
if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# Create the ZIP file
Write-Host "Creating installer package..." -ForegroundColor Cyan
Compress-Archive -Path "$SourceDir\*" -DestinationPath "$OutputDir\$ZipName" -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Installer Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Output: $OutputDir\$ZipName" -ForegroundColor Yellow
Write-Host ""
Write-Host "To install:" -ForegroundColor Cyan
Write-Host "1. Extract the ZIP to your desired location"
Write-Host "2. Run 'Gate 1 Agent.exe'"
Write-Host ""
