#!/bin/bash

# Quick setup script for WFDD Mini Crossword GitHub deployment
# Run this from your project root directory

set -e

echo "🚀 Setting up WFDD Mini Crossword for GitHub deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "Index.html" ]; then
    echo "❌ Error: Run this script from your project root (where package.json and Index.html are)"
    exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
fi

# Check for GitHub remote
if ! git remote get-url origin >/dev/null 2>&1; then
    echo "🔗 Please add your GitHub repository as origin:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo ""
    read -p "Enter your GitHub repository URL: " repo_url
    git remote add origin "$repo_url"
fi

# Create initial commit if no commits exist
if ! git rev-parse HEAD >/dev/null 2>&1; then
    echo "📝 Creating initial commit..."
    git add .
    git commit -m "Initial commit: WFDD Mini Crossword"
fi

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "1. Go to your GitHub repository"
echo "2. Click Settings → Pages"  
echo "3. Set Source to 'GitHub Actions'"
echo "4. Go to Actions tab and run 'Build & Deploy WFDD Mini'"
echo "5. Your site will be live at: https://YOUR_USERNAME.github.io/YOUR_REPO/"
echo ""
echo "📚 See GITHUB_DEPLOYMENT.md for detailed instructions"