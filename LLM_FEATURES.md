# LLM-Enhanced Crossword Features

## Smart News-Based Clue Generation

When `LLM_ENABLED=true`, the system creates intelligent, contextual crossword clues:

### How It Works

1. **Article Fetching**: Downloads full HTML content from RSS URLs
2. **Content Extraction**: Uses JSDOM to extract readable text (up to 2000 chars)
3. **Smart Prompting**: Sends context to OpenAI with news-specific instructions
4. **Clue Generation**: Creates 60-character clues that reference the news without spoilers

### Enhanced Word Selection

**Title Priority**: Words from article titles get priority (often better crossword material)

**Context Tracking**: Each word remembers which story it came from for better clues

**Smart Sorting**: 
- Title words ranked higher than summary words  
- Unique words preferred over common ones
- Alphabetical as tiebreaker

### Sample LLM-Generated Clues

Instead of generic clues like "In today's coverage", you'll get contextual ones:

**Traditional**: `SCHOOL → "Educational institution"`  
**LLM-Enhanced**: `SCHOOL → "Winston-Salem district facing budget cuts"`

**Traditional**: `RIVER → "Flows through the Triad"`  
**LLM-Enhanced**: `RIVER → "Waterway mentioned in flooding coverage"`

### Cost & Performance

- **Model**: `gpt-4o-mini` (cheapest OpenAI option)
- **Budget**: Max 8 API calls per puzzle (~$0.01-0.02 per day)
- **Caching**: Same word+article combinations reuse cached clues
- **Timeout**: 5 second limit per call
- **Fallback**: Always generates valid puzzle even if LLM fails

### Configuration

#### GitHub Repository Secrets:
```
OPENAI_API_KEY: your-actual-api-key
LLM_ENABLED: true
```

#### Local Development (.env):
```bash
OPENAI_API_KEY=your-actual-api-key
LLM_ENABLED=true  
LLM_MODEL=gpt-4o-mini
```

### Monitoring LLM Usage

Check workflow logs for:
```
Generating LLM clue for RIVER (1/8)
Generating LLM clue for SCHOOL (2/8)
✅ LLM clue cached: "Winston-Salem district facing budget cuts"
```

### Quality Improvements

**Smarter Word Selection**:
- Prioritizes proper nouns and title words
- Tracks word context (title vs summary)
- Better crossword-suitable vocabulary

**Contextual Clues**:
- References current local events
- Connects to Triad community topics
- Maintains journalistic neutrality
- Avoids spoilers while being specific

**Cache Intelligence**:
- Reuses clues for same word+article combinations
- Persists across days for efficiency
- Prevents duplicate API spending

This creates puzzles that feel current, local, and engaging while maintaining traditional crossword standards!