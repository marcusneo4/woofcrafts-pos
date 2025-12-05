# EmailJS Setup for GitHub Pages

Your POS system is now configured to use **EmailJS** for sending emails on GitHub Pages. EmailJS is a free client-side email service that works perfectly with static sites.

## 🎯 Quick Setup (5 minutes)

### Step 1: Create EmailJS Account

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click **"Sign Up Free"**
3. Create your account (free tier includes 200 emails/month)

### Step 2: Add Email Service

1. After logging in, go to **"Email Services"**
2. Click **"Add New Service"**
3. Choose **Gmail** (easiest) or your preferred email provider
4. Connect your email account
5. **Copy your Service ID** (looks like `service_xxxxxxx`)

### Step 3: Create Email Template

1. Go to **"Email Templates"**
2. Click **"Create New Template"**
3. **Template Name**: `WoofCrafts Order Confirmation`
4. **Use this template content**:

```
Subject: 🐾 Your WoofCrafts Order #{{order_id}}

Hi {{customer_name}},

Thank you for your order from WoofCrafts! 

ORDER DETAILS
-------------
Order ID: #{{order_id}}
Date: {{order_date}}

ITEMS
-----
{{items_list}}

SUMMARY
-------
Subtotal: {{subtotal}}
Discount: {{discount}}
Total: {{total}}

{{#customer_note}}
SPECIAL INSTRUCTIONS
-------------------
{{customer_note}}
{{/customer_note}}

{{#contact_number}}
Contact: {{contact_number}}
{{/contact_number}}

Thank you for shopping with WoofCrafts! 🐕

---
WoofCrafts Pet Products
```

5. **Save** the template
6. **Copy your Template ID** (looks like `template_xxxxxxx`)

### Step 4: Get Your Public Key

1. Go to **"Account"** (top right)
2. Find **"API Keys"** section
3. **Copy your Public Key** (looks like a long string)

### Step 5: Update Your Code

Open `js/app.js` and find this line (around line 464):

```javascript
emailjs.init('YOUR_EMAILJS_PUBLIC_KEY');
```

Replace with:
```javascript
emailjs.init('your_actual_public_key_here');
```

Then find these lines (around line 488):

```javascript
await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams);
```

Replace with:
```javascript
await emailjs.send('service_xxxxxxx', 'template_xxxxxxx', templateParams);
```

### Step 6: Save and Deploy

```bash
git add js/app.js pos.html
git commit -m "Configure EmailJS for email sending"
git push origin main
```

Wait 1-2 minutes for GitHub Pages to rebuild, then test!

## 📧 Testing

1. Go to your deployed site: `https://marcusneo4.github.io/your-repo-name/`
2. Add items to cart
3. Enter customer email (use your own email for testing)
4. Click "Send Email"
5. Check your inbox!

## 🎨 Customizing the Email Template

You can make your email template prettier by:

1. Going back to EmailJS Email Templates
2. Clicking on your template
3. Using the **"Template Editor"** to add HTML styling
4. Adding your logo, colors, etc.

### Example HTML Template (Optional):

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { background: #D4A574; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .items { background: #f9f9f9; padding: 15px; margin: 15px 0; }
        .total { font-size: 20px; font-weight: bold; color: #D4A574; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐾 WoofCrafts Order Confirmation</h1>
    </div>
    <div class="content">
        <p>Hi {{customer_name}},</p>
        <p>Thank you for your order!</p>
        
        <h3>Order #{{order_id}}</h3>
        <p>Date: {{order_date}}</p>
        
        <div class="items">
            <h3>Your Items:</h3>
            <pre>{{items_list}}</pre>
        </div>
        
        <p>Subtotal: {{subtotal}}</p>
        <p>Discount: {{discount}}</p>
        <p class="total">Total: {{total}}</p>
        
        {{#customer_note}}
        <p><strong>Special Instructions:</strong><br>{{customer_note}}</p>
        {{/customer_note}}
        
        <p>Thank you for shopping with WoofCrafts! 🐶</p>
    </div>
</body>
</html>
```

## 🔧 Troubleshooting

### Email not sending?

1. **Check browser console** (F12) for error messages
2. **Verify EmailJS config** in `js/app.js`:
   - Public Key is correct
   - Service ID is correct
   - Template ID is correct
3. **Check EmailJS dashboard** for any service issues
4. **Test on EmailJS website** first using their "Test" button

### Rate limits?

Free tier: 200 emails/month
- Upgrade to paid plan for more: https://www.emailjs.com/pricing/

### Wrong template variables?

Make sure your template uses these exact variable names:
- `{{customer_name}}`
- `{{order_id}}`
- `{{order_date}}`
- `{{items_list}}`
- `{{subtotal}}`
- `{{discount}}`
- `{{total}}`
- `{{customer_note}}` (optional)
- `{{contact_number}}` (optional)

## 💡 Pro Tips

1. **Test locally first** - EmailJS works locally too!
2. **Use your email for testing** - Don't spam customers during setup
3. **Customize the email template** - Add your branding, logo, colors
4. **Monitor usage** - Check EmailJS dashboard to see email stats
5. **Set up notifications** - Get alerts when emails fail

## 🎉 Done!

Your POS system now sends professional emails directly from GitHub Pages!

No backend server needed! 🚀

---

**Need help?** Check [EmailJS Documentation](https://www.emailjs.com/docs/)
