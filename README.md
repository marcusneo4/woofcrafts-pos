# WoofCrafts POS System

A simple, intuitive Point of Sale (POS) system for WoofCrafts pet booth. This web application allows you to quickly select products by clicking images, manage shopping cart, apply discounts, and automatically send order confirmation emails to customers.

**🌐 Now optimized for GitHub Pages deployment!** - See [GITHUB_PAGES_DEPLOY.md](GITHUB_PAGES_DEPLOY.md) for hosting instructions.

## Features

- **Visual Product Selection**: Click on product images to add items to cart
- **Shopping Cart Management**: Adjust quantities, remove items, view totals
- **5% Discount**: Apply discount to total bill with one click
- **Email Order Confirmation**: Automatically send detailed order emails to customers
- **Product Management**: Add, edit, and delete products with images
- **Local Storage**: All data persists locally (no server required)
- **Touch-Friendly**: Large buttons optimized for booth environment

## Setup Instructions

### 1. Initial Setup

1. Open the project folder in your code editor
2. The project uses vanilla HTML/CSS/JavaScript, so no build tools are required

### 2. Running Locally

You need to run this through a local web server (not just opening the HTML file directly) because of browser security restrictions with localStorage and file access.

**Option A: Using the included Node.js server (Recommended for Windows)**
```bash
# Start the server
.\start-server.bat

# Or using PowerShell
.\start-server.ps1

# Or directly with Node.js
node server.js
```
The server will automatically open your default browser to `http://localhost:8000`

**Option B: Using Python (if installed)**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open: `http://localhost:8000`

**Option C: Using VS Code Live Server**
1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

**Default Login Password**: `hyper` (can be changed in `index.html`)

### 3. Email Setup (Optional but Recommended)

To enable automatic email sending:

1. **Sign up for EmailJS** (free account at https://www.emailjs.com)
   - Free tier includes 200 emails/month

2. **Create an Email Service**
   - Go to Email Services in EmailJS dashboard
   - Connect your email service (Gmail recommended for easy setup)
   - Note your Service ID

3. **Create an Email Template**
   - Go to Email Templates
   - Create a new template
   - Use this template structure:
   
   ```
   To: {{to_email}}
   Subject: Your WoofCrafts Order Confirmation
   
   Dear {{customer_name}},
   
   Thank you for your order! Here are your order details:
   
   {{order_items}}
   
   Subtotal: {{subtotal}}
   Discount: {{discount}}
   Total: {{total}}
   
   Best regards,
   The {{company_name}} Team
   ```

4. **Update Email Configuration**
   - Open `js/email.js`
   - Replace the placeholder values:
     ```javascript
     const EMAILJS_CONFIG = {
         publicKey: 'YOUR_PUBLIC_KEY',      // From Account > General
         serviceId: 'YOUR_SERVICE_ID',      // From Email Services
         templateId: 'YOUR_TEMPLATE_ID'     // From Email Templates
     };
     ```

**Note**: If you don't set up EmailJS, the system will still work but will show email content in a popup window for manual sending.

## Usage

### Managing Products

1. Navigate to "Manage Products" from the main POS screen
2. Fill in the product form:
   - Product Name
   - Price
   - Upload Product Image
3. Click "Add Product"
4. To edit: Click "Edit" on any product, modify, and click "Update Product"
5. To delete: Click "Delete" on any product

### Taking Orders

1. From the main POS screen, click on product images to add items to cart
2. Adjust quantities using +/- buttons
3. Remove items if needed
4. Click "Apply 5% Discount" if customer is eligible
5. Enter customer email (name optional)
6. Click "Send Order Email" to complete the order
7. Click "Clear Cart" to start a new order

## File Structure

```
POS system/
├── index.html              # Login page (entry point)
├── pos.html                # Main POS interface
├── products.html           # Product management page
├── css/
│   └── style.css          # Main stylesheet
├── js/
│   ├── app.js             # Main POS functionality
│   ├── products.js        # Product management logic
│   ├── email.js           # Email sending functionality
│   └── sheets.js          # Google Sheets integration
├── images/
│   └── products/          # Product images folder
├── data/
│   └── products.json      # Product data storage (backup)
├── .nojekyll              # GitHub Pages configuration
├── GITHUB_PAGES_DEPLOY.md # GitHub Pages deployment guide
└── README.md              # This file
```

## Data Storage

- Products and cart data are stored in browser's localStorage
- Data persists even after closing the browser
- To clear all data: Open browser console and run:
  ```javascript
  localStorage.removeItem('woofcrafts_products');
  localStorage.removeItem('woofcrafts_cart');
  ```

## Web Deployment

This is a static website that can be easily deployed to:

### GitHub Pages (Recommended) ⭐
- **FREE hosting** for public repositories
- Automatic HTTPS and CDN
- Easy updates via Git push
- **See [GITHUB_PAGES_DEPLOY.md](GITHUB_PAGES_DEPLOY.md) for detailed deployment instructions**

### Other Options
- Netlify
- Vercel (see [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md))
- Any static web hosting service

Make sure to configure EmailJS before deploying to any platform.

## Browser Support

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## Troubleshooting

**Images not displaying?**
- Make sure you're running through a web server, not opening files directly
- Check browser console for errors

**Email not sending?**
- Verify EmailJS configuration in `js/email.js`
- Check EmailJS dashboard for service status
- Verify email template variables match the code

**Cart not saving?**
- Ensure you're running through a web server
- Check browser settings allow localStorage
- Try a different browser

## Support

For issues or questions, check the browser console (F12) for error messages.

---

**WoofCrafts POS System** - Making pet booth orders simple! 🐾

