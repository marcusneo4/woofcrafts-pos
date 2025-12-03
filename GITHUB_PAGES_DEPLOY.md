# Deploying WoofCrafts POS to GitHub Pages

This guide will help you deploy your WoofCrafts POS system to GitHub Pages for free hosting.

## Prerequisites

- A GitHub account
- Git installed on your computer
- Your WoofCrafts POS project ready to deploy

## Step 1: Push Your Code to GitHub

If you haven't already set up a Git repository, follow these steps:

### Option A: Using the Setup Script (Recommended for Windows)

Run the provided PowerShell script:

```powershell
.\setup-git.ps1
```

This script will:
- Initialize a Git repository
- Add all your files
- Create an initial commit
- Help you create a GitHub repository
- Push your code to GitHub

### Option B: Manual Setup

1. **Initialize Git repository** (if not already done):
```bash
git init
git add .
git commit -m "Initial commit - WoofCrafts POS System"
```

2. **Create a new repository on GitHub**:
   - Go to https://github.com/new
   - Name your repository (e.g., "woofcrafts-pos")
   - Don't initialize with README, .gitignore, or license
   - Click "Create repository"

3. **Connect and push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 2: Enable GitHub Pages

1. **Go to your GitHub repository settings**:
   - Navigate to your repository on GitHub
   - Click on "Settings" tab
   - Scroll down to "Pages" section in the left sidebar

2. **Configure GitHub Pages**:
   - Under "Source", select "Deploy from a branch"
   - Under "Branch", select `main` (or `master`)
   - Select `/ (root)` as the folder
   - Click "Save"

3. **Wait for deployment**:
   - GitHub will build and deploy your site
   - This usually takes 1-2 minutes
   - You'll see a message: "Your site is published at https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/"

## Step 3: Access Your POS System

Your WoofCrafts POS system is now live! 🎉

- **URL**: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`
- **Login**: The login page will appear automatically
- **Password**: `hyper` (default - you can change this in `index.html`)

Example: If your GitHub username is `johndoe` and your repository is named `woofcrafts-pos`, your URL will be:
```
https://johndoe.github.io/woofcrafts-pos/
```

## Step 4: Configure Your Services

Before using your deployed POS system, make sure to configure:

### EmailJS Setup

1. Sign up at https://www.emailjs.com (free account)
2. Create an email service (Gmail recommended)
3. Create an email template
4. Update `js/email.js` with your credentials:
```javascript
const EMAILJS_CONFIG = {
    publicKey: 'YOUR_PUBLIC_KEY',
    serviceId: 'YOUR_SERVICE_ID',
    templateId: 'YOUR_TEMPLATE_ID'
};
```
5. Commit and push the changes:
```bash
git add js/email.js
git commit -m "Configure EmailJS credentials"
git push
```

### Google Sheets Integration (Optional)

If you're using Google Sheets for data storage:

1. Follow the steps in `GOOGLE_SHEETS_SETUP.md`
2. Update `js/sheets.js` with your Web App URL
3. Commit and push:
```bash
git add js/sheets.js
git commit -m "Configure Google Sheets integration"
git push
```

## Updating Your Site

Whenever you make changes to your POS system:

1. **Save your changes locally**

2. **Commit and push to GitHub**:
```bash
git add .
git commit -m "Description of your changes"
git push
```

3. **GitHub Pages will automatically rebuild** your site within 1-2 minutes

## Custom Domain (Optional)

Want to use your own domain instead of github.io?

1. **Purchase a domain** from any domain registrar (GoDaddy, Namecheap, etc.)

2. **Configure DNS settings**:
   - Add a CNAME record pointing to `YOUR_USERNAME.github.io`
   - Or add A records to GitHub's IP addresses:
     - 185.199.108.153
     - 185.199.109.153
     - 185.199.110.153
     - 185.199.111.153

3. **Configure in GitHub**:
   - Go to Settings > Pages
   - Enter your custom domain
   - Enable "Enforce HTTPS"

4. **Create CNAME file** in your repository root:
```
yourdomain.com
```

5. **Commit and push**:
```bash
git add CNAME
git commit -m "Add custom domain"
git push
```

## File Structure for GitHub Pages

Your deployed site uses these key files:

```
Repository Root/
├── index.html           # Login page (entry point)
├── pos.html             # Main POS interface
├── products.html        # Product management
├── css/
│   └── style.css
├── js/
│   ├── app.js           # POS logic
│   ├── products.js      # Product management
│   ├── email.js         # Email functionality
│   └── sheets.js        # Google Sheets integration
├── data/
│   └── products.json    # Default products
└── .nojekyll           # Prevents Jekyll processing
```

## Troubleshooting

### Issue: Site not loading properly

**Solution**: 
- Ensure `.nojekyll` file exists in your repository root
- Check that all file paths are relative (not absolute)
- Clear browser cache and try again

### Issue: 404 errors

**Solution**:
- Verify GitHub Pages is enabled in repository settings
- Check that you're accessing the correct URL
- Ensure `index.html` exists in the root directory

### Issue: Changes not appearing

**Solution**:
- Wait 1-2 minutes for GitHub to rebuild
- Clear browser cache (Ctrl+F5)
- Check GitHub Actions tab to see deployment status

### Issue: Email not sending

**Solution**:
- Verify EmailJS configuration in `js/email.js`
- Check browser console for errors (F12)
- Ensure you've committed and pushed EmailJS config

### Issue: Products not saving

**Solution**:
- GitHub Pages is static - data is stored in browser's localStorage
- Data persists per device/browser only
- Consider setting up Google Sheets integration for cloud storage

## Security Notes

1. **Change Default Password**: 
   - Edit `index.html` and change `CORRECT_PASSWORD` value
   - Commit and push changes

2. **API Keys**: 
   - EmailJS public keys are safe to expose in client-side code
   - Google Sheets Web App URLs are also safe
   - Never commit private keys or sensitive credentials

3. **Access Control**:
   - The login is client-side only (basic protection)
   - For true security, consider using GitHub private repository
   - Or implement proper backend authentication

## Support

- GitHub Pages Documentation: https://docs.github.com/en/pages
- GitHub Pages Status: https://www.githubstatus.com/
- WoofCrafts POS Issues: Check your repository's Issues tab

## Benefits of GitHub Pages

✅ **Free hosting** - No cost for public repositories  
✅ **Automatic HTTPS** - Secure by default  
✅ **Fast CDN** - GitHub's global network  
✅ **Easy updates** - Just push to deploy  
✅ **Version control** - Track all changes  
✅ **No server management** - Fully static hosting

---

**Your WoofCrafts POS is now live on GitHub Pages! 🐾**

Happy selling! 🎉

