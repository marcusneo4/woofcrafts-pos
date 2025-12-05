# 🐾 Nodemailer Setup Guide for WoofCrafts POS

## 📦 Step 1: Install Required Packages

Open PowerShell in your project folder and run:

```bash
npm install
```

This will install:
- `nodemailer` - For sending emails
- `dotenv` - For managing email credentials securely

---

## 🔑 Step 2: Set Up Email Credentials

### Option A: Using Gmail (Recommended for Testing)

1. **Create a Gmail App Password:**
   - Go to your Google Account: https://myaccount.google.com/
   - Click "Security" in the left sidebar
   - Under "Signing in to Google", click "2-Step Verification" (enable it if not already)
   - Scroll down and click "App passwords"
   - Select "Mail" and "Windows Computer"
   - Click "Generate"
   - **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)

2. **Create a `.env` file:**
   - In your project folder, create a new file named `.env` (exactly, with the dot)
   - Copy the contents from `env-example.txt`
   - Fill in your details:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM=WoofCrafts <your-email@gmail.com>
PORT=8000
```

### Option B: Using Outlook/Hotmail

In your `.env` file:

```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
EMAIL_FROM=WoofCrafts <your-email@outlook.com>
PORT=8000
```

### Option C: Using SendGrid (For Production)

1. Sign up at https://sendgrid.com/
2. Create an API key
3. In your `.env` file:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
EMAIL_FROM=WoofCrafts <your-email@yourdomain.com>
PORT=8000
```

---

## 🚀 Step 3: Start Your Server

```bash
node server.js
```

You should see:
```
✅ Email server is ready to send messages
🐾 WoofCrafts POS Server running at http://localhost:8000/
```

If you see `❌ Email configuration error`, check your `.env` file.

---

## 🧪 Step 4: Test Email Sending

1. Open your browser to: http://localhost:8000/test-send-email.html
2. Fill in the form with a test email address
3. Click "Send Test Email"
4. Check your inbox (and spam folder)!

---

## 📧 How to Send Emails from Your POS System

### API Endpoint: `POST /api/send-order-email`

Send a POST request with JSON data:

```javascript
const orderData = {
    customerEmail: "customer@example.com",
    customerName: "John Doe",
    orderId: "12345",
    orderDate: "Dec 5, 2025",
    items: [
        {
            name: "Premium NFC Dog Tag",
            quantity: 2,
            price: 24.99
        }
    ],
    subtotal: 49.98,
    discount: 5.00,
    total: 44.98,
    customerNote: "Please add gift wrapping",  // Optional
    contactNumber: "(555) 123-4567"            // Optional
};

fetch('/api/send-order-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
})
.then(response => response.json())
.then(result => {
    if (result.success) {
        console.log('✅ Email sent!', result.messageId);
    } else {
        console.error('❌ Error:', result.error);
    }
});
```

---

## 🎨 Email Template Features

Your emails include:
- 🐕 Beautiful dog-themed design with paw prints
- 📱 Mobile-responsive layout
- 🎨 Gradient backgrounds and modern styling
- 🦴 Itemized order details with different colors
- 💰 Subtotal, discount, and total calculation
- 📝 Optional customer notes
- 📞 Optional contact number
- 💬 Support section with reply-to capability

---

## ⚠️ Troubleshooting

### "Email configuration error"
- Make sure `.env` file exists in your project root
- Check that all credentials are correct
- Restart the server after creating/editing `.env`

### "Invalid login" or "Authentication failed"
- **Gmail:** Use an App Password, not your regular password
- **Outlook:** Make sure 2FA is not blocking the login
- Check that EMAIL_USER and EMAIL_PASS are correct

### Email goes to spam
- This is normal for test emails
- In production, use a proper domain and SPF/DKIM records
- Consider using SendGrid or similar service

### "ENOTFOUND smtp.gmail.com"
- Check your internet connection
- Try using EMAIL_PORT=465 instead of 587
- Firewall might be blocking outgoing SMTP

---

## 🔒 Security Notes

✅ **DO:**
- Keep your `.env` file secret (it's already in `.gitignore`)
- Use App Passwords for Gmail
- Limit email sending rate to avoid spam flags

❌ **DON'T:**
- Commit `.env` to Git
- Share your email credentials
- Hardcode passwords in your code

---

## 📚 Files Created

- `package.json` - Project dependencies
- `email-config.js` - Nodemailer configuration
- `email-template.js` - HTML email generator
- `server.js` - Updated with email endpoint
- `test-send-email.html` - Email testing interface
- `env-example.txt` - Template for .env file

---

## 🐾 Need Help?

Common daily limits:
- Gmail: ~500 emails/day
- Outlook: ~300 emails/day
- SendGrid Free: 100 emails/day
- Mailgun Free: 5,000 emails/month

For a small business POS system, Gmail is usually enough!

---

Happy emailing! 🐕✉️
