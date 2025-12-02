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
 * Generate plain text email content for EmailJS with clean, simple formatting
 */
function generatePlainTextEmailContent(orderDetails) {
    // Build plain text email with clean, simple formatting
    let emailBody = `🐾 WOOFCRAFTS ORDER CONFIRMATION 🐾\n\n`;
    emailBody += `Dear ${orderDetails.customerName},\n\n`;
    emailBody += `Thank you for shopping with WoofCrafts! We've received your order and are getting it ready for your pup.\n\n`;
    
    emailBody += `ORDER INFORMATION\n\n`;
    emailBody += `Order ID: ${orderDetails.orderId || 'N/A'}\n`;
    emailBody += `Customer: ${orderDetails.customerName}\n`;
    if (orderDetails.customerPhone) {
        emailBody += `Phone: ${orderDetails.customerPhone}\n`;
    }
    emailBody += `Date: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}\n\n`;
    
    emailBody += `ORDER SUMMARY\n\n`;
    
    // List items in a simple format
    orderDetails.items.forEach(item => {
        emailBody += `${item.name}\n`;
        emailBody += `  Qty: ${item.quantity} x $${item.price.toFixed(2)} = $${item.subtotal.toFixed(2)}\n\n`;
    });
    
    emailBody += `PAYMENT SUMMARY\n\n`;
    emailBody += `Subtotal: $${orderDetails.subtotal.toFixed(2)}\n`;
    if (orderDetails.discountAmount > 0) {
        emailBody += `Discount (${orderDetails.discountPercent}%): -$${orderDetails.discountAmount.toFixed(2)}\n`;
    }
    emailBody += `TOTAL: $${orderDetails.total.toFixed(2)}\n\n`;
    
    if (orderDetails.customerComment) {
        emailBody += `CUSTOMER COMMENTS\n\n`;
        emailBody += `${orderDetails.customerComment}\n\n`;
    }
    
    emailBody += `If you have any questions or concerns about your order, please reply to this email and our team will be happy to assist you.\n\n`;
    emailBody += `We appreciate your business and look forward to serving you again!\n\n`;
    emailBody += `Best regards,\n`;
    emailBody += `The WoofCrafts Team 🐶\n`;
    emailBody += `Crafting pawsome accessories for good dogs everywhere\n`;

    return emailBody;
}

/**
 * Generate beautiful, Gmail-friendly HTML email content
 * Designed to render perfectly in Gmail, Outlook, and all email clients
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

    // Generate item rows - simple and clean
    const itemsHtml = orderDetails.items.map((item) => `
        <div style="padding: 16px 0; border-bottom: 1px solid #f0f0f0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="padding: 4px 0;">
                        <strong style="font-size: 15px; color: #333;">${escapeHtml(item.name)}</strong>
                    </td>
                    <td align="right" style="padding: 4px 0;">
                        <strong style="font-size: 15px; color: #D4A574;">$${item.subtotal.toFixed(2)}</strong>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-size: 13px; color: #666;">
                        Qty: ${item.quantity} × $${item.price.toFixed(2)}
                    </td>
                    <td></td>
                </tr>
            </table>
        </div>
    `).join('');

    // Generate clean, simple HTML email
    const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background-color: #D4A574; padding: 40px 20px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 8px;">🐾</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                WoofCrafts
            </h1>
            <p style="color: #ffffff; margin: 8px 0 0 0; font-size: 16px;">
                Order Confirmation
            </p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px 20px;">
            
            <!-- Greeting -->
            <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px 0;">
                Hi <strong>${escapeHtml(orderDetails.customerName)}</strong>,
            </p>
            
            <p style="font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 24px 0;">
                Thank you for your order! We're excited to get your items ready. Here's a summary of what you ordered:
            </p>
            
            <!-- Order ID Box -->
            <div style="background-color: #f8f8f8; padding: 16px; margin-bottom: 24px; border-left: 4px solid #D4A574;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td>
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">ORDER ID</div>
                            <div style="font-size: 20px; color: #D4A574; font-weight: bold;">#${orderDetails.orderId || 'N/A'}</div>
                        </td>
                        <td align="right">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">DATE</div>
                            <div style="font-size: 14px; color: #333;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        </td>
                    </tr>
                </table>
            </div>
            
            <!-- Order Items -->
            <h2 style="font-size: 18px; color: #333; margin: 0 0 16px 0; font-weight: bold;">
                Your Order
            </h2>
            
            <div style="margin-bottom: 24px;">
                ${itemsHtml}
            </div>
            
            <!-- Totals -->
            <div style="background-color: #f8f8f8; padding: 20px; margin-bottom: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 8px 0; font-size: 15px; color: #555;">
                            Subtotal
                        </td>
                        <td align="right" style="padding: 8px 0; font-size: 15px; color: #555;">
                            $${orderDetails.subtotal.toFixed(2)}
                        </td>
                    </tr>
                    ${orderDetails.discountAmount > 0 ? `
                    <tr>
                        <td style="padding: 8px 0; font-size: 15px; color: #4CAF50;">
                            Discount (${orderDetails.discountPercent}%)
                        </td>
                        <td align="right" style="padding: 8px 0; font-size: 15px; color: #4CAF50;">
                            -$${orderDetails.discountAmount.toFixed(2)}
                        </td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td style="padding: 16px 0 8px 0; font-size: 18px; color: #333; font-weight: bold; border-top: 2px solid #ddd;">
                            Total
                        </td>
                        <td align="right" style="padding: 16px 0 8px 0; font-size: 22px; color: #D4A574; font-weight: bold; border-top: 2px solid #ddd;">
                            $${orderDetails.total.toFixed(2)}
                        </td>
                    </tr>
                </table>
            </div>
            
            ${orderDetails.customerComment ? `
            <!-- Customer Comments -->
            <div style="background-color: #fffbf5; padding: 16px; margin-bottom: 24px; border-left: 4px solid #D4A574;">
                <div style="font-size: 12px; color: #D4A574; font-weight: bold; margin-bottom: 8px; text-transform: uppercase;">
                    Your Note
                </div>
                <div style="font-size: 14px; color: #555; line-height: 1.5;">
                    ${escapeHtml(orderDetails.customerComment)}
                </div>
            </div>
            ` : ''}
            
            <!-- Contact Info -->
            ${orderDetails.customerPhone ? `
            <div style="font-size: 13px; color: #888; margin-bottom: 24px;">
                <strong>Contact:</strong> ${escapeHtml(orderDetails.customerPhone)}
            </div>
            ` : ''}
            
            <!-- Support Message -->
            <div style="padding: 24px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; margin-bottom: 24px;">
                <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0; text-align: center;">
                    Questions about your order? Just reply to this email and we'll help you out! 🐾
                </p>
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding-top: 16px;">
                <p style="font-size: 14px; color: #888; margin: 0 0 8px 0;">
                    Thanks for shopping with us!
                </p>
                <p style="font-size: 16px; color: #D4A574; font-weight: bold; margin: 0 0 4px 0;">
                    The WoofCrafts Team 🐶
                </p>
                <p style="font-size: 13px; color: #aaa; margin: 0;">
                    Crafting pawsome accessories for good dogs
                </p>
            </div>
            
        </div>
        
    </div>
    `;

    return emailBody;
}

