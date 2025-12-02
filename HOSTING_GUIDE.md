# WoofCrafts POS - Hosting & Setup Guide

## Free Hosting Options for Small Team (5 users max)

### Option 1: Vercel (Recommended - Easiest)
**Best for:** Quick deployment, automatic HTTPS, free tier

1. **Sign up** at [vercel.com](https://vercel.com) (free)
2. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```
3. **Deploy:**
   ```bash
   cd "C:\Users\e0775081\Downloads\POS system"
   vercel
   ```
4. **Access:** Your site will be live at `your-project.vercel.app`
5. **Share URL** with your team (5 people max)

**Pros:**
- Free forever for personal projects
- Automatic HTTPS
- Fast global CDN
- Easy updates (just run `vercel` again)

**Cons:**
- No server-side features (but you're using EmailJS/Sheets, so that's fine)

---

### Option 2: Netlify (Similar to Vercel)
**Best for:** Simple static hosting

1. **Sign up** at [netlify.com](https://netlify.com) (free)
2. **Drag and drop** your project folder to Netlify dashboard
3. **Or use CLI:**
   ```bash
   npm install -g netlify-cli
   netlify deploy
   ```

**Pros:**
- Free tier
- Easy deployment
- Automatic HTTPS

---

### Option 3: GitHub Pages (Free)
**Best for:** If you want to use GitHub

1. **Create GitHub repository**
2. **Push your code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPO_URL
   git push -u origin main
   ```
3. **Enable GitHub Pages** in repository settings
4. **Access:** `yourusername.github.io/repo-name`

**Pros:**
- Completely free
- Version control included

**Cons:**
- Requires GitHub account
- Slightly more setup

---

### Option 4: Firebase Hosting (Google)
**Best for:** If you're already using Google services

1. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```
2. **Login:**
   ```bash
   firebase login
   ```
3. **Initialize:**
   ```bash
   firebase init hosting
   ```
4. **Deploy:**
   ```bash
   firebase deploy
   ```

**Pros:**
- Free tier
- Fast CDN
- Easy integration with Google services

---

## Email Setup (EmailJS)

### Step 1: Create EmailJS Account
1. Go to [emailjs.com](https://www.emailjs.com)
2. Sign up (free tier allows 200 emails/month)
3. Verify your email

### Step 2: Add Gmail Service
1. In EmailJS dashboard, go to **Email Services**
2. Click **Add New Service**
3. Select **Gmail**
4. Connect your Gmail account (marcusneo4@gmail.com)
5. **Copy the Service ID** (you'll need this)

### Step 3: Create Email Template
1. Go to **Email Templates**
2. Click **Create New Template**
3. Use this template:

**Subject:** `Your WoofCrafts Order Confirmation`

**Content:**
```
Hello {{customer_name}},

Thank you for your order with WoofCrafts! Here are your order details:

Items:
{{order_items}}

Subtotal: {{subtotal}}
Discount: {{discount}}
Total: {{total}}

Phone: {{customer_phone}}

We appreciate your business!

Best regards,
The WoofCrafts Team
marcusneo4@gmail.com
```

4. **Copy the Template ID**

### Step 4: Get Public Key
1. Go to **Account** → **General**
2. **Copy your Public Key**

### Step 5: Update Configuration
Edit `js/email.js` and replace:
- `YOUR_PUBLIC_KEY` with your EmailJS Public Key
- `YOUR_SERVICE_ID` with your Gmail Service ID
- `YOUR_TEMPLATE_ID` with your Template ID

---

## Google Sheets Setup (Database)

### Step 1: Create Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "WoofCrafts Orders"
4. Add headers in row 1:
   - Timestamp | Customer Name | Email | Phone | Items | Total | Discount
5. **Copy the Spreadsheet ID** from the URL:
   - URL looks like: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID` part

### Step 2: Enable Google Sheets API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Sheets API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. **Copy the API Key**
6. (Optional) Restrict the API key to Sheets API only for security

### Step 3: Share Sheet (Optional)
1. In your Google Sheet, click **Share**
2. Make it accessible to anyone with the link (or specific emails)
3. This allows the API to write to it

### Step 4: Update Configuration
Edit `js/sheets.js` and replace:
- `YOUR_SPREADSHEET_ID` with your Spreadsheet ID
- `YOUR_GOOGLE_API_KEY` with your API Key

### Step 5: Initialize Sheet
Open browser console on your site and run:
```javascript
initializeSheets()
```

---

## Local Development

### Running Locally
1. **Install Node.js** (if not already installed)
2. **Run server:**
   ```bash
   node server.js
   ```
3. **Or use the batch file:**
   - Double-click `start-server.bat` (Windows)
   - Or run `start-server.ps1` in PowerShell

4. **Access:** http://localhost:8000

---

## Security Notes

1. **API Keys:** Never commit API keys to public repositories
2. **EmailJS:** Free tier is fine for 5 users (200 emails/month)
3. **Google Sheets:** Consider restricting API key to specific domains
4. **HTTPS:** All hosting options above provide free HTTPS

---

## Troubleshooting

### Email not sending?
- Check EmailJS dashboard for errors
- Verify Service ID, Template ID, and Public Key are correct
- Check browser console for errors

### Sheets not saving?
- Verify API key is correct
- Check that Sheets API is enabled
- Verify spreadsheet ID is correct
- Check browser console for errors

### Hosting issues?
- Make sure all files are uploaded
- Check that `index.html` is in the root
- Verify all JavaScript files are accessible

---

## Quick Start Checklist

- [ ] Choose hosting option (Vercel recommended)
- [ ] Deploy site
- [ ] Set up EmailJS account
- [ ] Configure Gmail service in EmailJS
- [ ] Create email template
- [ ] Update `js/email.js` with EmailJS credentials
- [ ] Create Google Sheet
- [ ] Enable Google Sheets API
- [ ] Get API key
- [ ] Update `js/sheets.js` with credentials
- [ ] Test email sending
- [ ] Test Sheets saving
- [ ] Share URL with team

---

## Support

For issues:
1. Check browser console (F12) for errors
2. Check EmailJS dashboard for email errors
3. Verify all API keys are correct
4. Test locally first before deploying

