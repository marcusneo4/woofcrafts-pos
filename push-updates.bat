@echo off
cd /d "C:\Users\e0775081\Downloads\POS system"
echo === Checking Git Status ===
git status

echo.
echo === Adding all changes ===
git add .

echo.
echo === Checking what will be committed ===
git status

echo.
echo === Creating commit ===
git commit -m "Add email template files and updates"

echo.
echo === Pushing to GitHub ===
git push origin main

echo.
echo === Done! ===
pause
