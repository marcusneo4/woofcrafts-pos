@echo off
echo Creating .env file...

(
echo EMAIL_HOST=smtp.gmail.com
echo EMAIL_PORT=587
echo EMAIL_USER=your-email@example.com
echo EMAIL_PASS=your-email-app-password
echo EMAIL_FROM=WoofCrafts ^<your-email@example.com^>
echo PORT=8000
) > .env

echo.
echo .env file created!
echo.
echo Starting server with email support...
echo.

node server.js
