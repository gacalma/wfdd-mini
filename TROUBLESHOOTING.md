# Troubleshooting GitHub Actions Issues

## Common Error: "Process completed with exit code 1"

This error means the workflow failed somewhere. Here's how to debug it:

### Step 1: Check the Detailed Logs

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Click on the failed workflow run
4. Click on the **build** job
5. Expand each step to see detailed logs

### Step 2: Look for These Common Issues

#### A) Dependencies Not Installing
**Error patterns:**
```
npm ERR! code ENOTFOUND
npm ERR! network request failed
```
**Fix:** Usually resolves on retry. Click "Re-run all jobs"

#### B) Puzzle Generation Failing
**Error patterns:**
```
Generator did not create public/puzzles/2025-10-13.json
npm run generate exited with code 1
```
**Common causes:**
- RSS feeds are temporarily down
- Network timeout in GitHub Actions
- Missing environment variables

#### C) LLM Configuration Issues
**Error patterns:**
```
OpenAI API error
Invalid API key
```
**Fix:** Make sure `LLM_ENABLED=false` is set in the workflow (which we just fixed)

#### D) Git Configuration Issues
**Error patterns:**
```
git push failed
Permission denied
```
**Fix:** Make sure workflow has proper permissions (should be set correctly)

### Step 3: Try These Solutions

#### Solution 1: Re-run the Workflow
Often GitHub Actions has temporary issues:
1. Go to Actions tab
2. Click the failed run  
3. Click "Re-run all jobs"

#### Solution 2: Manual Trigger
Test with a manual run:
1. Actions tab → "Build & Deploy WFDD Mini"
2. Click "Run workflow" 
3. Select "main" branch
4. Click "Run workflow"

#### Solution 3: Check Environment
Ensure these are set correctly:
- Repository is **public** (required for free GitHub Pages)
- Pages source is set to **GitHub Actions**
- Workflow permissions include `contents: write` and `pages: write`

### Step 4: Debug Locally First

Before pushing changes, test locally:
```bash
# Test the exact same commands as workflow
npm ci
mkdir -p public/puzzles data
LLM_ENABLED=false npm run generate
```

### Step 5: Check Specific Error Messages

#### "ENOTFOUND" errors
- Network connectivity issues
- Usually temporary, retry workflow

#### "Permission denied" errors  
- Repository permissions issue
- Check Settings → Actions → General → Workflow permissions

#### "File not found" errors
- Path issues or missing files
- Verify all files are committed and pushed

### Updated Workflow Features

The workflow now includes:
- ✅ **Better error messages** with emojis for clarity
- ✅ **Environment variable handling** for LLM settings
- ✅ **Debug output** showing what files are created
- ✅ **Graceful fallbacks** when RSS feeds are down

### Still Having Issues?

If the workflow still fails:

1. **Check the logs** in detail for the specific error
2. **Copy the error message** and search for it
3. **Try a different time** (RSS feeds might be temporarily down)
4. **Disable LLM completely** by ensuring `LLM_ENABLED=false`

### Next Steps After Fix

Once the workflow succeeds:
1. ✅ Check your GitHub Pages URL
2. ✅ Verify today's puzzle loads
3. ✅ Test score submission (if configured)
4. ✅ Confirm daily automation works

The workflow should now be much more robust and provide clearer error messages if something goes wrong!