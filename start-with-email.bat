@echo off
echo Creating .env file...

(
echo EMAIL_HOST=smtp.gmail.com
echo EMAIL_PORT=587
echo EMAIL_USER=marcusneo4@gmail.com
echo EMAIL_PASS=mufcfdwgpetigqou
echo EMAIL_FROM=WoofCrafts ^<marcusneo4@gmail.com^>
echo PORT=8000
) > .env

echo.
echo .env file created!
echo.
echo Starting server with email support...
echo.

node server.js
