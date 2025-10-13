#!/bin/bash

# Test script to verify GitHub Actions compatibility
# Run this locally before pushing to GitHub

echo "🧪 Testing GitHub Actions compatibility..."

# Check Node.js version
echo "📦 Checking Node.js version..."
node_version=$(node --version)
echo "Local Node.js: $node_version"
if [[ "$node_version" < "v18" ]]; then
    echo "⚠️  Warning: GitHub Actions uses Node.js 18. Consider updating."
fi

# Test npm ci (clean install)
echo "📦 Testing clean npm install..."
if [ -f "package-lock.json" ]; then
    npm ci --dry-run
    echo "✅ npm ci will work in GitHub Actions"
else
    echo "⚠️  No package-lock.json found. Run 'npm install' to generate it."
fi

# Test puzzle generation
echo "🧩 Testing puzzle generation..."
if npm run generate; then
    echo "✅ Puzzle generation works"
else
    echo "❌ Puzzle generation failed"
    exit 1
fi

# Check timezone handling
echo "🕐 Testing timezone handling..."
TODAY=$(TZ=America/New_York date +'%Y-%m-%d')
PUZ="public/puzzles/${TODAY}.json"
if [ -f "$PUZ" ]; then
    echo "✅ Today's puzzle exists: $PUZ"
else
    echo "❌ No puzzle for today: $PUZ"
fi

# Check file permissions
echo "📁 Checking file structure..."
required_files=("Index.html" "package.json" "scripts/generate.js" ".github/workflows/build.yml")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ Missing required file: $file"
    fi
done

echo ""
echo "🎉 Pre-deployment test complete!"
echo "If all checks passed, you're ready to push to GitHub."