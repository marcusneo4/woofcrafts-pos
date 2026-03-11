// Simple HTTP Server for WoofCrafts POS System with Email Support
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8001;
const PUBLIC_DIR = __dirname;

// Request body size limit (10MB for base64 images, 1MB for JSON)
const MAX_BODY_SIZE = 10 * 1024 * 1024;

// External product images directory (set PRODUCT_IMAGES_DIR in .env for your path)
const EXTERNAL_IMAGES_DIR = process.env.PRODUCT_IMAGES_DIR || path.join(__dirname, 'assets', 'Dog product images');

// Import email functionality
let transporter;
let generateOrderEmail;
let generatePlainTextEmail;
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

/**
 * Safely parse the incoming request URL.
 * @param {string} rawUrl Raw URL from the HTTP request.
 * @returns {{ pathname: string } | null}
 */
function parseRequestPathname(rawUrl) {
    try {
        const parsedUrl = new URL(rawUrl, `http://localhost:${PORT}`);
        return { pathname: parsedUrl.pathname };
    } catch (error) {
        console.error('[Server] Failed to parse URL:', error);
        return null;
    }
}

/**
 * Handle product image uploads as base64 payloads.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function handleUploadImageRequest(req, res) {
    let body = '';
    let bodySize = 0;
    let responded = false;

    const sendResponse = (statusCode, payload) => {
        if (responded) {
            return;
        }
        responded = true;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
    };

    req.on('data', (chunk) => {
        bodySize += chunk.length;
        if (bodySize > MAX_BODY_SIZE) {
            req.destroy();
            return;
        }
        body += chunk.toString();
    });

    req.on('error', () => {
        if (!responded) {
            sendResponse(413, { success: false, error: 'Request body too large (max 10MB)' });
        }
    });

    req.on('end', () => {
        if (bodySize > MAX_BODY_SIZE) {
            sendResponse(413, { success: false, error: 'Request body too large (max 10MB)' });
            return;
        }

        try {
            const parsedBody = JSON.parse(body);

            if (!parsedBody.imageData || !parsedBody.filename) {
                sendResponse(400, {
                    success: false,
                    error: 'Missing required fields: imageData and filename are required'
                });
                return;
            }

            const base64Match = String(parsedBody.imageData).match(/^data:image\/(\w+);base64,(.+)$/);
            if (!base64Match) {
                sendResponse(400, {
                    success: false,
                    error: 'Invalid image data format. Expected data:image/xxx;base64,...'
                });
                return;
            }

            const base64Data = base64Match[2];
            if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
                sendResponse(400, { success: false, error: 'Invalid base64 data' });
                return;
            }

            const imageBuffer = Buffer.from(base64Data, 'base64');

            const sanitizedFilename = parsedBody.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const timestamp = Date.now();
            const finalFilename = `${timestamp}_${sanitizedFilename}`;
            const filePath = path.join(IMAGES_DIR, finalFilename);

            fs.writeFileSync(filePath, imageBuffer);

            const relativePath = `assets/images/${finalFilename}`;

            console.log(`✅ Image uploaded: ${finalFilename}`);
            sendResponse(200, { success: true, imagePath: relativePath, filename: finalFilename });
        } catch (error) {
            console.error('[Server] ❌ Image upload error:', error);
            const safeMessage = error instanceof SyntaxError ? 'Invalid JSON in request body' : error.message;
            sendResponse(500, { success: false, error: safeMessage });
        }
    });
}

/**
 * Validate and sanitize incoming order data intended for email confirmation.
 * @param {unknown} rawOrderData
 * @returns {{ isValid: boolean; errorMessage?: string; sanitizedOrder?: { customerEmail: string; items: { name: string; quantity: number; price: number }[]; [key: string]: any } }}
 */
function validateAndSanitizeOrderData(rawOrderData) {
    if (rawOrderData === null || typeof rawOrderData !== 'object') {
        return {
            isValid: false,
            errorMessage: 'Request body must be a JSON object'
        };
    }

    const candidate = rawOrderData;
    const customerEmail = candidate.customerEmail;
    const items = candidate.items;

    if (!customerEmail || typeof customerEmail !== 'string' || !items || !Array.isArray(items) || items.length === 0) {
        return {
            isValid: false,
            errorMessage: 'Missing required fields: customerEmail and items (non-empty array) are required'
        };
    }

    const validItems = items.filter((item) => {
        return (
            item &&
            typeof item.name === 'string' &&
            typeof item.quantity === 'number' &&
            typeof item.price === 'number'
        );
    });

    if (validItems.length !== items.length) {
        return {
            isValid: false,
            errorMessage: 'Each item must have name (string), quantity (number), and price (number)'
        };
    }

    return {
        isValid: true,
        sanitizedOrder: {
            ...candidate,
            customerEmail,
            items: validItems
        }
    };
}

/**
 * Handle sending order confirmation emails.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function handleSendOrderEmailRequest(req, res) {
    let body = '';
    let bodySize = 0;

    req.on('data', (chunk) => {
        bodySize += chunk.length;
        if (bodySize > 1024 * 1024) {
            req.destroy();
        } else {
            body += chunk.toString();
        }
    });

    req.on('end', async () => {
        if (bodySize > 1024 * 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Request body too large (max 1MB)' }));
            return;
        }

        try {
            const parsedOrder = JSON.parse(body);
            const validationResult = validateAndSanitizeOrderData(parsedOrder);

            if (!validationResult.isValid) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: validationResult.errorMessage }));
                return;
            }

            if (!transporter || !generateOrderEmail || !generatePlainTextEmail) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Email service not configured. Please run npm install and set up .env file.'
                }));
                return;
            }

            const sanitizedOrder = validationResult.sanitizedOrder;
            const emailHTML = generateOrderEmail(sanitizedOrder);
            const emailText = generatePlainTextEmail(sanitizedOrder);

            const info = await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'WoofCrafts <noreply@woofcrafts.com>',
                to: sanitizedOrder.customerEmail,
                subject: `🐾 Order Confirmation #${sanitizedOrder.orderId || 'NEW'} - WoofCrafts`,
                text: emailText,
                html: emailHTML
            });

            console.log(`✅ Email sent to ${sanitizedOrder.customerEmail} - Message ID: ${info.messageId}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                messageId: info.messageId,
                recipient: sanitizedOrder.customerEmail
            }));
        } catch (error) {
            console.error('[Server] ❌ Email sending error:', error);
            const safeMessage = error instanceof SyntaxError ? 'Invalid JSON in request body' : error.message;
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: safeMessage }));
        }
    });
}

/**
 * Serve product images from the external images directory.
 * @param {string} pathname
 * @param {import('http').ServerResponse} res
 */
function handleExternalProductImageRequest(pathname, res) {
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
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    });
}

/**
 * Serve static assets from the public directory.
 * @param {string} pathname
 * @param {import('http').ServerResponse} res
 */
function handleStaticAssetRequest(pathname, res) {
    const requestPath = pathname.split('?')[0];
    const safePath = requestPath === '/' ? '/index.html' : requestPath;

    let decodedPath;
    try {
        decodedPath = decodeURIComponent(safePath);
    } catch (error) {
        decodedPath = safePath;
    }

    const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    const filePath = path.join(PUBLIC_DIR, normalizedPath);

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
            return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
    });
}

const server = http.createServer((req, res) => {
    const parsed = parseRequestPathname(req.url);
    if (!parsed) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>400 - Bad Request</h1>', 'utf-8');
        return;
    }

    const { pathname } = parsed;

    if (pathname === '/api/upload-image' && req.method === 'POST') {
        handleUploadImageRequest(req, res);
        return;
    }

    if (pathname === '/api/send-order-email' && req.method === 'POST') {
        handleSendOrderEmailRequest(req, res);
        return;
    }

    if (pathname.startsWith('/product-images/')) {
        handleExternalProductImageRequest(pathname, res);
        return;
    }

    handleStaticAssetRequest(pathname, res);
});

server.on('error', (error) => {
    console.error(`Server failed to start on port ${PORT}: ${error.message}`);
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

module.exports = {
    server,
    parseRequestPathname,
    handleUploadImageRequest,
    validateAndSanitizeOrderData,
    handleSendOrderEmailRequest,
    handleExternalProductImageRequest,
    handleStaticAssetRequest
};

