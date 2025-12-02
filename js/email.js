// WoofCrafts POS System - Email Functionality using EmailJS

// Initialize EmailJS
// Configure EmailJS at https://www.emailjs.com
// Use marcusneo4@gmail.com as the sending email
const EMAILJS_CONFIG = {
    publicKey: 'pItLrmthOdxpZRMEw', // Replace with your EmailJS Public Key from dashboard
    serviceId: 'service_phey43q',  // EmailJS Service ID (Gmail service)
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
        const emailContent = generateEmailContent(orderDetails);
        console.log('EmailJS not configured. Email content:', emailContent);
        
        // Show email content in a new window for manual sending
        const emailWindow = window.open('', '_blank');
        emailWindow.document.write(`
            <html>
                <head><title>Order Confirmation Email</title></head>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>EmailJS not configured yet.</h2>
                    <p>To enable automatic email sending, configure EmailJS in js/email.js</p>
                    <hr>
                    <h3>Email Content (to send manually):</h3>
                    <div style="border: 1px solid #ccc; padding: 15px; background: #f9f9f9;">
                        ${emailContent}
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
            emailjs.init(EMAILJS_CONFIG.publicKey);
        }

        // Format items for email
        const itemsList = orderDetails.items.map(item => 
            `${item.name} - Qty: ${item.quantity} x $${item.price.toFixed(2)} = $${item.subtotal.toFixed(2)}`
        ).join('\n');

        // Prepare email template parameters
        const templateParams = {
            to_email: orderDetails.customerEmail,
            from_name: 'WoofCrafts',
            from_email: 'marcusneo4@gmail.com',
            customer_name: orderDetails.customerName,
            customer_phone: orderDetails.customerPhone || 'Not provided',
            order_id: orderDetails.orderId || 'N/A',
            order_items: itemsList,
            subtotal: `$${orderDetails.subtotal.toFixed(2)}`,
            discount: orderDetails.discountAmount > 0 
                ? `${orderDetails.discountPercent}% ($${orderDetails.discountAmount.toFixed(2)})`
                : 'None',
            total: `$${orderDetails.total.toFixed(2)}`,
            company_name: 'WoofCrafts'
        };

        // Send email using EmailJS
        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams
        );

        console.log('Email sent successfully:', response);
        return response;
    } catch (error) {
        console.error('EmailJS error:', error);
        const errorMessage = error?.text || error?.message || 'Unknown error occurred';
        throw new Error('Failed to send email: ' + errorMessage);
    }
}

/**
 * Generate HTML email content (used as fallback or for preview)
 * This function is also used by app.js to show email preview
 */
function generateEmailContent(orderDetails) {
    const itemsHtml = orderDetails.items.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.subtotal.toFixed(2)}</td>
        </tr>
    `).join('');

    return `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h1 style="color: #4A90E2;">🐾 WoofCrafts Order Confirmation</h1>
            <p>Thank you for shopping with WoofCrafts, your home for adorable dog accessories and NFC-enabled dog tags!</p>
            
            <p>We've received your order and are getting it ready for your pup.</p>
            
            <p><strong>Here's a summary of what you bought:</strong></p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #4A90E2;">Item</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #4A90E2;">Qty</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #4A90E2;">Price</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #4A90E2;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                <p style="text-align: right;"><strong>Subtotal: $${orderDetails.subtotal.toFixed(2)}</strong></p>
                ${orderDetails.discountAmount > 0 ? `
                    <p style="text-align: right;">Discount (${orderDetails.discountPercent}%): -$${orderDetails.discountAmount.toFixed(2)}</p>
                ` : ''}
                <p style="text-align: right; font-size: 1.2em; color: #4A90E2;"><strong>Total: $${orderDetails.total.toFixed(2)}</strong></p>
            </div>
            
            <p>If anything looks off with your order, just reply to this email and our pack will help you out.</p>
            
            <p style="font-size:14px;">
                With tail wags,<br/>
                <strong>The WoofCrafts Team</strong><br/>
                Crafting pawsome accessories for good dogs everywhere 🐶
            </p>
        </div>
    `;
}

