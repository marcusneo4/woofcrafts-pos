// WoofCrafts POS System - Email Functionality using EmailJS

// Initialize EmailJS
// Configure EmailJS at https://www.emailjs.com
// Use marcusneo4@gmail.com as the sending email
// 
// IMPORTANT EMAILJS TEMPLATE CONFIGURATION:
// 1. In your EmailJS template, set the "To Email" field to: {{to_email}}
//    This ensures emails are sent to the customer email entered in the form, not a hardcoded address.
// 2. Set your EmailJS template format to "HTML" for rich email formatting.
//    Use {{message_html}} in your template body to include the full formatted HTML email content.
//    For plain text fallback, use {{message}} instead.
// 3. Available template variables:
//    - {{to_email}} - Customer email (REQUIRED for correct recipient)
//    - {{customer_name}} - Customer name
//    - {{customer_phone}} - Customer phone
//    - {{order_id}} - Order ID
//    - {{order_items}} - Plain text items list (simple format)
//    - {{message}} - Full formatted plain text email body
//    - {{message_html}} - Full formatted HTML email body (RECOMMENDED for HTML templates)
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

        // Generate both HTML and plain text email content
        const emailHtml = generateEmailContent(orderDetails);
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
            message: emailText, // Plain text email body
            message_html: emailHtml, // HTML email body - use this in your EmailJS template for HTML format
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
 * Generate beautiful, modern HTML email content
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

    // Generate beautiful card-based items using tables for email compatibility
    const colors = [
        { bg: '#FFF5F7', border: '#FED7E2', accent: '#ED64A6' }, // Pink
        { bg: '#EBF8FF', border: '#BEE3F8', accent: '#4299E1' }, // Blue
        { bg: '#F0FFF4', border: '#C6F6D5', accent: '#48BB78' }, // Green
        { bg: '#FFFAF0', border: '#FEEBC8', accent: '#ED8936' }, // Orange
        { bg: '#F7FAFC', border: '#E2E8F0', accent: '#718096' }  // Gray
    ];
    
    const itemsHtml = orderDetails.items.map((item, index) => {
        const colorScheme = colors[index % colors.length];
        return `
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                    <td style="background-color: ${colorScheme.bg}; border: 2px solid ${colorScheme.border}; border-radius: 12px; padding: 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                                <td style="padding: 0;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td style="padding-bottom: 12px;">
                                                <div style="font-size: 18px; color: #2D3748; font-weight: 700; line-height: 1.4;">
                                                    ${escapeHtml(item.name)}
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                                    <tr>
                                                        <td style="padding-right: 20px;">
                                                            <span style="font-size: 12px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Qty:</span>
                                                            <span style="background-color: ${colorScheme.accent}; color: #FFFFFF; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 700; display: inline-block; margin-left: 6px;">
                                                                ${item.quantity}
                                                            </span>
                                                        </td>
                                                        <td style="padding-right: 20px;">
                                                            <span style="font-size: 12px; color: #718096; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Price:</span>
                                                            <span style="font-size: 15px; color: #4A5568; font-weight: 700; margin-left: 6px;">
                                                                $${item.price.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td align="right" style="padding: 0;">
                                                            <div style="font-size: 24px; color: ${colorScheme.accent}; font-weight: 800; letter-spacing: -0.5px;">
                                                                $${item.subtotal.toFixed(2)}
                                                            </div>
                                                            <div style="font-size: 10px; color: #A0AEC0; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                                                                Subtotal
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        `;
    }).join('');

    // Generate beautiful, modern HTML email structure
    const emailBody = `
        <div style="max-width: 650px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc;">
            <!-- Outer Container with Shadow Effect -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7fafc; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <!-- Main Card Container -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
                            
                            <!-- Beautiful Colorful Gradient Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #D4A574 0%, #C9A961 50%, #E8D5B7 100%); padding: 50px 40px; text-align: center;">
                                    <div style="margin-bottom: 12px;">
                                        <span style="font-size: 56px; display: inline-block;">🐾</span>
                                    </div>
                                    <h1 style="color: #FFFFFF; margin: 0; font-size: 36px; font-weight: 800; letter-spacing: 1px; line-height: 1.2; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                                        WoofCrafts
                                    </h1>
                                    <p style="color: #FFFFFF; margin: 12px 0 0 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; text-shadow: 1px 1px 2px rgba(0,0,0,0.15);">
                                        ✨ Order Confirmation ✨
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Main Content Area -->
                            <tr>
                                <td style="padding: 45px 40px;">
                                    
                                    <!-- Welcome Section with Color -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 35px;">
                                        <tr>
                                            <td style="background: linear-gradient(135deg, #EBF8FF 0%, #F0FFF4 100%); border-left: 5px solid #D4A574; border-radius: 8px; padding: 24px;">
                                                <p style="margin: 0 0 12px 0; font-size: 19px; line-height: 1.7; color: #2D3748; font-weight: 600;">
                                                    🎉 Thank you for shopping with <strong style="color: #D4A574;">WoofCrafts</strong>! 🎉
                                                </p>
                                                <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4A5568; font-weight: 400;">
                                                    Your home for adorable dog accessories and NFC-enabled dog tags! We've received your order and are getting it ready for your pup. 🐕✨
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Order Info Card with Colors -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 35px;">
                                        <tr>
                                            <td style="background: linear-gradient(135deg, #FFF5F7 0%, #EBF8FF 100%); border-radius: 12px; padding: 24px; border: 2px solid #FED7E2;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="padding: 8px 0; width: 50%;">
                                                            <div style="font-size: 11px; color: #ED64A6; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px;">📋 Order ID</div>
                                                            <div style="font-size: 22px; color: #D4A574; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 1px;">#${orderDetails.orderId || 'N/A'}</div>
                                                        </td>
                                                        <td style="padding: 8px 0; width: 50%; text-align: right;">
                                                            <div style="font-size: 11px; color: #ED64A6; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px;">📅 Date</div>
                                                            <div style="font-size: 18px; color: #4A5568; font-weight: 700;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Section Title with Color -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                                        <tr>
                                            <td>
                                                <h2 style="margin: 0; font-size: 26px; font-weight: 800; color: #D4A574; letter-spacing: 0.5px;">
                                                    🛒 Order Summary
                                                </h2>
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 10px;">
                                                    <tr>
                                                        <td style="width: 80px; height: 5px; background: linear-gradient(90deg, #D4A574 0%, #C9A961 50%, #E8D5B7 100%); border-radius: 3px;"></td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Beautiful Colorful Order Cards -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                                        <tr>
                                            <td>
                                                ${itemsHtml}
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Totals Section - Beautiful Colorful Card -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                                        <tr>
                                            <td style="background: linear-gradient(135deg, #F0FFF4 0%, #EBF8FF 100%); border-radius: 12px; padding: 28px; border: 3px solid #C9A961;">
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="padding: 10px 0;">
                                                            <div style="font-size: 17px; color: #4A5568; font-weight: 600;">Subtotal</div>
                                                        </td>
                                                        <td align="right" style="padding: 10px 0;">
                                                            <div style="font-size: 18px; color: #2D3748; font-weight: 700;">$${orderDetails.subtotal.toFixed(2)}</div>
                                                        </td>
                                                    </tr>
                                                    ${orderDetails.discountAmount > 0 ? `
                                                    <tr>
                                                        <td style="padding: 10px 0;">
                                                            <div style="font-size: 17px; color: #4A5568; font-weight: 600;">🎁 Discount (${orderDetails.discountPercent}%)</div>
                                                        </td>
                                                        <td align="right" style="padding: 10px 0;">
                                                            <div style="font-size: 18px; color: #48BB78; font-weight: 700;">-$${orderDetails.discountAmount.toFixed(2)}</div>
                                                        </td>
                                                    </tr>
                                                    ` : ''}
                                                    <tr>
                                                        <td colspan="2" style="padding: 20px 0 10px 0; border-top: 3px solid #C9A961;"></td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 10px 0;">
                                                            <div style="font-size: 26px; color: #D4A574; font-weight: 800; letter-spacing: 0.5px;">💰 Total</div>
                                                        </td>
                                                        <td align="right" style="padding: 10px 0;">
                                                            <div style="font-size: 32px; color: #D4A574; font-weight: 900; letter-spacing: 0.5px;">$${orderDetails.total.toFixed(2)}</div>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    ${orderDetails.customerComment ? `
                                    <!-- Customer Comments - Beautiful Colorful Card -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 30px;">
                                        <tr>
                                            <td style="background: linear-gradient(135deg, #FFF5F7 0%, #FFFAF0 100%); border-left: 5px solid #ED8936; border-radius: 10px; padding: 24px; border: 2px solid #FED7E2;">
                                                <div style="font-size: 13px; color: #ED8936; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; margin-bottom: 12px;">💬 Customer Comments</div>
                                                <div style="font-size: 16px; color: #2D3748; line-height: 1.7; font-weight: 500;">${escapeHtml(orderDetails.customerComment)}</div>
                                            </td>
                                        </tr>
                                    </table>
                                    ` : ''}
                                    
                                    <!-- Support Message Card with Color -->
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 35px;">
                                        <tr>
                                            <td style="background: linear-gradient(135deg, #EBF8FF 0%, #F0FFF4 100%); border-radius: 12px; padding: 28px; border: 2px solid #BEE3F8; text-align: center;">
                                                <div style="font-size: 40px; margin-bottom: 16px;">💌</div>
                                                <p style="margin: 0; font-size: 17px; line-height: 1.7; color: #2D3748; font-weight: 500;">
                                                    If anything looks off with your order, just reply to this email and our pack will help you out! 🐾
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Beautiful Footer -->
                                    <div style="padding-top: 30px; border-top: 1px solid #e8ecf0; text-align: center;">
                                        <p style="margin: 0 0 12px 0; font-size: 16px; line-height: 1.6; color: #4a5568; font-weight: 400;">
                                            With tail wags,
                                        </p>
                                        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #2d3748; letter-spacing: -0.3px;">
                                            The WoofCrafts Team
                                        </p>
                                        <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #718096; font-weight: 400;">
                                            Crafting pawsome accessories for good dogs everywhere 🐶
                                        </p>
                                    </div>
                                    
                                </td>
                            </tr>
                            
                            <!-- Bottom Colorful Accent -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #D4A574 0%, #C9A961 50%, #E8D5B7 100%); height: 8px;"></td>
                            </tr>
                            
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;

    // Return HTML content (EmailJS will wrap it in proper email structure)
    return emailBody;
}

