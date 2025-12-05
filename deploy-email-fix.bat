@echo off
cd /d "C:\Users\e0775081\Downloads\POS system"

echo ============================================
echo   Deploying Email Fix to GitHub Pages
echo ============================================
echo.

echo [1/4] Staging all changes...
git add -A

echo.
echo [2/4] Showing what will be committed...
git status

echo.
echo [3/4] Creating commit...
git commit -m "Fix email functionality for GitHub Pages deployment

- Replace Node.js backend with EmailJS for static hosting
- Add EmailJS library to pos.html
- Update sendOrderEmail() to use EmailJS client-side API
- Configure EmailJS credentials (Public Key, Service ID, Template ID)
- Add dog-themed email templates
- Add EMAILJS_SETUP.md guide
- Email sending now works on GitHub Pages!"

echo.
echo [4/4] Pushing to GitHub...
git push origin main

echo.
echo ============================================
echo   Done! Check GitHub Actions in ~30 seconds
echo ============================================
echo.
echo Your site: https://marcusneo4.github.io/[your-repo-name]/
echo Actions: https://github.com/marcusneo4/[your-repo-name]/actions
echo.
pause
