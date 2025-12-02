// WoofCrafts POS System - Email Functionality using EmailJS

// Initialize EmailJS
// Configure EmailJS at https://www.emailjs.com
// Use marcusneo4@gmail.com as the sending email
// 
// IMPORTANT EMAILJS TEMPLATE CONFIGURATION:
// 1. In your EmailJS template, set the "To Email" field to: {{to_email}}
//    This ensures emails are sent to the customer email entered in the form, not a hardcoded address.
// 2. Set your EmailJS template format to "Plain Text" (not HTML) for clean email formatting.
//    Use {{message}} in your template body to include the full formatted email content.
// 3. Available template variables:
//    - {{to_email}} - Customer email (REQUIRED for correct recipient)
//    - {{customer_name}} - Customer name
//    - {{customer_phone}} - Customer phone
//    - {{order_id}} - Order ID
//    - {{order_items}} - Plain text items list (simple format)
//    - {{message}} - Full formatted plain text email body (RECOMMENDED - use this in template)
//    - {{subtotal}} - Order subtotal
//    - {{discount}} - Discount information
//    - {{total}} - Final total
//    - {{customer_comment}} - Customer comments/special instructions
const EMAILJS_CONFIG = {
    publicKey: 'pItLrmthOdxpZRMEw', // Replace with your EmailJS Public Key from dashboard
    serviceId: 'service_t1mlwir',  // EmailJS Service ID (Gmail service)
    templateId: 'template_iqb8umq' // Replace with your EmailJS Template ID
};

// Initialize EmailJS on page load
(function() {
    // Wait for EmailJS SDK to load
    function initEmailJS() {
        if (typeof emailjs !== 'undefined') {
            try {
                emailjs.init(EMAILJS_CONFIG.publicKey);
                console.log('EmailJS initialized successfully');
            } catch (error) {
                console.error('Error initializing EmailJS:', error);
            }
        } else {
            console.warn('EmailJS SDK not loaded yet. Retrying...');
            // Retry after a short delay
            setTimeout(initEmailJS, 100);
        }
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEmailJS);
    } else {
        initEmailJS();
    }
})();

/**
 * Send order confirmation email to customer
 * @param {Object} orderDetails - Order information
 * @param {string} orderDetails.customerName - Customer name
 * @param {string} orderDetails.customerEmail - Customer email
 * @param {Array} orderDetails.items - Array of cart items
 * @param {number} orderDetails.subtotal - Order subtotal
 * @param {number} orderDetails.discountAmount - Discount amount
 * @param {number} orderDetails.discountPercent - Discount percentage
 * @param {number} orderDetails.total - Final total
 */
async function sendOrderConfirmationEmail(orderDetails) {
    // Check if EmailJS SDK is loaded
    if (typeof emailjs === 'undefined') {
        console.error('EmailJS SDK not loaded. Please check the script tag in index.html');
        throw new Error('EmailJS SDK not loaded. Please refresh the page and try again.');
    }

    // Check if EmailJS is configured
    if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
        // Fallback: Generate email content and show it (for testing)
        const emailContent = generatePlainTextEmailContent(orderDetails);
        console.log('EmailJS not configured. Email content:', emailContent);
        
        // Show email content in a new window for manual sending
        const emailWindow = window.open('', '_blank');
        emailWindow.document.write(`
            <html>
                <head><title>Order Confirmation Email</title></head>
                <body style="font-family: 'Courier New', monospace; padding: 20px; white-space: pre-wrap;">
                    <h2>EmailJS not configured yet.</h2>
                    <p>To enable automatic email sending, configure EmailJS in js/email.js</p>
                    <hr>
                    <h3>Email Content (to send manually):</h3>
                    <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9; font-family: 'Courier New', monospace; white-space: pre-wrap;">
                        ${emailContent.replace(/\n/g, '<br>')}
                    </div>
                    <hr>
                    <h3>To:</h3>
                    <p>${orderDetails.customerEmail}</p>
                    <h3>Subject:</h3>
                    <p>WoofCrafts 🐾 Order Confirmation – ${orderDetails.orderId || 'N/A'}</p>
                </body>
            </html>
        `);
        alert('EmailJS not configured. Email content opened in new window. Please configure EmailJS in js/email.js to enable automatic sending.');
        return;
    }

    try {
        // Ensure EmailJS is initialized
        if (!emailjs || typeof emailjs.send !== 'function') {
            console.log('Re-initializing EmailJS with public key:', EMAILJS_CONFIG.publicKey);
            emailjs.init(EMAILJS_CONFIG.publicKey);
        }

        console.log('EmailJS Configuration:', {
            publicKey: EMAILJS_CONFIG.publicKey,
            serviceId: EMAILJS_CONFIG.serviceId,
            templateId: EMAILJS_CONFIG.templateId
        });

        // Generate plain text email content
        const emailText = generatePlainTextEmailContent(orderDetails);
        
        // Format items for email (plain text)
        const itemsList = orderDetails.items.map(item => 
            `${item.name} - Qty: ${item.quantity} x $${item.price.toFixed(2)} = $${item.subtotal.toFixed(2)}`
        ).join('\n');

        // Prepare email template parameters
        const templateParams = {
            to_email: orderDetails.customerEmail, // IMPORTANT: Make sure your EmailJS template uses {{to_email}} for the recipient
            from_name: 'WoofCrafts',
            from_email: 'marcusneo4@gmail.com',
            customer_name: orderDetails.customerName,
            customer_phone: orderDetails.customerPhone || 'Not provided',
            order_id: orderDetails.orderId || 'N/A',
            order_items: itemsList, // Plain text version
            message: emailText, // Plain text email body - use this in your EmailJS template
            subtotal: `$${orderDetails.subtotal.toFixed(2)}`,
            discount: orderDetails.discountAmount > 0 
                ? `${orderDetails.discountPercent}% ($${orderDetails.discountAmount.toFixed(2)})`
                : 'None',
            total: `$${orderDetails.total.toFixed(2)}`,
            company_name: 'WoofCrafts',
            customer_comment: orderDetails.customerComment || 'No comments'
        };

        console.log('Sending email with parameters:', {
            serviceId: EMAILJS_CONFIG.serviceId,
            templateId: EMAILJS_CONFIG.templateId,
            to_email: templateParams.to_email,
            customer_name: templateParams.customer_name
        });

        // Send email using EmailJS
        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams
        );

        console.log('Email sent successfully:', response);
        console.log('Response status:', response.status);
        console.log('Response text:', response.text);
        return response;
    } catch (error) {
        console.error('EmailJS error details:', {
            error: error,
            status: error?.status,
            statusText: error?.statusText,
            text: error?.text,
            message: error?.message
        });
        
        // Provide more detailed error information
        let errorMessage = 'Failed to send email: ';
        
        if (error?.status) {
            errorMessage += `Status ${error.status} - `;
        }
        
        if (error?.text) {
            errorMessage += error.text;
        } else if (error?.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Unknown error occurred';
        }
        
        // Add helpful suggestions based on error
        if (error?.status === 400) {
            errorMessage += '\n\nPossible issues:\n- Service ID might be incorrect\n- Template ID might be incorrect\n- Template parameters might not match your template';
        } else if (error?.status === 401 || error?.status === 403) {
            errorMessage += '\n\nPossible issues:\n- Public Key might be incorrect\n- Service might not be properly connected in EmailJS dashboard';
        } else if (error?.status === 404) {
            errorMessage += '\n\nPossible issues:\n- Service ID not found\n- Template ID not found\n- Check your EmailJS dashboard for correct IDs';
        }
        
        throw new Error(errorMessage);
    }
}

/**
 * Generate plain text email content for EmailJS with professional table formatting
 */
function generatePlainTextEmailContent(orderDetails) {
    // Calculate column widths for table formatting
    const maxNameLength = Math.max(...orderDetails.items.map(item => item.name.length), 20);
    const nameWidth = Math.min(maxNameLength + 2, 40);
    const qtyWidth = 8;
    const priceWidth = 12;
    const totalWidth = 12;
    
    // Helper function to pad strings for table alignment
    const padRight = (str, width) => (str + ' '.repeat(width)).substring(0, width);
    const padLeft = (str, width) => (' '.repeat(width) + str).substring(str.length);
    
    // Build table header
    let tableHeader = `┌${'─'.repeat(nameWidth)}┬${'─'.repeat(qtyWidth)}┬${'─'.repeat(priceWidth)}┬${'─'.repeat(totalWidth)}┐\n`;
    tableHeader += `│${padRight('ITEM', nameWidth)}│${padRight('QTY', qtyWidth)}│${padLeft('PRICE', priceWidth)}│${padLeft('TOTAL', totalWidth)}│\n`;
    tableHeader += `├${'─'.repeat(nameWidth)}┼${'─'.repeat(qtyWidth)}┼${'─'.repeat(priceWidth)}┼${'─'.repeat(totalWidth)}┤\n`;
    
    // Build table rows
    let tableRows = '';
    orderDetails.items.forEach(item => {
        const name = item.name.length > nameWidth - 2 ? item.name.substring(0, nameWidth - 5) + '...' : item.name;
        const qty = item.quantity.toString();
        const price = `$${item.price.toFixed(2)}`;
        const total = `$${item.subtotal.toFixed(2)}`;
        
        tableRows += `│${padRight(name, nameWidth)}│${padRight(qty, qtyWidth)}│${padLeft(price, priceWidth)}│${padLeft(total, totalWidth)}│\n`;
    });
    
    // Build table footer
    const tableFooter = `└${'─'.repeat(nameWidth)}┴${'─'.repeat(qtyWidth)}┴${'─'.repeat(priceWidth)}┴${'─'.repeat(totalWidth)}┘\n`;
    
    // Build plain text email with professional formatting
    let emailBody = `╔═══════════════════════════════════════════════════════════════╗\n`;
    emailBody += `║          🐾 WOOFCRAFTS ORDER CONFIRMATION 🐾          ║\n`;
    emailBody += `╚═══════════════════════════════════════════════════════════════╝\n`;
    emailBody += `\n`;
    emailBody += `Dear ${orderDetails.customerName},\n`;
    emailBody += `\n`;
    emailBody += `Thank you for shopping with WoofCrafts! We've received your order\n`;
    emailBody += `and are getting it ready for your pup.\n`;
    emailBody += `\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `ORDER INFORMATION\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `\n`;
    emailBody += `Order ID:     ${orderDetails.orderId || 'N/A'}\n`;
    emailBody += `Customer:     ${orderDetails.customerName}\n`;
    if (orderDetails.customerPhone) {
        emailBody += `Phone:        ${orderDetails.customerPhone}\n`;
    }
    emailBody += `Date:         ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}\n`;
    emailBody += `\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `ORDER SUMMARY\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `\n`;
    emailBody += tableHeader;
    emailBody += tableRows;
    emailBody += tableFooter;
    emailBody += `\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `PAYMENT SUMMARY\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `\n`;
    emailBody += `${padRight('Subtotal:', 20)}${padLeft(`$${orderDetails.subtotal.toFixed(2)}`, 20)}\n`;
    if (orderDetails.discountAmount > 0) {
        emailBody += `${padRight(`Discount (${orderDetails.discountPercent}%):`, 20)}${padLeft(`-$${orderDetails.discountAmount.toFixed(2)}`, 20)}\n`;
    }
    emailBody += `${'─'.repeat(40)}\n`;
    emailBody += `${padRight('TOTAL:', 20)}${padLeft(`$${orderDetails.total.toFixed(2)}`, 20)}\n`;
    emailBody += `\n`;
    
    if (orderDetails.customerComment) {
        emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        emailBody += `CUSTOMER COMMENTS\n`;
        emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        emailBody += `\n`;
        emailBody += `${orderDetails.customerComment}\n`;
        emailBody += `\n`;
    }
    
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    emailBody += `\n`;
    emailBody += `If you have any questions or concerns about your order, please reply\n`;
    emailBody += `to this email and our team will be happy to assist you.\n`;
    emailBody += `\n`;
    emailBody += `We appreciate your business and look forward to serving you again!\n`;
    emailBody += `\n`;
    emailBody += `Best regards,\n`;
    emailBody += `The WoofCrafts Team 🐶\n`;
    emailBody += `Crafting pawsome accessories for good dogs everywhere\n`;
    emailBody += `\n`;
    emailBody += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    return emailBody;
}

/**
 * Generate HTML email content (used as fallback or for preview)
 * This function is also used by app.js to show email preview
 */
function generateEmailContent(orderDetails) {
    // Escape HTML to prevent XSS and ensure proper rendering
    const escapeHtml = (text) => {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    };

    const itemsHtml = orderDetails.items.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal.toFixed(2)}</td>
        </tr>
    `).join('');

    // Generate full HTML email structure for better email client compatibility
    const emailBody = `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #4A90E2; margin-top: 0;">🐾 WoofCrafts Order Confirmation</h1>
            <p style="margin: 10px 0;">Thank you for shopping with WoofCrafts, your home for adorable dog accessories and NFC-enabled dog tags!</p>
            
            <p style="margin: 10px 0;">We've received your order and are getting it ready for your pup.</p>
            
            <p style="margin: 10px 0;"><strong>Here's a summary of what you bought:</strong></p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ddd;">
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #4A90E2; border-right: 1px solid #ddd;">Item</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #4A90E2; border-right: 1px solid #ddd;">Qty</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #4A90E2; border-right: 1px solid #ddd;">Price</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #4A90E2;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                <p style="text-align: right; margin: 5px 0;"><strong>Subtotal: $${orderDetails.subtotal.toFixed(2)}</strong></p>
                ${orderDetails.discountAmount > 0 ? `
                    <p style="text-align: right; margin: 5px 0;">Discount (${orderDetails.discountPercent}%): -$${orderDetails.discountAmount.toFixed(2)}</p>
                ` : ''}
                <p style="text-align: right; font-size: 1.2em; color: #4A90E2; margin: 10px 0;"><strong>Total: $${orderDetails.total.toFixed(2)}</strong></p>
            </div>
            
            ${orderDetails.customerComment ? `
            <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #4A90E2; border-radius: 5px;">
                <p style="margin: 0; font-weight: bold; color: #4A90E2;">Customer Comments:</p>
                <p style="margin: 5px 0 0 0; color: #5C4A37;">${escapeHtml(orderDetails.customerComment)}</p>
            </div>
            ` : ''}
            
            <p style="margin: 20px 0 10px 0;">If anything looks off with your order, just reply to this email and our pack will help you out.</p>
            
            <p style="font-size: 14px; margin: 20px 0 0 0;">
                With tail wags,<br/>
                <strong>The WoofCrafts Team</strong><br/>
                Crafting pawsome accessories for good dogs everywhere 🐶
            </p>
        </div>
    `;

    // Return full HTML document structure for email clients
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WoofCrafts Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
    ${emailBody}
</body>
</html>`;
}

