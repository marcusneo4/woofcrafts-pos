// Simple HTTP Server for WoofCrafts POS System with Email Support
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.PORT || 8001;
const PUBLIC_DIR = __dirname;

// External product images directory
const EXTERNAL_IMAGES_DIR = 'C:\\Users\\e0775081\\Downloads\\Dog product images';

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
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                
                if (!data.imageData || !data.filename) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required fields: imageData and filename are required' 
                    }));
                    return;
                }

                // Extract base64 data (remove data:image/...;base64, prefix if present)
                const base64Data = data.imageData.replace(/^data:image\/\w+;base64,/, '');
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
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    imagePath: relativePath,
                    filename: finalFilename
                }));

            } catch (error) {
                console.error('❌ Image upload error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: error.message 
                }));
            }
        });
        
        return;
    }

    // API Endpoint: Send Order Confirmation Email
    if (pathname === '/api/send-order-email' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const orderData = JSON.parse(body);
                
                // Validate required fields
                if (!orderData.customerEmail || !orderData.items || orderData.items.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'Missing required fields: customerEmail and items are required' 
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

                // Generate HTML and plain text versions of the email
                const emailHTML = generateOrderEmail(orderData);
                const emailText = generatePlainTextEmail(orderData);

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
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: error.message 
                }));
            }
        });
        
        return;
    }

    // Serve product images from external directory
    if (pathname.startsWith('/product-images/')) {
        const imageFilename = decodeURIComponent(pathname.replace('/product-images/', ''));
        const imagePath = path.join(EXTERNAL_IMAGES_DIR, imageFilename);
        
        // Security check: ensure the file is within the external images directory
        if (!imagePath.startsWith(EXTERNAL_IMAGES_DIR)) {
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

