# WFDD Mini Crossword - Complete System

A fully automated daily crossword puzzle system built for WFDD public radio.

## 🎯 What This System Does

1. **Daily Puzzle Generation**: Automatically creates 5×5 crosswords from current WFDD local news and NPR stories
2. **Smart Clue Generation**: Optional OpenAI integration for contextual clues with fallback to heuristics  
3. **Score Tracking**: Google Apps Script backend for leaderboards and score submission
4. **Automated Deployment**: GitHub Actions builds and deploys puzzles daily via GitHub Pages
5. **Social Sharing**: Built-in Facebook, Twitter/X, and Bluesky sharing with emoji grids

## 🚀 Deployment Options

### Option 1: Manual Local Usage
```bash
npm install
npm run generate  # Creates today's puzzle
# Open Index.html in browser
```

### Option 2: GitHub Pages (Recommended)
1. Follow `GITHUB_DEPLOYMENT.md` 
2. Runs automatically daily at 7:05 AM Eastern
3. Deploys to `https://yourusername.github.io/yourrepo`

### Option 3: Google Apps Script Backend
1. Follow `APPS_SCRIPT_SETUP.md`
2. Enables score tracking and leaderboards
3. Completely serverless and free

## 📁 Project Structure

```
wfdd-crossword/
├── Index.html                    # Main crossword game
├── package.json                  # Node.js dependencies
├── scripts/
│   ├── generate.js              # Daily puzzle generator  
│   └── llmClues.js              # OpenAI clue enhancement
├── public/puzzles/              # Generated puzzle files
├── data/
│   ├── stopwords.txt            # Word filtering
│   └── clue-cache.json          # LLM response cache
├── apps-script/                 # Google Apps Script API
├── .github/workflows/           # GitHub Actions automation
└── docs/                        # Setup guides
```

## 🎮 Game Features

- **Timer-Based**: 60-second countdown starts on first letter
- **Smart Navigation**: Arrow keys, WASD, auto-advance typing
- **Hints & Penalties**: Reveal letter (-2s) or word (-10s)
- **Completion Detection**: Perfect/Completed/DNF end states
- **Score Submission**: Email-based leaderboard tracking
- **Social Sharing**: Emoji grid share cards

## 🛠 Technical Features

- **RSS Integration**: Live news feed processing
- **Word Extraction**: Smart filtering with stopword removal
- **Grid Generation**: Backtracking algorithm for valid crosswords
- **LLM Enhancement**: Optional OpenAI clue generation
- **Caching System**: Prevents duplicate API calls
- **Error Handling**: Graceful fallbacks at every level
- **Mobile Responsive**: Works on all screen sizes

## 📊 Backend Integration

### Google Apps Script API
- Accepts score submissions via POST JSON
- Stores in Google Sheets with deduplication
- Handles CORS and validation
- Free hosting with generous quotas

### Data Schema
```json
{
  "date": "2025-10-13",
  "email": "player@example.com", 
  "score": 52,
  "timeLeft": 32,
  "revealsLetter": 0,
  "revealsWord": 1,
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2025-10-13T09:30:00Z"
}
```

## 🔄 Automation Workflow

1. **Daily Trigger**: GitHub Actions runs at 7:05 AM Eastern
2. **Generate Puzzle**: Fetches RSS, extracts words, builds crossword
3. **Commit Changes**: Adds `public/puzzles/YYYY-MM-DD.json` to repo
4. **Deploy Site**: Updates GitHub Pages with new puzzle
5. **Cleanup**: Removes puzzles older than 120 days

## 🎯 Scoring System

- **Base Score**: Seconds remaining when completed
- **Letter Penalty**: -2 seconds per revealed letter
- **Word Penalty**: -10 seconds per revealed word
- **Perfect Score**: Completed with no hints used
- **DNF**: Did Not Finish (time expired)

## 🔧 Configuration

### Environment Variables
```bash
OPENAI_API_KEY=sk-...           # Optional: for LLM clues
LLM_ENABLED=true                # Enable/disable OpenAI
LLM_MODEL=gpt-4o-mini           # Model selection
```

### RSS Sources
- WFDD Local: `https://www.wfdd.org/local.rss`
- NPR Top Stories: `https://www.wfdd.org/tags/npr-top-stories.rss`

### Timing
- Generation: 7:05 AM Eastern daily
- Timer: 60 seconds per puzzle
- Cache: 120 days of puzzle history

## 📈 Monitoring & Analytics

### GitHub Actions
- View workflow runs in Actions tab
- Monitor generation success/failure
- Check automated commits

### Google Sheets  
- Real-time score tracking
- Player engagement metrics
- Daily completion rates

### Error Logging
- RSS feed failures → fallback words used
- LLM timeouts → heuristic clues used  
- Network errors → graceful degradation

## 🛡 Security & Privacy

- **No sensitive data**: Only email and score stored
- **CORS protection**: Limited to allowed domains
- **Input validation**: Email format, date validation
- **Rate limiting**: Google Apps Script quotas
- **Public repository**: No secrets in version control

## 📚 Documentation Files

- `GITHUB_DEPLOYMENT.md` - Complete deployment guide
- `APPS_SCRIPT_SETUP.md` - Backend API setup
- `README.md` - Basic usage instructions  
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `SHEET_TEMPLATE.md` - Google Sheets setup

## 🧪 Testing

### Local Development
```bash
./test-workflow.sh    # Pre-deployment validation
npm run generate      # Test puzzle generation
python3 -m http.server 8000  # Local testing
```

### Production Testing
- Manual workflow triggers via GitHub Actions
- Score submission verification
- Social sharing link validation
- Mobile device compatibility

## 🎉 Success Metrics

A successful deployment includes:
- ✅ Daily puzzles auto-generate without intervention
- ✅ Site loads quickly with today's puzzle
- ✅ Score submission works reliably  
- ✅ Social sharing spreads engagement
- ✅ No manual maintenance required
- ✅ Graceful handling of all error conditions

## 🚀 Ready to Deploy?

1. **Quick Start**: Run `./setup-github.sh` for guided setup
2. **Test First**: Run `./test-workflow.sh` to validate
3. **Deploy**: Push to GitHub and enable Pages
4. **Monitor**: Check Actions tab for daily runs
5. **Enjoy**: Watch your automated crossword come to life!

---

**Built with ❤️ for WFDD Public Radio**  
Bringing daily word puzzles to the Triad community through automation and modern web technology.