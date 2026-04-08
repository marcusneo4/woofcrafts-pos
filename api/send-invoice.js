const nodemailer = require('nodemailer');

/**
 * Read and parse a JSON body for Node HTTP requests.
 * Vercel often provides `req.body`, but this fallback keeps the route robust.
 * @param {import('http').IncomingMessage} req
 * @param {{ maxBytes: number }} options
 * @returns {Promise<unknown>}
 */
async function readJsonBody(req, { maxBytes }) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;

        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                reject(new Error('Request body too large'));
                req.destroy();
                return;
            }
            body += chunk.toString('utf8');
        });

        req.on('error', (error) => reject(error));

        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
    });
}

/**
 * Vercel API route: send invoice PDF email.
 * Accepts JSON body:
 * - pdfBase64 (string, base64-encoded PDF without data-uri prefix)
 * - customerEmail (string)
 * - customerName (string, optional)
 * - purchaseDate (string, optional - ISO date preferred)
 * - invoiceNumber (string, optional)
 * - fileName (string, optional)
 *
 * @param {import('http').IncomingMessage & { body?: unknown }} req
 * @param {import('http').ServerResponse & { statusCode?: number }} res
 */
module.exports = async function sendInvoiceHandler(req, res) {
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        return;
    }

    try {
        const payload = (req.body && typeof req.body === 'object')
            ? req.body
            : await readJsonBody(req, { maxBytes: 20 * 1024 * 1024 });
        const pdfBase64Raw = payload.pdfBase64;
        const customerEmail = payload.customerEmail;
        const customerNameRaw = payload.customerName;
        const purchaseDateRaw = payload.purchaseDate;
        const invoiceNumberRaw = payload.invoiceNumber;
        const fileNameRaw = payload.fileName;

        if (!pdfBase64Raw || typeof pdfBase64Raw !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Missing required field: pdfBase64 (string)' }));
            return;
        }

        if (!customerEmail || typeof customerEmail !== 'string') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Missing required field: customerEmail (string)' }));
            return;
        }

        const cleanedBase64 = pdfBase64Raw.replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanedBase64)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid pdfBase64 (not valid base64)' }));
            return;
        }

        const pdfBuffer = Buffer.from(cleanedBase64, 'base64');
        if (!pdfBuffer || pdfBuffer.length < 1000) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'pdfBase64 decoded to an empty/invalid PDF' }));
            return;
        }

        const emailUser = process.env.GMAIL_USER || process.env.EMAIL_USER;
        const emailPass = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;
        if (!emailUser || !emailPass) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                success: false,
                error: 'Invoice email not configured. Set either (GMAIL_USER + GMAIL_APP_PASSWORD) or (EMAIL_USER + EMAIL_PASS) in .env.'
            }));
            return;
        }

        const sanitizedFileNameBase = typeof fileNameRaw === 'string' && fileNameRaw.trim().length > 0
            ? fileNameRaw.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
            : 'WoofCrafts_Invoice.pdf';
        const sanitizedFileName = sanitizedFileNameBase.toLowerCase().endsWith('.pdf')
            ? sanitizedFileNameBase
            : `${sanitizedFileNameBase}.pdf`;

        const host = process.env.GMAIL_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
        const port = Number(process.env.GMAIL_PORT || process.env.EMAIL_PORT) || 587;
        const secure = port === 465;

        const invoiceTransporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: emailUser,
                pass: String(emailPass).replace(/\s/g, '')
            }
        });

        const mailFrom = process.env.GMAIL_FROM || process.env.EMAIL_FROM || emailUser;
        const subject = process.env.INVOICE_SUBJECT || 'WoofCrafts Invoice';
        const storeName = 'WoofCrafts';

        const sanitizeInlineText = (value, fallback) => {
            if (typeof value !== 'string') return fallback;
            const trimmed = value.trim().replace(/\s+/g, ' ');
            if (!trimmed) return fallback;
            return trimmed.slice(0, 120);
        };

        const formatPurchaseDate = (value) => {
            try {
                if (!value) return '';
                const date = (value instanceof Date) ? value : new Date(String(value));
                if (Number.isNaN(date.getTime())) return '';
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            } catch {
                return '';
            }
        };

        const safeCustomerName = sanitizeInlineText(customerNameRaw, '');
        const greetingName = safeCustomerName || 'there';
        const safeInvoiceNumber = sanitizeInlineText(invoiceNumberRaw, '');
        const formattedPurchaseDate = formatPurchaseDate(purchaseDateRaw);

        const emailLines = [
            `Hi ${greetingName},`,
            '',
            `Thank you for shopping with ${storeName}.`,
            '',
            `Attached is your invoice${safeInvoiceNumber ? ` #${safeInvoiceNumber}` : ''}${formattedPurchaseDate ? ` for your recent in-store purchase on ${formattedPurchaseDate}` : ''}.`,
            'It includes a full breakdown of the items, taxes, and payment details recorded in our point-of-sale system.',
            '',
            'Please keep this email and the attached PDF for your records.',
            'We appreciate your business and look forward to serving you again.',
            '',
            storeName
        ];

        const emailText = emailLines.join('\n');

        const info = await invoiceTransporter.sendMail({
            from: mailFrom,
            to: customerEmail,
            subject,
            text: emailText,
            attachments: [
                {
                    filename: sanitizedFileName,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            success: true,
            messageId: info.messageId,
            recipient: customerEmail,
            fileName: sanitizedFileName
        }));
    } catch (error) {
        console.error('[Vercel SendInvoice] ❌ Error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }));
    }
};

