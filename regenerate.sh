#!/bin/bash
# Force regenerate today's puzzle with fresh LLM clues

echo "🔄 Force regenerating today's puzzle..."

# Remove cache and existing puzzle
rm -f data/clue-cache.json
TODAY=$(date +'%Y-%m-%d')
rm -f "public/puzzles/${TODAY}.json"

# Generate new puzzle
npm run generate

if [ $? -eq 0 ]; then
    echo "✅ Puzzle regenerated successfully!"
    
    # Optional: commit and deploy
    read -p "Deploy to production? (y/N): " deploy
    if [[ $deploy =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "regenerate: force regenerate puzzle ${TODAY} with improved clues"
        git push
        echo "🚀 Deployed to production!"
    else
        echo "📝 Generated locally. Run 'git add . && git commit && git push' to deploy."
    fi
else
    echo "❌ Puzzle regeneration failed!"
    exit 1
fi