# Complete Deployment Guide

## Overview

This guide shows you how to deploy the complete WFDD Mini Crossword system with score tracking.

## Prerequisites

- Google Account (for Apps Script and Sheets)
- Web hosting for the frontend (can be any static host)

## Part 1: Backend Setup (Google Apps Script)

### 1.1 Create Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank sheet
3. Rename it to "WFDD Mini Scores"
4. In row 1, add these headers exactly:
   ```
   date | email | score | timeLeft | revealsLetter | revealsWord | userAgent | timestamp
   ```

### 1.2 Create Apps Script
1. Go to [Google Apps Script](https://script.google.com)
2. Click "New Project"
3. Name it "WFDD Mini Scores API"
4. Replace all code with the contents from `apps-script/Code.gs`
5. Create a new file called `appsscript.json`
6. Replace its contents with the JSON from `apps-script/appsscript.json`

### 1.3 Link Script to Sheet
1. In Apps Script, click the "Resources" or "Libraries" menu
2. If you need to link to a specific sheet, update the `getSheet()` function
3. Or use the simpler approach: make the script "container-bound" to your sheet

### 1.4 Deploy Web App
1. Click "Deploy" → "New deployment"
2. Choose "Web app" as the type
3. Set execute as "Me"
4. Set access to "Anyone"
5. Click "Deploy"
6. **Copy the web app URL** - you'll need this for the frontend

### 1.5 Test Backend
1. Test the health check: visit your web app URL in a browser
2. Should return: `{"ok":true,"service":"wfdd-mini-scores"}`

## Part 2: Frontend Configuration

### 2.1 Update API URL
1. Open `Index.html`
2. Find this line:
   ```javascript
   const SCORE_API = 'https://SCRIPT_GOES_HERE/exec';
   ```
3. Replace `https://SCRIPT_GOES_HERE/exec` with your Apps Script web app URL

### 2.2 Test Locally
1. Run a local server:
   ```bash
   python3 -m http.server 8000
   ```
2. Open http://localhost:8000
3. Play a puzzle and submit a score
4. Check your Google Sheet for the new row

## Part 3: Production Deployment

### 3.1 Frontend Hosting Options

**Option A: GitHub Pages (Free)**
1. Push your code to GitHub
2. Enable GitHub Pages in repository settings
3. Your site will be at `https://username.github.io/repo-name`

**Option B: Netlify (Free)**
1. Drag your project folder to [Netlify Drop](https://app.netlify.com/drop)
2. Get instant deployment

**Option C: WFDD's Existing Infrastructure**
1. Upload files to your web server
2. Update CORS origins in Apps Script if needed

### 3.2 Update CORS Origins
If hosting on a custom domain, update the `ORIGINS` array in `Code.gs`:
```javascript
const ORIGINS = [
  'https://wfdd.org', 
  'https://your-domain.com',
  'http://localhost:8000'
];
```

### 3.3 Update Share URLs
In `showScoreUI()`, update the base URL:
```javascript
const baseUrl = 'https://your-actual-domain.com/mini';
```

## Part 4: Daily Puzzle Generation

### 4.1 Manual Generation
```bash
npm run generate
```

### 4.2 Automated Generation (Optional)
Set up a daily cron job or scheduled task:
```bash
# Run daily at 6 AM
0 6 * * * cd /path/to/project && npm run generate
```

### 4.3 Cloud Automation
- Use GitHub Actions to run the generator daily
- Or deploy the Node.js script to Google Cloud Functions
- Or use any other serverless platform

## Part 5: Monitoring & Maintenance

### 5.1 Check Google Sheet
- Monitor daily submissions
- Look for abuse patterns
- Export data for analysis

### 5.2 Apps Script Quotas
- Free tier: 6 minutes execution time per day
- Should be plenty for score submissions
- Monitor usage in Apps Script dashboard

### 5.3 Error Monitoring
- Check Apps Script logs for errors
- Monitor frontend console for submission failures
- Set up alerts if needed

## Security Notes

- The system validates email format and date format
- Keeps only the best score per user per day
- No sensitive data is stored
- CORS headers restrict access to allowed domains

## Scaling Considerations

- Google Sheets supports up to 10 million cells
- Apps Script has daily quotas but should handle normal traffic
- For high traffic, consider migrating to a proper database
- The frontend is completely static and scales infinitely

## Troubleshooting

### "Network error submitting score"
- Check Apps Script deployment is active
- Verify CORS origins include your domain
- Check browser network tab for specific errors

### "Bad JSON" errors
- Verify Apps Script code is exactly as provided
- Check that the web app has "Anyone" access
- Test the health check endpoint

### Scores not appearing in sheet
- Verify sheet name matches `SHEET_NAME` in script
- Check Apps Script execution logs
- Ensure proper headers in row 1 of sheet