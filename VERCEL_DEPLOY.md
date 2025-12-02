# Deploying WoofCrafts POS to Vercel

## Quick Deploy (Recommended)

### Option 1: Using Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? (Select your account)
   - Link to existing project? **No**
   - Project name? (Press Enter for default or enter a name)
   - Directory? (Press Enter for current directory `.`)
   - Override settings? **No**

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

### Option 2: Using Vercel Dashboard (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New Project"**
3. **Import your Git repository** (GitHub, GitLab, or Bitbucket)
   - If you don't have a Git repo, create one first:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin <your-repo-url>
     git push -u origin main
     ```
4. **Configure the project**:
   - Framework Preset: **Other**
   - Root Directory: `.` (current directory)
   - Build Command: (leave empty - it's a static site)
   - Output Directory: `.` (current directory)
5. **Click "Deploy"**

### Option 3: Deploy via GitHub

1. **Push your code to GitHub**
2. **Go to Vercel Dashboard**
3. **Click "Add New Project"**
4. **Import your GitHub repository**
5. **Vercel will auto-detect it as a static site**
6. **Click "Deploy"**

## After Deployment

1. **Your site will be live at**: `https://your-project-name.vercel.app`
2. **Custom Domain**: You can add a custom domain in the Vercel dashboard under Project Settings → Domains

## Important Notes

- ✅ **EmailJS and Google Sheets API** will work on Vercel (they're client-side)
- ✅ **No server needed** - Vercel serves static files
- ✅ **Automatic HTTPS** - Vercel provides SSL certificates
- ⚠️ **Local Storage** - Product data stored in browser localStorage will be per-user
- ⚠️ **CORS** - Make sure your Google Sheets API key allows requests from your Vercel domain

## Environment Variables (if needed)

If you need to use environment variables (though your current setup uses hardcoded keys), you can add them in:
- Vercel Dashboard → Your Project → Settings → Environment Variables

## Troubleshooting

- **404 errors**: Check that `vercel.json` is in the root directory
- **CORS errors with Google Sheets**: Update your Google Cloud Console API key restrictions to allow your Vercel domain
- **EmailJS not working**: Verify your EmailJS credentials are correct in `js/email.js`

## Updating Your Deployment

Every time you push to your Git repository, Vercel will automatically redeploy your site!


