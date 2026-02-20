# Sync upstream changes into your fork (Windows PowerShell)

Write-Host "🔄 Syncing claude-mem upstream..." -ForegroundColor Cyan

# Fetch latest from upstream
Write-Host "📥 Fetching upstream..." -ForegroundColor Yellow
git fetch upstream

# Update main branch
Write-Host "🌿 Updating main branch..." -ForegroundColor Yellow
git checkout main
git merge upstream/main --ff-only
git push origin main

# Update feature branch
Write-Host "🔧 Updating remote-server branch..." -ForegroundColor Yellow
git checkout remote-server
git merge main -m "chore: sync with upstream/main"

# Check for conflicts
$mergeStatus = git status | Select-String "both modified"
if ($mergeStatus) {
    Write-Host "⚠️  Merge conflicts detected!" -ForegroundColor Red
    Write-Host "📝 Resolve conflicts, then:" -ForegroundColor Yellow
    Write-Host "   git add <resolved-files>" -ForegroundColor White
    Write-Host "   git commit" -ForegroundColor White
    Write-Host "   git push origin remote-server" -ForegroundColor White
    exit 1
}

Write-Host "✅ Sync complete! Testing build..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful! Pushing changes..." -ForegroundColor Green
    git push origin remote-server
    Write-Host "🎉 All done! Your remote-server branch is up to date." -ForegroundColor Green
} else {
    Write-Host "❌ Build failed! Fix issues before pushing." -ForegroundColor Red
    git merge --abort
    exit 1
}
