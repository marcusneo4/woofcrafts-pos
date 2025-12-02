# Setting Up GitHub Repository for Vercel Deployment

## Step 1: Install Git

If Git is not installed on your computer:

1. **Download Git for Windows**: https://git-scm.com/download/win
2. **Run the installer** and follow the setup wizard
3. **Restart your terminal/PowerShell** after installation
4. **Verify installation** by running:
   ```powershell
   git --version
   ```

## Step 2: Initialize Git Repository

Once Git is installed, run these commands in PowerShell (in your project directory):

```powershell
# Navigate to your project directory (if not already there)
cd "C:\Users\e0775081\Downloads\POS system"

# Initialize Git repository
git init

# Add all files
git add .

# Make your first commit
git commit -m "Initial commit: WoofCrafts POS System"
```

## Step 3: Create GitHub Repository

1. **Go to GitHub**: https://github.com
2. **Sign in** (or create an account if you don't have one)
3. **Click the "+" icon** in the top right → **"New repository"**
4. **Fill in the details**:
   - Repository name: `woofcrafts-pos` (or any name you prefer)
   - Description: "WoofCrafts Point of Sale System"
   - Visibility: **Public** (free) or **Private** (if you have GitHub Pro)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. **Click "Create repository"**

## Step 4: Connect and Push to GitHub

After creating the repository, GitHub will show you commands. Run these in PowerShell:

```powershell
# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/woofcrafts-pos.git

# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Note**: You'll be prompted for your GitHub username and password (or personal access token).

### If you need a Personal Access Token:

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "Vercel Deployment"
4. Select scopes: **repo** (all checkboxes under repo)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing

## Step 5: Deploy to Vercel

Once your code is on GitHub:

1. **Go to Vercel**: https://vercel.com
2. **Sign in** (you can use your GitHub account)
3. **Click "Add New Project"**
4. **Import your GitHub repository** (`woofcrafts-pos`)
5. **Configure**:
   - Framework Preset: **Other**
   - Root Directory: `.` (leave as default)
   - Build Command: (leave empty)
   - Output Directory: `.` (leave as default)
6. **Click "Deploy"**

Your site will be live in about 30 seconds! 🎉

## Quick Reference Commands

```powershell
# Check Git status
git status

# Add all changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push

# Pull latest changes
git pull
```


