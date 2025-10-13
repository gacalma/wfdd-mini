# WFDD One-Minute Crossword

A daily 5×5 crossword puzzle generator that creates puzzles from WFDD local news and NPR stories.

## Features

- **RSS Integration**: Fetches current stories from WFDD local and NPR RSS feeds
- **Smart Word Extraction**: Finds crossword-suitable words from news content
- **LLM-Enhanced Clues**: Optional OpenAI integration for contextual clue generation
- **Robust Fallbacks**: Works even when feeds are offline or LLM is disabled
- **Caching**: Saves LLM-generated clues to avoid re-spending on API calls

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```

3. For LLM-enhanced clues, add your OpenAI API key to `.env`:
   ```
   OPENAI_API_KEY=your_actual_key_here
   LLM_ENABLED=true
   LLM_MODEL=gpt-4o-mini
   ```

## Usage

Generate today's puzzle:
```bash
npm run generate
```

This creates `public/puzzles/YYYY-MM-DD.json` with the puzzle data.

Open `Index.html` in a browser to play the crossword.

## LLM System

When `LLM_ENABLED=true`:
- Makes up to 8 OpenAI API calls per puzzle generation
- Processes 2 clues concurrently (rate limiting)
- 5-second timeout per call
- Caches results in `data/clue-cache.json`
- Falls back to heuristic clues if LLM fails

Budget-friendly settings:
- Uses `gpt-4o-mini` by default (cheapest model)
- Limits calls to 8 per run
- Caches by word + URL + date to avoid duplicates

## Files

- `scripts/generate.js` - Main puzzle generator
- `scripts/llmClues.js` - LLM clue generation system
- `data/stopwords.txt` - Words to exclude from extraction
- `data/clue-cache.json` - LLM response cache (auto-generated)
- `public/puzzles/` - Generated puzzle JSON files

## Error Handling

The generator gracefully handles:
- RSS feeds being offline
- Invalid/missing OpenAI API keys
- Network timeouts
- LLM API errors

In all cases, it produces a valid puzzle using fallback words and heuristic clues.