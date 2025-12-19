# Quick Credential Checker for WoofCrafts POS
# Run this script to check for potential exposed credentials

Write-Host "`n🔍 Checking for Exposed Credentials...`n" -ForegroundColor Cyan

# Check what files are tracked by Git
Write-Host "📁 Files currently tracked by Git:" -ForegroundColor Yellow
Write-Host "==================================`n" -ForegroundColor Yellow
git ls-files | Select-String -Pattern "(credential|secret|key|password|token|api)" -CaseSensitive:$false

# Check for hardcoded email patterns
Write-Host "`n📧 Searching for hardcoded emails in tracked files:" -ForegroundColor Yellow
Write-Host "==================================================`n" -ForegroundColor Yellow
git grep -i "email.*@.*\.com" -- "*.js" "*.html" "*.json" 2>$null | Select-String -Pattern "@gmail|@outlook|@yahoo" -CaseSensitive:$false

# Check for API keys and tokens
Write-Host "`n🔑 Searching for potential API keys/tokens:" -ForegroundColor Yellow
Write-Host "==========================================`n" -ForegroundColor Yellow
git grep -E "(api[_-]?key|api[_-]?secret|access[_-]?token|public[_-]?key)" -i -- "*.js" "*.html" 2>$null

# Check .gitignore coverage
Write-Host "`n🛡️ Current .gitignore protection:" -ForegroundColor Yellow
Write-Host "================================`n" -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    Get-Content ".gitignore" | Select-String -Pattern "(credential|secret|env|key|password)" -CaseSensitive:$false
} else {
    Write-Host "❌ No .gitignore file found!" -ForegroundColor Red
}

# Summary
Write-Host "`n✅ Scan Complete!" -ForegroundColor Green
Write-Host "================`n" -ForegroundColor Green
Write-Host "Review the results above. Any sensitive data found should be:" -ForegroundColor White
Write-Host "1. Removed from the code (use environment variables)" -ForegroundColor White
Write-Host "2. Added to .gitignore" -ForegroundColor White
Write-Host "3. Rotated if already exposed in Git history`n" -ForegroundColor White

Write-Host "📖 For detailed report, see: SECURITY_AUDIT_REPORT.md`n" -ForegroundColor Cyan
