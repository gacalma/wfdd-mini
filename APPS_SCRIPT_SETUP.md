# Google Apps Script Setup Guide

## Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new sheet named "WFDD Mini Scores"
3. In row 1 (A1:H1), add these headers:
   ```
   date | email | score | timeLeft | revealsLetter | revealsWord | userAgent | timestamp
   ```

## Step 2: Create Apps Script Project

1. Go to [Google Apps Script](https://script.google.com)
2. Click "New Project"
3. Delete the default `myFunction()` code
4. Copy the contents from `apps-script/Code.gs` into the editor
5. Click the gear icon (Project Settings)
6. Upload `apps-script/appsscript.json` as the manifest file

## Step 3: Link to Your Sheet

1. In the Apps Script editor, find this line:
   ```javascript
   const SHEET_NAME = 'WFDD Mini Scores';
   ```
2. If your sheet has a different name, update it here

## Step 4: Deploy as Web App

1. Click "Deploy" > "New deployment"
2. Click the gear icon next to "Type"
3. Select "Web app"
4. Set:
   - Description: "WFDD Mini Scores API"
   - Execute as: "Me"
   - Who has access: "Anyone"
5. Click "Deploy"
6. Copy the Web app URL (should look like: `https://script.google.com/macros/s/ABC123.../exec`)

## Step 5: Update Frontend

1. Open `Index.html`
2. Find this line in the JavaScript:
   ```javascript
   const SCORE_API = 'https://SCRIPT_GOES_HERE/exec';
   ```
3. Replace `https://SCRIPT_GOES_HERE/exec` with your Web app URL

## Step 6: Test

1. Open your crossword in a browser
2. Complete a puzzle
3. Submit your score
4. Check your Google Sheet - you should see a new row with your data

## Allowed Origins

The script allows requests from:
- `https://wfdd.org`
- `http://localhost:8000`  
- `http://127.0.0.1:8000`

Add more origins in the `ORIGINS` array if needed.