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

    // Generate beautiful table rows for items with alternating colors
    const itemsHtml = orderDetails.items.map((item, index) => `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#fafbfc'};">
            <td style="padding: 18px 16px; border-bottom: 1px solid #e8ecf0; font-size: 15px; color: #2d3748; font-weight: 500; line-height: 1.5;">
                ${escapeHtml(item.name)}
            </td>
            <td style="padding: 18px 16px; border-bottom: 1px solid #e8ecf0; text-align: center; font-size: 15px; color: #4a5568; font-weight: 500;">
                ${item.quantity}
            </td>
            <td style="padding: 18px 16px; border-bottom: 1px solid #e8ecf0; text-align: right; font-size: 15px; color: #4a5568; font-weight: 500;">
                $${item.price.toFixed(2)}
            </td>
            <td style="padding: 18px 16px; border-bottom: 1px solid #e8ecf0; text-align: right; font-size: 15px; color: #2d3748; font-weight: 600;">
                $${item.subtotal.toFixed(2)}
            </td>
        </tr>
    `).join('');

    // Generate beautiful, modern HTML email structure
    const emailBody = `
        <div style="max-width: 650px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc;">
            <!-- Outer Container with Shadow Effect -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7fafc; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <!-- Main Card Container -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
                            
                            <!-- Beautiful Gradient Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 40px; text-align: center;">
                                    <div style="margin-bottom: 12px;">
                                        <span style="font-size: 48px; display: inline-block;">🐾</span>
                                    </div>
                                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.2; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                        WoofCrafts
                                    </h1>
                                    <p style="color: rgba(255, 255, 255, 0.95); margin: 8px 0 0 0; font-size: 18px; font-weight: 400; letter-spacing: 0.3px;">
                                        Order Confirmation
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Main Content Area -->
                            <tr>
                                <td style="padding: 45px 40px;">
                                    
                                    <!-- Welcome Section -->
                                    <div style="margin-bottom: 35px;">
                                        <p style="margin: 0 0 16px 0; font-size: 18px; line-height: 1.7; color: #2d3748; font-weight: 400;">
                                            Thank you for shopping with <strong style="color: #667eea;">WoofCrafts</strong>, your home for adorable dog accessories and NFC-enabled dog tags!
                                        </p>
                                        <p style="margin: 0; font-size: 17px; line-height: 1.7; color: #4a5568; font-weight: 400;">
                                            We've received your order and are getting it ready for your pup. 🐕
                                        </p>
                                    </div>
                                    
                                    <!-- Order Info Card -->
                                    <div style="background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%); border-radius: 12px; padding: 24px; margin-bottom: 35px; border: 1px solid #e8ecf0;">
                                        <div style="display: table; width: 100%;">
                                            <div style="display: table-row;">
                                                <div style="display: table-cell; padding: 8px 0; width: 50%;">
                                                    <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 4px;">Order ID</div>
                                                    <div style="font-size: 18px; color: #2d3748; font-weight: 700; font-family: 'Courier New', monospace;">#${orderDetails.orderId || 'N/A'}</div>
                                                </div>
                                                <div style="display: table-cell; padding: 8px 0; width: 50%; text-align: right;">
                                                    <div style="font-size: 12px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 4px;">Date</div>
                                                    <div style="font-size: 16px; color: #4a5568; font-weight: 500;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Section Title -->
                                    <div style="margin-bottom: 20px;">
                                        <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #2d3748; letter-spacing: -0.3px;">
                                            Order Summary
                                        </h2>
                                        <div style="width: 60px; height: 4px; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); border-radius: 2px; margin-top: 8px;"></div>
                                    </div>
                                    
                                    <!-- Beautiful Order Table -->
                                    <div style="border-radius: 12px; overflow: hidden; border: 1px solid #e8ecf0; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
                                            <thead>
                                                <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                                                    <th style="padding: 18px 16px; text-align: left; font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
                                                    <th style="padding: 18px 16px; text-align: center; font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                                                    <th style="padding: 18px 16px; text-align: right; font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
                                                    <th style="padding: 18px 16px; text-align: right; font-size: 13px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${itemsHtml}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <!-- Totals Section - Beautiful Card -->
                                    <div style="background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%); border-radius: 12px; padding: 28px; margin-bottom: 30px; border: 1px solid #e8ecf0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <div style="font-size: 16px; color: #4a5568; font-weight: 500;">Subtotal</div>
                                                </td>
                                                <td align="right" style="padding: 8px 0;">
                                                    <div style="font-size: 16px; color: #2d3748; font-weight: 600;">$${orderDetails.subtotal.toFixed(2)}</div>
                                                </td>
                                            </tr>
                                            ${orderDetails.discountAmount > 0 ? `
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <div style="font-size: 16px; color: #4a5568; font-weight: 500;">Discount (${orderDetails.discountPercent}%)</div>
                                                </td>
                                                <td align="right" style="padding: 8px 0;">
                                                    <div style="font-size: 16px; color: #48bb78; font-weight: 600;">-$${orderDetails.discountAmount.toFixed(2)}</div>
                                                </td>
                                            </tr>
                                            ` : ''}
                                            <tr>
                                                <td colspan="2" style="padding: 16px 0 8px 0; border-top: 2px solid #e8ecf0;"></td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <div style="font-size: 24px; color: #2d3748; font-weight: 700; letter-spacing: -0.5px;">Total</div>
                                                </td>
                                                <td align="right" style="padding: 8px 0;">
                                                    <div style="font-size: 28px; color: #667eea; font-weight: 700; letter-spacing: -0.5px;">$${orderDetails.total.toFixed(2)}</div>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                    
                                    ${orderDetails.customerComment ? `
                                    <!-- Customer Comments - Beautiful Card -->
                                    <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); border-left: 4px solid #f56565; border-radius: 8px; padding: 20px; margin-bottom: 30px; border: 1px solid #fed7d7;">
                                        <div style="font-size: 13px; color: #c53030; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; margin-bottom: 10px;">💬 Customer Comments</div>
                                        <div style="font-size: 15px; color: #2d3748; line-height: 1.6; font-weight: 400;">${escapeHtml(orderDetails.customerComment)}</div>
                                    </div>
                                    ` : ''}
                                    
                                    <!-- Support Message Card -->
                                    <div style="background: linear-gradient(135deg, #ebf8ff 0%, #ffffff 100%); border-radius: 12px; padding: 24px; margin-bottom: 35px; border: 1px solid #bee3f8; text-align: center;">
                                        <div style="font-size: 32px; margin-bottom: 12px;">💌</div>
                                        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #2d3748; font-weight: 400;">
                                            If anything looks off with your order, just reply to this email and our pack will help you out.
                                        </p>
                                    </div>
                                    
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
                            
                            <!-- Bottom Accent -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 6px;"></td>
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

