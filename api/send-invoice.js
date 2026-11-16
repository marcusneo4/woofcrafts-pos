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
        const order = (payload.order && typeof payload.order === 'object') ? payload.order : {};

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

        // Show the shop's name rather than a bare Gmail address in the inbox.
        const mailFrom = process.env.GMAIL_FROM || process.env.EMAIL_FROM || `WoofCrafts <${emailUser}>`;
        const replyTo = process.env.INVOICE_REPLY_TO || 'marcusneo4@gmail.com';
        // Staff copies go out as BCC on every invoice, so the customer never sees these addresses.
        const copyTo = (process.env.INVOICE_COPY_TO || 'marissaneo3110@gmail.com,leeyuanzhang28@gmail.com')
            .split(',').map((a) => a.trim()).filter(Boolean);
        const subjectBase = process.env.INVOICE_SUBJECT || 'Your WoofCrafts invoice';

        const sanitizeInlineText = (value, fallback) => {
            if (typeof value !== 'string') return fallback;
            const trimmed = value.trim().replace(/\s+/g, ' ');
            if (!trimmed) return fallback;
            return trimmed.slice(0, 120);
        };

        const escapeHtml = (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        const money = (value) => `$${Number(value || 0).toFixed(2)}`;

        // The shop and its customers are in Singapore, so the date on the email has
        // to match the date on the receipt rather than the server's UTC clock.
        const formatPurchaseDate = (value) => {
            try {
                const date = value ? new Date(String(value)) : new Date();
                if (Number.isNaN(date.getTime())) return '';
                return new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric'
                }).format(date);
            } catch {
                return '';
            }
        };

        const safeCustomerName = sanitizeInlineText(customerNameRaw, '');
        const greetingName = safeCustomerName || 'there';
        const safeInvoiceNumber = sanitizeInlineText(invoiceNumberRaw, '');
        const formattedPurchaseDate = formatPurchaseDate(purchaseDateRaw);

        const items = Array.isArray(order.items) ? order.items.slice(0, 60) : [];
        const discountAmount = Number(order.discountAmount || 0);
        const deliveryFee = Number(order.deliveryFee || 0);
        const isPickup = order.deliveryMethod === 'pickup';
        // Notes carry the engraving text, so keep every line (capped at 1,500 characters).
        const sanitizeNote = (value) => {
            if (typeof value !== 'string') return '';
            return value.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim())
                .join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500);
        };
        const comment = sanitizeNote(order.customerComment);
        const petName = sanitizeInlineText(order.petName, '');
        const ringColour = sanitizeInlineText(order.ringColour, '');
        const deliveryAddress = sanitizeNote(order.address).replace(/\n+/g, ', ').slice(0, 300);
        const orderFacts = [
            ["Pet's name", petName],
            ['Colour of ring', ringColour],
            ['Delivery address', isPickup ? '' : deliveryAddress]
        ].filter(([, value]) => value);
        const hasTotals = items.length > 0 || Number(order.total || 0) > 0;

        const deliveryText = isPickup ? 'Pickup' : (deliveryFee > 0 ? money(deliveryFee) : 'Free');

        // ---- Plain text, for mail apps that do not show HTML
        const textLines = [
            `Hi ${greetingName},`,
            '',
            "Thanks for shopping with WoofCrafts! Here's your invoice for today's order.",
            ''
        ];
        if (safeInvoiceNumber || formattedPurchaseDate) {
            textLines.push(`Invoice #${safeInvoiceNumber}${formattedPurchaseDate ? ` - ${formattedPurchaseDate}` : ''}`);
        }
        items.forEach((item) => {
            textLines.push(`${sanitizeInlineText(item && item.name, 'Item')} x ${Number((item && item.quantity) || 0)} - ${money(item && item.subtotal)}`);
        });
        if (hasTotals) {
            textLines.push(`Subtotal - ${money(order.subtotal)}`);
            if (discountAmount > 0) textLines.push(`Discount - -${money(discountAmount)}`);
            textLines.push(`Delivery - ${deliveryText}`);
            textLines.push(`Total - ${money(order.total)}`);
        }
        if (orderFacts.length) {
            textLines.push('');
            orderFacts.forEach(([label, value]) => textLines.push(`${label}: ${value}`));
        }
        if (comment) {
            textLines.push('', 'Your note:', comment);
        }
        textLines.push(
            '',
            'The PDF invoice is attached for your records. Reply to this email if anything is not right.',
            '',
            'Woof woof,',
            'The WoofCrafts team'
        );
        const emailText = textLines.join('\n');

        // ---- HTML, in the shop's own beige and brown
        const c = { paper: '#F5EFE6', card: '#FFFDF9', line: '#E2D2BA', ink: '#3B2E22', muted: '#6A573F', brand: '#8A5A2B' };
        const rowStyle = `padding:8px 0;border-bottom:1px solid ${c.line};font-size:15px;color:${c.ink};`;
        const itemRows = items.map((item) => `
            <tr>
              <td style="${rowStyle}">${escapeHtml(sanitizeInlineText(item && item.name, 'Item'))}
                <span style="color:${c.muted};">&times; ${escapeHtml(String(Number((item && item.quantity) || 0)))}</span>
              </td>
              <td align="right" style="${rowStyle}">${escapeHtml(money(item && item.subtotal))}</td>
            </tr>`).join('');

        const totalRow = (label, value, strong) => `
            <tr>
              <td style="padding:${strong ? '12px 0 0' : '6px 0 0'};font-size:${strong ? '17px' : '15px'};color:${strong ? c.ink : c.muted};${strong ? 'font-weight:700;' : ''}">${escapeHtml(label)}</td>
              <td align="right" style="padding:${strong ? '12px 0 0' : '6px 0 0'};font-size:${strong ? '17px' : '15px'};color:${strong ? c.brand : c.muted};${strong ? 'font-weight:700;' : ''}">${escapeHtml(value)}</td>
            </tr>`;

        const summaryBlock = hasTotals ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
            ${itemRows}
            ${totalRow('Subtotal', money(order.subtotal), false)}
            ${discountAmount > 0 ? totalRow('Discount', `-${money(discountAmount)}`, false) : ''}
            ${totalRow('Delivery', deliveryText, false)}
            ${totalRow('Total', money(order.total), true)}
          </table>` : '';

        const factsBlock = orderFacts.length ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
            ${orderFacts.map(([label, value]) => `
            <tr>
              <td style="padding:4px 12px 4px 0;font-size:15px;color:${c.muted};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
              <td style="padding:4px 0;font-size:15px;color:${c.ink};">${escapeHtml(value)}</td>
            </tr>`).join('')}
          </table>` : '';

        const noteBlock = comment ? `
          <p style="margin:18px 0 0;padding:12px 14px;background:${c.paper};border-radius:10px;font-size:15px;color:${c.ink};">
            <span style="color:${c.muted};">Your note:</span><br>${escapeHtml(comment).replace(/\n/g, '<br>')}
          </p>` : '';

        const emailHtml = `<!DOCTYPE html>
<html><body style="margin:0;padding:24px 12px;background:${c.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:${c.card};border:1px solid ${c.line};border-radius:16px;">
    <tr><td style="padding:28px 28px 0;">
      <p style="margin:0;font-size:22px;font-weight:700;color:${c.brand};">WoofCrafts</p>
      <p style="margin:4px 0 0;font-size:14px;color:${c.muted};">
        ${safeInvoiceNumber ? `Invoice #${escapeHtml(safeInvoiceNumber)}` : 'Invoice'}${formattedPurchaseDate ? ` &middot; ${escapeHtml(formattedPurchaseDate)}` : ''}
      </p>
    </td></tr>
    <tr><td style="padding:20px 28px 28px;">
      <p style="margin:0;font-size:16px;color:${c.ink};">Hi ${escapeHtml(greetingName)},</p>
      <p style="margin:10px 0 0;font-size:16px;color:${c.ink};">Thanks for shopping with WoofCrafts! Here&#39;s your invoice for today&#39;s order.</p>
      ${summaryBlock}
      ${factsBlock}
      ${noteBlock}
      <p style="margin:22px 0 0;font-size:15px;color:${c.muted};">The PDF invoice is attached for your records. Reply to this email if anything isn&#39;t right.</p>
      <p style="margin:18px 0 0;font-size:15px;color:${c.ink};">Woof woof,<br>The WoofCrafts team</p>
    </td></tr>
  </table>
</body></html>`;

        const info = await invoiceTransporter.sendMail({
            from: mailFrom,
            to: customerEmail,
            bcc: copyTo,
            replyTo: replyTo,
            subject: safeInvoiceNumber ? `${subjectBase} #${safeInvoiceNumber}` : subjectBase,
            text: emailText,
            html: emailHtml,
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

