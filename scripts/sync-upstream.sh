#!/bin/bash
# Sync upstream changes into your fork

set -e  # Exit on error

echo "🔄 Syncing claude-mem upstream..."

# Fetch latest from upstream
echo "📥 Fetching upstream..."
git fetch upstream

# Update main branch
echo "🌿 Updating main branch..."
git checkout main
git merge upstream/main --ff-only  # Fast-forward only, no merge commit
git push origin main

# Update feature branch
echo "🔧 Updating remote-server branch..."
git checkout remote-server
git merge main -m "chore: sync with upstream/main"

# Check for conflicts
if [ -f .git/MERGE_HEAD ]; then
    echo "⚠️  Merge conflicts detected!"
    echo "📝 Resolve conflicts, then:"
    echo "   git add <resolved-files>"
    echo "   git commit"
    echo "   git push origin remote-server"
    exit 1
fi

echo "✅ Sync complete! Testing build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Pushing changes..."
    git push origin remote-server
    echo "🎉 All done! Your remote-server branch is up to date."
else
    echo "❌ Build failed! Fix issues before pushing."
    git merge --abort
    exit 1
fi
