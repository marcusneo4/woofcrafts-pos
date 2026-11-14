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
 * Only signed-in POS staff may send invoices. Checks the Supabase access token
 * sent by the browser and requires the `pos_staff` role in app_metadata
 * (app_metadata can only be changed from the Supabase dashboard or server side).
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<boolean>}
 */
async function isPosStaff(req) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const apiKey = process.env.SUPABASE_ANON_KEY;
    const authHeader = String((req.headers && req.headers.authorization) || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!supabaseUrl || !apiKey || !token) return false;

    try {
        const response = await fetch(`${String(supabaseUrl).replace(/\/$/, '')}/auth/v1/user`, {
            headers: { apikey: apiKey, Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return false;
        const user = await response.json();
        return Boolean(user && user.app_metadata && user.app_metadata.role === 'pos_staff');
    } catch (error) {
        return false;
    }
}

module.exports = async function sendInvoiceHandler(req, res) {
    if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        return;
    }

    if (!(await isPosStaff(req))) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'Sign in again to send invoices.' }));
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
        // Staff copies go out as BCC on every invoice, so the customer never sees these addresses.
        const copyTo = (process.env.INVOICE_COPY_TO || 'marissaneo3110@gmail.com,leeyuanzhang28@gmail.com')
            .split(',').map((a) => a.trim()).filter(Boolean);
        const subjectBase = process.env.INVOICE_SUBJECT || 'WoofCrafts Invoice';
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
            'It lists the items, any discount, delivery and the total.',
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
            bcc: copyTo,
            subject: safeInvoiceNumber ? `${subjectBase} #${safeInvoiceNumber}` : subjectBase,
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

