# WoofCrafts POS - Git Setup Script
# Run this script AFTER installing Git

Write-Host "🐾 WoofCrafts POS - Git Setup" -ForegroundColor Green
Write-Host ""

# Check if Git is installed
$gitCheck = Get-Command git -ErrorAction SilentlyContinue
if ($null -eq $gitCheck) {
    Write-Host "✗ Git is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host "2. Run the installer" -ForegroundColor Cyan
    Write-Host "3. Restart PowerShell and run this script again" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "✓ Git is installed" -ForegroundColor Green
Write-Host ""
Write-Host "Initializing Git repository..." -ForegroundColor Yellow

# Initialize Git
git init
Write-Host "✓ Git repository initialized" -ForegroundColor Green

# Add all files
git add .
Write-Host "✓ Files added to staging" -ForegroundColor Green

# Make initial commit
git commit -m "Initial commit: WoofCrafts POS System"
Write-Host "✓ Initial commit created" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Create a repository on GitHub.com" -ForegroundColor White
Write-Host "2. Copy the repository URL" -ForegroundColor White
Write-Host "3. Run these commands:" -ForegroundColor White
Write-Host ""
Write-Host "   git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git" -ForegroundColor Cyan
Write-Host "   git branch -M main" -ForegroundColor Cyan
Write-Host "   git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "See GITHUB_SETUP.md for detailed instructions!" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
