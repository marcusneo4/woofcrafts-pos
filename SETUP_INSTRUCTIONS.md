# Quick Setup Instructions

## 1. Email Configuration (EmailJS)

1. Sign up at [emailjs.com](https://www.emailjs.com) (free)
2. Add Gmail service and connect marcusneo4@gmail.com
3. Create email template (see HOSTING_GUIDE.md for template)
4. Get your Public Key, Service ID, and Template ID
5. Edit `js/email.js` and replace:
   - `YOUR_PUBLIC_KEY`
   - `YOUR_SERVICE_ID`
   - `YOUR_TEMPLATE_ID`

## 2. Google Sheets Setup (Optional - for order storage)

1. Create a Google Sheet named "WoofCrafts Orders"
2. Add headers: Timestamp | Customer Name | Email | Phone | Items | Total | Discount
3. Get Spreadsheet ID from URL
4. Enable Google Sheets API in Google Cloud Console
5. Create API Key
6. Edit `js/sheets.js` and replace:
   - `YOUR_SPREADSHEET_ID`
   - `YOUR_GOOGLE_API_KEY`

## 3. Hosting (Choose One)

### Vercel (Easiest)
```bash
npm install -g vercel
cd "C:\Users\e0775081\Downloads\POS system"
vercel
```

### Or use Netlify, GitHub Pages, or Firebase (see HOSTING_GUIDE.md)

## 4. Test

1. Run locally: `node server.js` or double-click `start-server.bat`
2. Add items to cart
3. Fill in customer email
4. Click "Send Email"
5. Email preview should open
6. Check EmailJS dashboard to confirm email was sent
7. Check Google Sheet to confirm order was saved (if configured)

## Changes Made

✅ Removed tax feature
✅ Removed "Open Order" button
✅ Removed pet name field
✅ Changed "Pay Now" to "Send Email"
✅ Email preview shows when button is clicked
✅ Configured for marcusneo4@gmail.com
✅ Added Google Sheets integration
✅ Created hosting guide

