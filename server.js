// Simple HTTP Server for WoofCrafts POS System with Email Support
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.PORT || 8001;
const PUBLIC_DIR = __dirname;

// Request body size limit (10MB for base64 images, 1MB for JSON)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

// External product images directory (set PRODUCT_IMAGES_DIR in .env for your path)
const EXTERNAL_IMAGES_DIR = process.env.PRODUCT_IMAGES_DIR || path.join(__dirname, 'assets', 'Dog product images');

// Import email functionality
let transporter, generateOrderEmail, generatePlainTextEmail;
try {
    transporter = require('./email-config');
    const emailTemplate = require('./email-template');
    generateOrderEmail = emailTemplate.generateOrderEmail;
    generatePlainTextEmail = emailTemplate.generatePlainTextEmail;
} catch (error) {
    console.log('⚠️  Email functionality not configured yet. Run: npm install');
}

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Ensure assets/images directory exists
const IMAGES_DIR = path.join(PUBLIC_DIR, 'assets', 'images');
if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log('✓ Created assets/images directory');
}

// Check if external images directory exists
if (fs.existsSync(EXTERNAL_IMAGES_DIR)) {
    console.log(`✓ External images directory found: ${EXTERNAL_IMAGES_DIR}`);
} else {
    console.log(`⚠️  External images directory not found: ${EXTERNAL_IMAGES_DIR}`);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;

    // API Endpoint: Upload Product Image
    if (pathname === '/api/upload-image' && req.method === 'POST') {
        let body = '';
        let bodySize = 0;
        let responded = false;
        const sendResponse = (status, obj) => {
            if (responded) return;
            responded = true;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(obj));
        };

        req.on('data', chunk => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                req.destroy();
            } else {
                body += chunk.toString();
            }
        });

        req.on('error', () => {
            if (!responded) sendResponse(413, { success: false, error: 'Request body too large (max 10MB)' });
        });

        req.on('end', () => {
            if (bodySize > MAX_BODY_SIZE) {
                sendResponse(413, { success: false, error: 'Request body too large (max 10MB)' });
                return;
            }
            try {
                const data = JSON.parse(body);
                
                if (!data.imageData || !data.filename) {
                    sendResponse(400, { success: false, error: 'Missing required fields: imageData and filename are required' });
                    return;
                }

                // Validate base64 format
                const base64Match = String(data.imageData).match(/^data:image\/(\w+);base64,(.+)$/);
                if (!base64Match) {
                    sendResponse(400, { success: false, error: 'Invalid image data format. Expected data:image/xxx;base64,...' });
                    return;
                }
                const base64Data = base64Match[2];
                if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
                    sendResponse(400, { success: false, error: 'Invalid base64 data' });
                    return;
                }
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
                // Sanitize filename
                const sanitizedFilename = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                const timestamp = Date.now();
                const fileExtension = sanitizedFilename.split('.').pop() || 'png';
                const finalFilename = `${timestamp}_${sanitizedFilename}`;
                const filePath = path.join(IMAGES_DIR, finalFilename);
                
                // Save file
                fs.writeFileSync(filePath, imageBuffer);
                
                // Return relative path for use in img src
                const relativePath = `assets/images/${finalFilename}`;
                
                console.log(`✅ Image uploaded: ${finalFilename}`);
                sendResponse(200, { success: true, imagePath: relativePath, filename: finalFilename });
            } catch (error) {
                console.error('❌ Image upload error:', error);
                const safeMessage = error instanceof SyntaxError ? 'Invalid JSON in request body' : error.message;
                sendResponse(500, { success: false, error: safeMessage });
            }
        });

        return;
    }

    // API Endpoint: Send Order Confirmation Email
    if (pathname === '/api/send-order-email' && req.method === 'POST') {
        let body = '';
        let bodySize = 0;

        req.on('data', chunk => {
            bodySize += chunk.length;
            if (bodySize > 1024 * 1024) { // 1MB for order JSON
                req.destroy();
                return;
            }
            body += chunk.toString();
        });

        req.on('end', async () => {
            if (bodySize > 1024 * 1024) {
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Request body too large (max 1MB)' }));
                return;
            }
            try {
                const orderData = JSON.parse(body);
                
                // Validate required fields
                if (!orderData.customerEmail || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Missing required fields: customerEmail and items (non-empty array) are required'
                    }));
                    return;
                }

                // Validate each item has required fields
                const validItems = orderData.items.filter(item =>
                    item && typeof item.name === 'string' && typeof item.quantity === 'number' && typeof item.price === 'number'
                );
                if (validItems.length !== orderData.items.length) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Each item must have name (string), quantity (number), and price (number)'
                    }));
                    return;
                }

                // Check if email is configured
                if (!transporter || !generateOrderEmail) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'Email service not configured. Please run npm install and set up .env file.' 
                    }));
                    return;
                }

                // Generate HTML and plain text versions (use validated items)
                const sanitizedOrderData = { ...orderData, items: validItems };
                const emailHTML = generateOrderEmail(sanitizedOrderData);
                const emailText = generatePlainTextEmail(sanitizedOrderData);

                // Send email with both HTML and plain text versions
                const info = await transporter.sendMail({
                    from: process.env.EMAIL_FROM || 'WoofCrafts <noreply@woofcrafts.com>',
                    to: orderData.customerEmail,
                    subject: `🐾 Order Confirmation #${orderData.orderId || 'NEW'} - WoofCrafts`,
                    text: emailText,  // Plain text version (fallback)
                    html: emailHTML   // HTML version (preferred)
                });

                console.log(`✅ Email sent to ${orderData.customerEmail} - Message ID: ${info.messageId}`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    messageId: info.messageId,
                    recipient: orderData.customerEmail
                }));

            } catch (error) {
                console.error('❌ Email sending error:', error);
                const safeMessage = error instanceof SyntaxError ? 'Invalid JSON in request body' : error.message;
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: safeMessage }));
            }
        });

        return;
    }

    // Serve product images from external directory
    if (pathname.startsWith('/product-images/')) {
        const rawFilename = pathname.replace(/^\/product-images\//, '');
        const imageFilename = decodeURIComponent(rawFilename).replace(/\.\./g, '').replace(/[\/\\]/g, '');
        if (!imageFilename) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid filename');
            return;
        }
        const imagePath = path.join(EXTERNAL_IMAGES_DIR, imageFilename);
        const resolvedImagePath = path.resolve(imagePath);
        const resolvedBaseDir = path.resolve(EXTERNAL_IMAGES_DIR);

        // Security check: ensure the file is within the external images directory (path traversal protection)
        if (!resolvedImagePath.startsWith(resolvedBaseDir)) {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('<h1>403 - Forbidden</h1>', 'utf-8');
            return;
        }
        
        const extname = String(path.extname(imagePath)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';
        
        fs.readFile(imagePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    console.log(`Image not found: ${imagePath}`);
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 - Image Not Found</h1>', 'utf-8');
                } else {
                    console.error(`Server error for ${imagePath}:`, error);
                    res.writeHead(500);
                    res.end(`Server Error: ${error.code}`, 'utf-8');
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // Serve static files
    const requestPath = parsedUrl.pathname.split('?')[0];
    const safePath = requestPath === '/' ? '/index.html' : requestPath;
    const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, normalizedPath);

    // Enforce serving only within public dir
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        res.end('<h1>403 - Forbidden</h1>', 'utf-8');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                console.error(`Server error for ${filePath}:`, error);
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.on('error', (err) => {
    console.error(`Server failed to start on port ${PORT}: ${err.message}`);
});

server.listen(PORT, () => {
    console.log(`\n🐾 WoofCrafts POS Server running at http://localhost:${PORT}/\n`);
    console.log('Press Ctrl+C to stop the server\n');
    
    // Open browser automatically
    const { exec } = require('child_process');
    const url = `http://localhost:${PORT}`;
    
    const platform = process.platform;
    if (platform === 'win32') {
        exec(`start ${url}`);
    } else if (platform === 'darwin') {
        exec(`open ${url}`);
    } else {
        exec(`xdg-open ${url}`);
    }
});

