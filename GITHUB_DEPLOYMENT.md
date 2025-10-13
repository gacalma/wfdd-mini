# GitHub Actions & Pages Deployment Guide

This guide walks you through setting up automated daily puzzle generation and deployment using GitHub Actions and GitHub Pages.

## Prerequisites

- GitHub account
- Local git repository with your crossword project

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `wfdd-crossword` or `wfdd-mini`
3. Keep it public (required for free GitHub Pages)
4. Don't initialize with README (you'll push existing code)

## Step 2: Push Your Local Code

From your project directory:

```bash
# Initialize git if not already done
git init

# Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: WFDD Mini Crossword"

# Push to GitHub
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (in the repository, not your account)
3. Scroll down to **Pages** in the left sidebar
4. Under "Build and deployment":
   - Source: **GitHub Actions**
   - (This enables the new GitHub Pages experience)

## Step 4: Set Up Environment Variables (Optional)

If you want to enable LLM-powered clues in the automated workflow:

1. In your repository, go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:
   - Name: `OPENAI_API_KEY`, Value: your OpenAI API key
   - Name: `LLM_ENABLED`, Value: `true`

If you skip this step, the workflow will generate puzzles using heuristic clues (which works fine).

## Step 5: Run the Workflow

### Manual Test Run
1. Go to **Actions** tab in your repository
2. Click **Build & Deploy WFDD Mini**
3. Click **Run workflow** → **Run workflow**
4. Watch the workflow run in real-time

### What the Workflow Does
1. **Checks out code** from your repository
2. **Sets up Node.js** and installs dependencies
3. **Generates today's puzzle** (skips if already exists)
4. **Prunes old puzzles** (removes files >120 days old)
5. **Commits new puzzle** to the repository
6. **Deploys to GitHub Pages**

## Step 6: Access Your Live Site

After the first successful workflow run:

1. Go to **Settings** → **Pages**
2. You'll see your site URL: `https://YOUR_USERNAME.github.io/YOUR_REPO/`
3. Click the URL to test your live crossword

## Daily Automation

The workflow runs automatically every day at:
- **11:05 UTC** = **7:05 AM Eastern** (during standard time)
- **11:05 UTC** = **6:05 AM Eastern** (during daylight time)

To adjust the time, edit `.github/workflows/build.yml`:
```yaml
schedule:
  - cron: "5 11 * * *"  # Change this line
```

Use [crontab.guru](https://crontab.guru/) to help with cron syntax.

## Repository Structure After Deployment

```
your-repo/
├── .github/workflows/build.yml    # Automated workflow
├── Index.html                     # Main crossword game
├── package.json                   # Node.js dependencies
├── scripts/generate.js            # Puzzle generator
├── public/puzzles/               # Generated puzzles
│   ├── 2025-10-13.json
│   ├── 2025-10-14.json
│   └── ...
└── apps-script/                  # Backend API files
    ├── Code.gs
    └── appsscript.json
```

## Troubleshooting

### Workflow Fails on First Run
- **Check Node.js version**: Ensure your `package.json` works with Node 18
- **Missing dependencies**: Run `npm install` locally to verify
- **RSS feeds down**: The generator should fall back to built-in words

### No New Puzzle Generated
- **Check workflow logs**: Click on the failed job to see error details
- **Timezone issues**: Workflow runs in UTC, converts to Eastern time
- **File already exists**: Workflow skips generation if puzzle exists

### GitHub Pages Not Updating
- **Check Pages settings**: Ensure "GitHub Actions" is selected as source
- **Wait for propagation**: Can take a few minutes for changes to appear
- **Clear browser cache**: Try hard refresh or incognito mode

### Old Puzzles Not Pruned
- **Date parsing**: The pruning logic requires YYYY-MM-DD format filenames
- **Permissions**: Workflow should have write access to delete files

## Customization Options

### Change Generation Time
Edit the cron schedule in `.github/workflows/build.yml`:
```yaml
# Run at 6:00 AM Eastern
- cron: "10 11 * * *"  # 11:10 UTC
```

### Adjust Pruning Period
Change the 120-day limit:
```bash
cutoff=$(date -d "90 days ago" +%s)  # Keep 90 days instead
```

### Add Notifications
Add Slack/Discord notifications on success/failure:
```yaml
- name: Notify on failure
  if: failure()
  # Add your notification step here
```

## Security Notes

- **Repository is public**: Don't commit API keys or secrets
- **Use GitHub Secrets**: For any sensitive configuration
- **Bot commits**: Uses a generic bot account for automated commits
- **Minimal permissions**: Workflow only has access to contents and pages

## Monitoring

### Daily Checks
- **Visit your site** each morning to verify new puzzle
- **Check Actions tab** for workflow success/failure
- **Monitor repository size** (GitHub has limits)

### Weekly Reviews
- **Verify old puzzles** are being pruned automatically  
- **Check RSS feeds** are still accessible
- **Review Google Sheet** for score submissions

## Scaling Considerations

### GitHub Limits
- **Repository size**: 1GB soft limit, 100GB hard limit
- **Actions minutes**: 2,000 free minutes/month for public repos
- **Pages bandwidth**: 100GB/month, 10 builds/hour

### Growing Beyond GitHub
If your crossword becomes very popular:
- **Static CDN**: Move to Cloudflare, AWS S3, etc.
- **Dedicated domain**: Point custom domain to GitHub Pages
- **Database backend**: Replace Google Sheets with proper database
- **Caching**: Add service worker for offline play

## Success Checklist

- ✅ Repository created and code pushed
- ✅ GitHub Pages enabled (Actions source)
- ✅ Workflow runs successfully
- ✅ Live site accessible at GitHub Pages URL  
- ✅ New puzzle appears after workflow run
- ✅ Today's generated puzzle loads automatically
- ✅ Score submission works (if Apps Script configured)
- ✅ Social sharing buttons work with correct URLs

Your WFDD Mini Crossword is now fully automated and deployed! 🎉