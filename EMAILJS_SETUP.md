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
4. **Subject Line**: `🐾 Your WoofCrafts Order #{{order_id}} - Order Confirmed!`
5. **Switch to HTML mode** (click the "HTML" button in the editor)
6. **Copy and paste this beautifully formatted HTML template**:

```html
<div style="margin:0; padding:0; width:100%; background: #FAF7F3; font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 650px; background:#FFFFFF; border-radius:25px; overflow:hidden; box-shadow: 0 20px 60px rgba(180, 148, 95, 0.25);">
                    
                    <!-- HEADER WITH GRADIENT -->
                    <tr>
                        <td style="padding: 0; background: linear-gradient(135deg, #D4A574 0%, #C9A961 50%, #E8D5B7 100%); position: relative;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="padding: 40px 35px; text-align: center; position: relative;">
                                        <!-- Decorative Paw Prints -->
                                        <div style="font-size: 14px; opacity: 0.25; color: #FFFFFF; margin-bottom: 12px; letter-spacing: 14px; font-weight: 600;">
                                            🐾 🐾 🐾 🐾 🐾
                                        </div>
                                        
                                        <!-- Dog Icon -->
                                        <div style="font-size: 64px; line-height: 1; margin-bottom: 16px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));">🐕</div>
                                        
                                        <!-- Brand Name -->
                                        <div style="font-family: 'Fredoka One', 'Arial Black', sans-serif; font-size: 36px; color: #FFFFFF; font-weight: 400; letter-spacing: 1.5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.15); margin-bottom: 12px;">
                                            WoofCrafts
                                        </div>
                                        
                                        <!-- Order Confirmed Badge -->
                                        <div style="display: inline-block; background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(10px); padding: 10px 24px; border-radius: 50px; margin-bottom: 12px;">
                                            <span style="font-size: 16px; color: #FFFFFF; font-weight: 700; letter-spacing: 0.5px;">🎉 Order Confirmed! 🎉</span>
                                        </div>
                                        
                                        <!-- Bottom Paw Prints -->
                                        <div style="font-size: 14px; opacity: 0.25; color: #FFFFFF; margin-top: 12px; letter-spacing: 14px; font-weight: 600;">
                                            🐾 🐾 🐾 🐾 🐾
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- GREETING SECTION -->
                    <tr>
                        <td style="padding: 40px 35px 24px 35px; background: #FFFFFF;">
                            <p style="margin: 0 0 20px 0; font-size: 20px; color: #5C4A37; font-weight: 800; line-height: 1.4;">
                                Woof woof, <span style="color: #D4A574; font-weight: 900;">{{customer_name}}</span>! 🐶
                            </p>
                            <p style="margin: 0; font-size: 16px; color: #8B7355; line-height: 1.8; font-weight: 400;">
                                Your furry friend is in for a treat! We've received your order and we're wagging our tails with excitement to get your pawsome items ready. Here's everything you ordered:
                            </p>
                        </td>
                    </tr>

                    <!-- ORDER INFO CARDS -->
                    <tr>
                        <td style="padding: 0 35px 30px 35px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <!-- Order ID Card -->
                                    <td width="50%" style="padding-right: 10px;">
                                        <table role="presentation" width="100%" style="background: linear-gradient(135deg, #F4E6D7 0%, #E8D5B7 100%); border: 2px solid #E8D5B7; border-radius:20px; padding:22px 20px; box-shadow: 0 4px 15px rgba(180, 148, 95, 0.15);">
                                            <tr>
                                                <td style="font-size:11px; color:#8B7355; letter-spacing:1px; text-transform:uppercase; font-weight: 700; padding-bottom: 8px;">
                                                    🎫 Order ID
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:22px; color:#D4A574; font-weight:900; padding-top:4px; letter-spacing: 0.5px;">
                                                    #{{order_id}}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    
                                    <!-- Date Card -->
                                    <td width="50%" style="padding-left: 10px;">
                                        <table role="presentation" width="100%" style="background: linear-gradient(135deg, #E8D5B7 0%, #F4E6D7 100%); border: 2px solid #E8D5B7; border-radius:20px; padding:22px 20px; box-shadow: 0 4px 15px rgba(180, 148, 95, 0.15);">
                                            <tr>
                                                <td style="font-size:11px; color:#8B7355; letter-spacing:1px; text-transform:uppercase; font-weight: 700; padding-bottom: 8px;">
                                                    📅 Order Date
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:17px; color:#5C4A37; font-weight:800; padding-top:4px; line-height: 1.4;">
                                                    {{order_date}}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- ITEMS SECTION -->
                    <tr>
                        <td style="padding: 0 35px 24px 35px;">
                            <!-- Section Header -->
                            <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 3px solid #E8D5B7; position: relative;">
                                <div style="position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); background: #FFFFFF; padding: 0 15px;">
                                    <span style="font-size: 20px;">🐾</span>
                                </div>
                                <div style="font-family: 'Fredoka One', 'Arial Black', sans-serif; font-size: 22px; color: #5C4A37; font-weight: 400; text-align: center; display: flex; align-items: center; justify-content: center; gap: 12px;">
                                    <span style="font-size: 28px;">🦴</span>
                                    <span>Your Pawsome Items</span>
                                </div>
                            </div>
                            
                            <!-- Items Container -->
                            <div style="background: #FAF7F3; border: 2px solid #E8D5B7; border-radius: 20px; padding: 24px; box-shadow: 0 2px 8px rgba(180, 148, 95, 0.1);">
                                <div style="font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; font-size: 15px; color: #5C4A37; line-height: 1.9; white-space: pre-wrap; word-wrap: break-word; font-weight: 500;">
{{{items_list}}}
                                </div>
                            </div>
                        </td>
                    </tr>

                    <!-- TOTALS SECTION -->
                    <tr>
                        <td style="padding: 0 35px 24px 35px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #5C4A37 0%, #4A3828 100%); border-radius:20px; padding: 28px 26px; box-shadow: 0 8px 25px rgba(92, 74, 55, 0.35);">
                                <!-- Subtotal -->
                                <tr>
                                    <td style="font-size:17px; color:#F4E6D7; font-weight: 700; padding-bottom: 12px; letter-spacing: 0.3px;">Subtotal</td>
                                    <td align="right" style="font-size:17px; color:#F4E6D7; font-weight: 700; padding-bottom: 12px;">{{subtotal}}</td>
                                </tr>
                                
                                <!-- Discount -->
                                <tr>
                                    <td style="padding: 8px 0; font-size: 17px; color: #A0B58F; font-weight: 700; letter-spacing: 0.3px;">
                                        🐾 Discount
                                    </td>
                                    <td align="right" style="padding: 8px 0; font-size: 17px; color: #A0B58F; font-weight: 700;">
                                        {{discount}}
                                    </td>
                                </tr>
                                
                                <!-- Divider -->
                                <tr>
                                    <td colspan="2" style="padding: 16px 0 8px 0;">
                                        <div style="height: 2px; background: linear-gradient(90deg, transparent, rgba(212, 165, 116, 0.6), transparent);"></div>
                                    </td>
                                </tr>
                                
                                <!-- Grand Total -->
                                <tr>
                                    <td style="padding-top: 8px; font-size:22px; color:#F4E6D7; font-weight:900; letter-spacing: 0.5px;">
                                        🦴 Grand Total
                                    </td>
                                    <td align="right" style="padding-top: 8px; font-size:28px; color:#D4A574; font-weight:900; letter-spacing: 0.5px;">
                                        {{total}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CUSTOMER NOTE (if provided) -->
                    <tr>
                        <td style="padding: 0 35px 20px 35px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #F4E6D7 0%, #E8D5B7 100%); border: 2px solid #E8D5B7; border-radius: 20px; padding: 22px 24px; box-shadow: 0 4px 15px rgba(180, 148, 95, 0.15);">
                                <tr>
                                    <td style="font-size: 12px; color: #8B7355; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding-bottom: 10px;">
                                        🐾 Special Note for Your Pup
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 16px; color: #5C4A37; line-height: 1.8; font-weight: 500; font-style: italic;">
                                        {{customer_note}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CONTACT INFO (if provided) -->
                    <tr>
                        <td style="padding: 0 35px 24px 35px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #E8D5B7 0%, #F4E6D7 100%); border: 2px solid #D4A574; border-radius: 20px; padding: 20px 24px; box-shadow: 0 4px 15px rgba(180, 148, 95, 0.15);">
                                <tr>
                                    <td style="font-size: 15px; color: #5C4A37; font-weight: 800; letter-spacing: 0.3px;">
                                        📞 Contact Number
                                    </td>
                                    <td align="right" style="font-size: 16px; color: #5C4A37; font-weight: 700;">
                                        {{contact_number}}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- SUPPORT SECTION -->
                    <tr>
                        <td style="padding: 0 35px 30px 35px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #E8F5E9 0%, #F1F8E9 100%); border: 3px solid #A0B58F; border-radius:20px; padding:26px 24px; box-shadow: 0 4px 15px rgba(160, 181, 143, 0.2);">
                                <tr>
                                    <td style="text-align:center;">
                                        <div style="font-size: 32px; margin-bottom: 12px;">💬</div>
                                        <div style="font-size:17px; color:#2E7D32; font-weight: 800; margin-bottom: 8px; letter-spacing: 0.3px;">
                                            Questions? Woof for us!
                                        </div>
                                        <div style="font-size:15px; color:#388E3C; line-height: 1.6; font-weight: 500;">
                                            Just reply to this email and our pack will fetch answers for you right away! 🐕
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding: 0 35px 40px 35px; text-align: center; background: linear-gradient(180deg, #FFFFFF 0%, #FAF7F3 100%);">
                            <!-- Decorative Paw Print -->
                            <div style="margin-bottom: 16px; opacity: 0.3;">
                                <span style="font-size: 24px; margin: 0 8px;">🐾</span>
                                <span style="font-size: 18px; margin: 0 6px;">🐾</span>
                                <span style="font-size: 24px; margin: 0 8px;">🐾</span>
                            </div>
                            
                            <!-- Thank You Message -->
                            <div style="font-size:16px; color:#8B7355; margin-bottom:12px; font-weight: 700; line-height: 1.6;">
                                Tail wags and thanks for supporting our small business!
                            </div>
                            
                            <!-- Team Signature -->
                            <div style="font-family: 'Fredoka One', 'Arial Black', sans-serif; font-size:24px; color:#D4A574; font-weight:400; margin-bottom: 10px; letter-spacing: 1px;">
                                The WoofCrafts Team 🐕
                            </div>
                            
                            <!-- Tagline -->
                            <div style="font-size:15px; color:#8B7355; font-style: italic; font-weight: 500; line-height: 1.6;">
                                Crafting pawsome accessories for good dogs everywhere
                            </div>
                            
                            <!-- Bottom Decorative Paw Print -->
                            <div style="margin-top: 16px; opacity: 0.3;">
                                <span style="font-size: 24px; margin: 0 8px;">🐾</span>
                                <span style="font-size: 18px; margin: 0 6px;">🐾</span>
                                <span style="font-size: 24px; margin: 0 8px;">🐾</span>
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</div>
```

7. **Save** the template
8. **Copy your Template ID** (looks like `template_xxxxxxx`)

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

## 🎨 Email Template Features

The template above includes:

✨ **Beautiful Structure & Readability**
- Professional header with gradient matching your POS theme
- Clean, spacious card-based layout with proper padding
- Clear visual hierarchy with section headers
- Improved typography using Nunito font family (matching your site)
- Better contrast and readability throughout
- Generous spacing for easy scanning

🐾 **Perfect Theme Match**
- Exact color scheme from your POS system:
  - Primary: `#D4A574` (Warm Beige)
  - Secondary: `#C9A961` (Golden Beige)
  - Accent: `#E8D5B7` (Light Beige)
  - Text: `#5C4A37` (Brown) and `#8B7355` (Light Brown)
  - Background: `#FAF7F3` (Soft Beige)
- Fredoka One font for headers (matching your site)
- Consistent border radius (20px, 25px) matching your design
- Same gradient patterns and shadow styles

📱 **Mobile-Friendly & Email-Safe**
- Uses table-based layout (works in all email clients)
- Properly formatted for Gmail, Outlook, Apple Mail
- Inline CSS for maximum compatibility
- Responsive design that looks great on all devices
- Optimized font sizes for readability

### Customization Tips:

1. **Change Colors**: Replace the color values with your brand colors:
   - `#D4A574` → Your primary color
   - `#5C4A37` → Your dark text color
   - `#E8D5B7` → Your accent/border color

2. **Update Text**: Modify the greeting, footer, and support messages to match your brand voice

3. **Add Your Logo**: Replace the 🐕 emoji in the header with:
   ```html
   <img src="your-logo-url" style="width:80px; height:auto; display:block; margin:0 auto 12px;">
   ```

4. **Remove Optional Sections**: Delete the customer note or contact sections if not needed (remove entire `<tr>` blocks)

5. **Adjust Spacing**: Modify padding values (currently 35px, 24px, etc.) to adjust spacing

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
- `{{{items_list}}}` (triple braces to allow HTML rendering)
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
