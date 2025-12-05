// WoofCrafts Dog-Themed Email Template Generator
// Generates beautiful HTML emails for order confirmations

function generateOrderEmail(orderData) {
    const {
        customerName = 'Valued Customer',
        orderId = '000000',
        orderDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        }),
        items = [],
        subtotal = 0,
        discount = 0,
        total = 0,
        customerNote = '',
        contactNumber = ''
    } = orderData;

    // Generate items HTML
    const itemsHTML = items.map((item, index) => {
        const colors = [
            { bg: '#FFF9F5', border: '#E8D5C4', price: '#D4A574' },
            { bg: '#FFFAF0', border: '#F5DEB3', price: '#CD853F' },
            { bg: '#FAF7F3', border: '#E6D4C8', price: '#C9A961' }
        ];
        const color = colors[index % colors.length];

        return `
                                <tr>
                                    <td style="padding: 0 0 14px 0;">
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 2px solid ${color.border}; border-radius: 16px; overflow: hidden; background: ${color.bg}; box-shadow: 0 2px 8px rgba(180, 148, 95, 0.15);">
                                            <tr>
                                                <td style="padding: 18px 20px 12px 20px;">
                                                    <div style="font-size: 16px; color: #5C4A37; font-weight: 800;">
                                                        🐾 ${item.name}
                                                    </div>
                                                    <div style="margin-top: 8px; font-size: 14px; color: #8B7355; font-weight: 600;">
                                                        Quantity: ${item.quantity} × $${item.price.toFixed(2)} each
                                                    </div>
                                                </td>
                                                <td align="right" valign="top" style="padding: 18px 20px 12px 20px; white-space: nowrap;">
                                                    <div style="font-size: 18px; color: ${color.price}; font-weight: 900;">$${(item.quantity * item.price).toFixed(2)}</div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td colspan="2" style="padding: 0 20px 16px 20px;">
                                                    <div style="height: 6px; width: 100%; background: linear-gradient(90deg, ${color.price}, #F5D0A5); border-radius: 999px; opacity: 0.5;"></div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>`;
    }).join('');

    // Optional discount section
    const discountHTML = discount > 0 ? `
                                <tr>
                                    <td style="padding: 10px 0; font-size: 16px; color: #2F855A; font-weight: 700;">
                                        🐾 Discount (${((discount / subtotal) * 100).toFixed(0)}%)
                                    </td>
                                    <td align="right" style="padding: 10px 0; font-size: 16px; color: #2F855A; font-weight: 700;">
                                        -$${discount.toFixed(2)}
                                    </td>
                                </tr>` : '';

    // Optional customer note section
    const noteHTML = customerNote ? `
                    <tr>
                        <td style="padding: 14px 30px 0 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #FFF4E6 0%, #FFE8CC 100%); border: 2px solid #F0C78D; border-radius: 16px; padding: 18px 20px;">
                                <tr>
                                    <td style="font-size: 13px; color: #8B4513; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; padding-bottom: 8px;">
                                        🐾 Special Note for Your Pup
                                    </td>
                                </tr>
                                <tr>
                                    <td style="font-size: 15px; color: #5C4A37; line-height: 1.7; font-style: italic;">
                                        "${customerNote}"
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>` : '';

    // Optional contact number section
    const contactHTML = contactNumber ? `
                    <tr>
                        <td style="padding: 14px 30px 0 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #F0E6D2 0%, #E8D5C4 100%); border: 2px solid #D4A574; border-radius: 16px; padding: 16px 20px;">
                                <tr>
                                    <td style="font-size: 14px; color: #5C4A37; font-weight: 800;">
                                        🐾 Contact Number
                                    </td>
                                    <td align="right" style="font-size: 15px; color: #5C4A37; font-weight: 700;">
                                        ${contactNumber}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WoofCrafts Order Confirmation</title>
</head>
<body style="margin:0; padding:0; width:100%; background: linear-gradient(180deg, #FAF7F3 0%, #F5EFE7 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 30px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow: 0 20px 60px rgba(92, 74, 55, 0.2), 0 8px 20px rgba(180, 148, 95, 0.15);">
                    
                    <!-- HEADER -->
                    <tr>
                        <td style="padding: 0; background: linear-gradient(135deg, #D4A574 0%, #C9A961 50%, #B8956A 100%); position: relative;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="padding: 36px 30px; text-align: center; position: relative;">
                                        <div style="font-size: 16px; opacity: 0.3; color: #FFFFFF; margin-bottom: 8px; letter-spacing: 12px;">
                                            🐾 🐾 🐾 🐾 🐾
                                        </div>
                                        <div style="font-size: 56px; line-height: 1; margin-bottom: 12px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));">
                                            🐕
                                        </div>
                                        <div style="font-size: 32px; color: #FFFFFF; font-weight: 900; letter-spacing: 1px; text-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                                            WoofCrafts
                                        </div>
                                        <div style="font-size: 16px; color: #FFF9F5; margin-top: 8px; font-weight: 600; letter-spacing: 0.5px;">
                                            🎉 Order Confirmed! 🎉
                                        </div>
                                        <div style="font-size: 16px; opacity: 0.3; color: #FFFFFF; margin-top: 12px; letter-spacing: 12px;">
                                            🐾 🐾 🐾 🐾 🐾
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- GREETING -->
                    <tr>
                        <td style="padding: 32px 30px 16px 30px; background: linear-gradient(180deg, #FFFAF5 0%, #FFFFFF 100%);">
                            <p style="margin: 0 0 16px 0; font-size: 18px; color: #5C4A37; font-weight: 700;">
                                Woof woof, <strong style="color: #D4A574;">${customerName}</strong>! 🐶
                            </p>
                            <p style="margin: 0; font-size: 15px; color: #6B5D52; line-height: 1.8;">
                                Your furry friend is in for a treat! We've received your order and we're wagging our tails with excitement to get your pawsome items ready. Here's everything you ordered:
                            </p>
                        </td>
                    </tr>

                    <!-- ORDER INFO CARDS -->
                    <tr>
                        <td style="padding: 8px 30px 24px 30px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="50%" style="padding-right: 8px;">
                                        <table role="presentation" width="100%" style="background: linear-gradient(135deg, #FFF4E6 0%, #FFE8CC 100%); border: 2px solid #E8D5C4; border-radius:16px; padding:18px 20px;">
                                            <tr>
                                                <td style="font-size:12px; color:#8B7355; letter-spacing:0.5px; text-transform:uppercase; font-weight: 700;">
                                                    🎫 Order ID
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:20px; color:#D4A574; font-weight:900; padding-top:8px;">
                                                    #${orderId}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td width="50%" style="padding-left: 8px;">
                                        <table role="presentation" width="100%" style="background: linear-gradient(135deg, #F0E6D2 0%, #E8D5C4 100%); border: 2px solid #D4C4B0; border-radius:16px; padding:18px 20px;">
                                            <tr>
                                                <td style="font-size:12px; color:#8B7355; letter-spacing:0.5px; text-transform:uppercase; font-weight: 700;">
                                                    📅 Date
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size:16px; color:#5C4A37; font-weight:800; padding-top:8px;">
                                                    ${orderDate}
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
                        <td style="padding: 0 30px 8px 30px;">
                            <div style="font-size:18px; color:#5C4A37; font-weight:900; padding-bottom:14px; border-bottom: 3px solid #E8D5C4;">
                                <span style="font-size: 24px; margin-right: 10px;">🦴</span>
                                Your Pawsome Items
                            </div>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
                                ${itemsHTML}
                            </table>
                        </td>
                    </tr>

                    <!-- TOTALS -->
                    <tr>
                        <td style="padding: 12px 30px 10px 30px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #5C4A37 0%, #4A3828 100%); border-radius:18px; padding: 22px 24px; box-shadow: 0 8px 20px rgba(92, 74, 55, 0.3);">
                                <tr>
                                    <td style="font-size:16px; color:#F5EFE7; font-weight: 700;">Subtotal</td>
                                    <td align="right" style="font-size:16px; color:#F5EFE7; font-weight: 700;">$${subtotal.toFixed(2)}</td>
                                </tr>
                                ${discountHTML}
                                <tr>
                                    <td colspan="2" style="padding: 12px 0;">
                                        <div style="height: 2px; background: linear-gradient(90deg, transparent, #D4A574, transparent); opacity: 0.5;"></div>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 4px; font-size:20px; color:#FFF4E6; font-weight:900;">
                                        🦴 Grand Total
                                    </td>
                                    <td align="right" style="padding-top: 4px; font-size:26px; color:#F0C78D; font-weight:900;">
                                        $${total.toFixed(2)}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${noteHTML}
                    ${contactHTML}

                    <!-- SUPPORT SECTION -->
                    <tr>
                        <td style="padding: 24px 30px 26px 30px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%); border: 2px solid #A5D6A7; border-radius:16px; padding:22px;">
                                <tr>
                                    <td style="text-align:center;">
                                        <div style="font-size: 28px; margin-bottom: 8px;">💬</div>
                                        <div style="font-size:15px; color:#2E7D32; font-weight: 700; line-height:1.7;">
                                            Questions? Need help? Woof for us!
                                        </div>
                                        <div style="font-size:14px; color:#388E3C; margin-top: 6px; line-height: 1.6;">
                                            Just reply to this email and our pack will fetch answers for you right away! 🐕
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="padding: 0 30px 32px 30px; text-align: center; background: linear-gradient(180deg, #FFFFFF 0%, #FAF7F3 100%);">
                            <div style="margin-bottom: 10px; opacity: 0.4;">
                                <span style="font-size: 20px; margin: 0 6px;">🐾</span>
                                <span style="font-size: 16px; margin: 0 4px;">🐾</span>
                                <span style="font-size: 20px; margin: 0 6px;">🐾</span>
                            </div>
                            <div style="font-size:15px; color:#6B5D52; margin-bottom:8px; font-weight: 600;">
                                Tail wags and thanks for supporting our small business!
                            </div>
                            <div style="font-size:20px; color:#D4A574; font-weight:900; margin-bottom: 6px;">
                                The WoofCrafts Team 🐕
                            </div>
                            <div style="font-size:14px; color:#8B7355; font-style: italic;">
                                Crafting pawsome accessories for good dogs everywhere
                            </div>
                            <div style="margin-top: 10px; opacity: 0.4;">
                                <span style="font-size: 20px; margin: 0 6px;">🐾</span>
                                <span style="font-size: 16px; margin: 0 4px;">🐾</span>
                                <span style="font-size: 20px; margin: 0 6px;">🐾</span>
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>`;
}

// Generate plain text version of the email
function generatePlainTextEmail(orderData) {
    const {
        customerName = 'Valued Customer',
        orderId = '000000',
        orderDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        items = [],
        subtotal = 0,
        discount = 0,
        total = 0,
        customerNote = '',
        contactNumber = ''
    } = orderData;

    const itemsList = items.map(item => 
        `${item.name}\nQty: ${item.quantity} x $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}`
    ).join('\n\n');

    const discountText = discount > 0 ? `Discount: -$${discount.toFixed(2)}\n` : '';
    const noteText = customerNote ? `\n\nSpecial Note:\n"${customerNote}"\n` : '';
    const contactText = contactNumber ? `\nContact Number: ${contactNumber}\n` : '';

    return `
🐾 WOOFCRAFTS ORDER CONFIRMATION 🐾

Dear ${customerName},

Thank you for shopping with WoofCrafts! We've received your order and are getting it ready for your pup.

ORDER INFORMATION
-----------------
Order ID: #${orderId}
Date: ${orderDate}${contactText}

ORDER SUMMARY
-------------
${itemsList}

PAYMENT SUMMARY
---------------
Subtotal: $${subtotal.toFixed(2)}
${discountText}TOTAL: $${total.toFixed(2)}
${noteText}

If you have any questions or concerns about your order, please reply to this email and our team will be happy to assist you.

We appreciate your business and look forward to serving you again!

Best regards,
The WoofCrafts Team 🐶
Crafting pawsome accessories for good dogs everywhere
`;
}

module.exports = { generateOrderEmail, generatePlainTextEmail };
