// Tests for the order-details upgrade: new order fields, editable notes, Excel export and the invoice email.
// Run with: node tests/order-details.test.js
const fs = require('fs'), vm = require('vm'), path = require('path'), Module = require('module');
const root = (process.argv[2] || path.join(__dirname, '..'));

let pass = 0, fail = 0;
const ok = (c, n, extra = '') => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' :: ' + extra : '')); };

// ---- a small fake page, enough for js/app.js to run
const els = {};
const mk = (id) => {
    if (els[id]) return els[id];
    const cls = new Set(); const attrs = {};
    return (els[id] = { id, value: '', textContent: '', innerHTML: '', checked: true, disabled: false, style: {}, scrollTop: 99,
        classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle(c, on) { (on === undefined ? !cls.has(c) : on) ? cls.add(c) : cls.delete(c); } },
        addEventListener() {}, focus() {}, setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; }, removeAttribute(k) { delete attrs[k]; },
        closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; } });
};
const toasts = []; const calls = { inserts: [], updates: [], uploads: [], fetches: [] };
let rpc = 0; let failPhotoUpload = false; let orders = [];
const builder = (table) => {
    const st = { op: 'select', filters: [], payload: null, single: false, range: null };
    const run = () => {
        if (st.op === 'insert') { calls.inserts.push({ table, row: st.payload }); return { data: null, error: null }; }
        let rows = orders.filter((o) => st.filters.every(([c, v]) => String(o[c]) === String(v)));
        if (st.op === 'update') { calls.updates.push({ table, payload: st.payload, filters: st.filters }); rows.forEach((o) => Object.assign(o, st.payload, { notes_edited_at: '2026-11-16T01:00:00Z' })); }
        if (st.range) rows = rows.slice(st.range[0], st.range[1] + 1);
        return st.single ? { data: rows[0] ? { ...rows[0] } : null, error: rows[0] ? null : { message: 'not found' } } : { data: rows.map((o) => ({ ...o })), error: null };
    };
    const api = { select: () => api, insert: (p) => { st.op = 'insert'; st.payload = p; return api; }, update: (p) => { st.op = 'update'; st.payload = p; return api; },
        eq: (c, v) => { st.filters.push([c, v]); return api; }, order: () => api, range: (a, b) => { st.range = [a, b]; return api; }, single: () => { st.single = true; return api; },
        then: (res, rej) => Promise.resolve().then(run).then(res, rej) };
    return api;
};
const client = { from: builder, rpc: async () => ({ data: String(1000 + rpc++).padStart(6, '0'), error: null }),
    storage: { from: (b) => ({ upload: async (p) => { if (b === 'order-photos' && failPhotoUpload) return { error: { message: 'offline' } }; calls.uploads.push({ b, p }); return { error: null }; } }) } };
const doc = { getElementById: mk, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, createElement: () => mk('tmp' + Math.random()), body: { classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, appendChild() {} } };
const ctx = { document: doc, console: { log() {}, warn() {}, error() {} }, Intl, Date, Math, JSON, Promise, Map, Set, Uint8Array, Uint32Array, DataView, ArrayBuffer, TextEncoder, Blob, atob, setTimeout, clearTimeout, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    fetch: async (u, o) => { calls.fetches.push({ u, body: JSON.parse(o.body) }); return { ok: true, json: async () => ({ success: true }) }; } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.sessionStorage = { getItem() { return null; }, setItem() {}, removeItem() {} }; ctx.addEventListener = () => {}; ctx.scrollTo = () => {};
ctx.WoofAuth = { getClient: async () => client, requireStaff: async () => ({}), getAccessToken: async () => 'tok', getSession: async () => ({}), signOut: async () => {} };
ctx.SUPABASE_CONFIG = { supabaseUrl: 'x', supabaseAnonKey: 'x' };
vm.createContext(ctx);
for (const f of ['js/utils.js', 'js/xlsx-lite.js', 'js/app.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext('globalThis.POSApp=POSApp;', ctx);
ctx.ui.showToast = (m, t) => toasts.push({ m, t });
ctx.ui.confirm = async () => true;

(async () => {
    const app = new ctx.POSApp();
    await new Promise((r) => setTimeout(r, 50));
    app.saveCart = () => {}; app.renderCart = () => {}; app.closeCartSheet = () => {}; app.updateCustomerEmailFromComposer = () => {};
    app.generateInvoicePdfBase64 = async (d) => { app.lastPdfDetails = d; return 'QUJD'; };

    // ---- a sale with every new field filled in
    app.cart = [{ productId: 1, name: 'Tennis Ball Tag', price: 15, quantity: 2 }];
    mk('customer-email').value = 'a@b.co'; mk('customer-name').value = 'Jamie'; mk('pet-name').value = ' Mochi, Peanut ';
    mk('customer-address').value = 'Blk 1 Test Rd #02-03\nS123456'; mk('customer-comment').value = 'Front: MOCHI\nBack: 9123 4567';
    app.setRingColour('gun metal');
    app.orderPhotos = [{ blob: new Blob(['x']), url: 'blob:x' }];
    await app.sendOrderEmail();
    let row = calls.inserts[0] && calls.inserts[0].row;
    ok(row && row.customer_name === 'Jamie' && row.pet_name === 'Mochi, Peanut' && row.ring_colour === 'gun metal' && row.address === 'Blk 1 Test Rd #02-03\nS123456' && row.delivery_method === 'delivery',
        'order saved with owner, pet, ring colour, address, delivery method');
    ok(row.customer_comment === 'Front: MOCHI\nBack: 9123 4567', 'notes saved with their line breaks');
    ok(calls.uploads.some((u) => u.b === 'order-photos' && /^\d{4}-\d{2}-\d{2}\/001000-\d+-1\.jpg$/.test(u.p)), 'photo uploaded under the order number');
    const photoUpdate = calls.updates.find((u) => u.payload.photo_paths);
    ok(photoUpdate && photoUpdate.payload.photo_paths.length === 1 && Object.keys(photoUpdate.payload).length === 1, 'photo path written to the order, and nothing else');
    const sent = calls.fetches[0].body.order;
    ok(sent.petName === 'Mochi, Peanut' && sent.ringColour === 'Gun metal' && /Blk 1/.test(sent.address) && sent.customerComment.includes('\n'), 'email request carries the new fields');
    ok(app.lastPdfDetails.petName === 'Mochi, Peanut' && app.lastPdfDetails.customerName === 'Jamie', 'PDF gets the new fields');
    ok(toasts.at(-1).t === 'success', 'success toast after a full order', toasts.at(-1).m);
    ok(app.ringColour === '' && app.orderPhotos.length === 0 && mk('pet-name').value === '' && mk('customer-address').value === '' && mk('cart-panel').scrollTop === 0,
        'form is empty and the cart is back at the top for the next customer');

    // ---- pickup with nothing extra: blank fields stay empty, address is dropped
    app.cart = [{ productId: 1, name: 'Charms', price: 4, quantity: 1 }]; app.deliveryEnabled = false;
    mk('customer-email').value = 'c@d.co'; mk('customer-name').value = ''; mk('customer-address').value = 'left over from earlier';
    await app.sendOrderEmail();
    row = calls.inserts[1].row;
    ok(row.pet_name === null && row.ring_colour === null && row.address === null && row.delivery_method === 'pickup' && row.customer_name === '', 'pickup order: optional fields empty, no address kept');
    ok(app.lastPdfDetails.customerName === 'Customer', 'PDF falls back to "Customer" when no owner name is given');

    // ---- a failed photo upload never blocks the sale
    failPhotoUpload = true; app.deliveryEnabled = true;
    app.cart = [{ productId: 1, name: 'Charms', price: 4, quantity: 1 }]; mk('customer-email').value = 'e@f.co';
    app.orderPhotos = [{ blob: new Blob(['x']), url: 'blob:x' }];
    const before = calls.fetches.length;
    await app.sendOrderEmail(); failPhotoUpload = false;
    ok(calls.inserts.length === 3 && calls.fetches.length === before + 1 && toasts.at(-1).t === 'error' && /photo was not saved/.test(toasts.at(-1).m), 'photo upload failure: order saved, email sent, staff told');

    // ---- validation
    app.cart = []; mk('customer-email').value = 'x@y.co';
    ok(app.validateCheckout() === false && /Add an item/.test(toasts.at(-1).m), 'empty cart is refused');
    app.cart = [{ productId: 1, name: 'Charms', price: 4, quantity: 1 }]; mk('customer-email').value = '';
    ok(app.validateCheckout() === false && mk('customer-email-error').textContent === 'Enter the customer email address.' && mk('customer-email-local').getAttribute('aria-invalid') === 'true', 'missing email shows an inline error');
    mk('customer-email').value = 'ok@ok.co';
    ok(app.validateCheckout() === true && mk('customer-email-error').textContent === '', 'inline error clears when the email is valid');

    // ---- discount toggles
    app.discountApplied = false; app.applyDiscount(); const on = app.discountApplied; app.applyDiscount();
    ok(on === true && app.discountApplied === false, 'discount button switches the discount on and off');

    // ---- editing an order
    orders = [
        { id: 'a', order_id: '001000', customer_name: 'juan', customer_email: 'j@x.co', customer_phone: '9', customer_comment: 'Ramen\n\nblock 1', subtotal: 35, discount_amount: 1.75, delivery_fee: 2.5, total: 35.75, items: [{ name: 'Christmas Tag', price: 25, quantity: 1, subtotal: 25 }, { name: '3 Charms', price: 10, quantity: 1, subtotal: 10 }], pet_name: null, address: null, ring_colour: null, photo_paths: [], created_at: '2026-11-15T02:36:30Z' },
        { id: 'b', order_id: '5888', customer_name: 'Customer', customer_email: 'k@x.co', customer_phone: '', customer_comment: '', subtotal: 15, discount_amount: 0, delivery_fee: 0, total: 15, items: [{ name: 'Wavy Tag', price: 15, quantity: 1, subtotal: 15 }], pet_name: null, address: null, ring_colour: null, photo_paths: [], created_at: '2026-11-14T17:53:03Z' },
        { id: 'c', order_id: '1678', customer_name: 'old', customer_email: 'o@x.co', customer_phone: '', customer_comment: '', subtotal: 24, discount_amount: 0, delivery_fee: 0, total: 24, items: [{ name: 'Charms', price: 4, quantity: 1, subtotal: 4 }], created_at: '2026-04-08T08:43:55Z' }
    ];
    const loaded = await app.loadPurchases();
    app.renderPurchasesList(loaded);
    ok(loaded.length === 3 && app.allPurchases.length === 3, 'all orders load, old ones without the new columns included');
    const listHtml = mk('purchases-list').innerHTML;
    ok(/#001000/.test(listHtml) && /juan/.test(listHtml) && !/>Customer</.test(listHtml), 'list rows show the owner name, and hide the old "Customer" placeholder');
    calls.updates.length = 0;
    const updated = await app.savePurchaseEdits('a', { ownerName: 'Juan', petName: 'Ramen', ringColour: 'gold', address: 'block 1', notes: 'Ramen, back blank' });
    const sentCols = Object.keys(calls.updates[0].payload).sort().join();
    ok(sentCols === 'address,customer_comment,customer_name,pet_name,ring_colour', 'edit sends only the editable columns', sentCols);
    ok(updated.pet_name === 'Ramen' && updated.ring_colour === 'gold' && updated.total === 35.75 && updated.order_id === '001000' && updated.items.length === 2, 'edit keeps totals, items and order number');
    ok(app.purchaseCache.get('a').customer_comment === 'Ramen, back blank' && app.allPurchases.find((p) => p.id === 'a').pet_name === 'Ramen', 'list and open invoice see the edit');
    const bad = await app.savePurchaseEdits('a', { ownerName: 'Juan', petName: '', ringColour: 'purple', address: '', notes: '' });
    ok(bad.ring_colour === null && bad.pet_name === null, 'an unknown ring colour is never saved');
    app.renderPurchaseDetails(app.purchaseCache.get('a'));
    const det = mk('purchase-details').innerHTML;
    ok(/purchase-edit-btn/.test(det) && /Owner name/.test(det) && /Colour of ring/.test(det) && /Delivery address/.test(det) && /Edited/.test(det), 'invoice view shows the new fields, Edit button and edited stamp');
    app.renderPurchaseDetails(app.purchaseCache.get('a'), { editing: true });
    ok(/id="edit-notes"/.test(mk('purchase-details').innerHTML) && /purchase-edit-save/.test(mk('purchase-details').innerHTML), 'edit mode shows the form');

    // ---- search
    app.purchaseSearch = 'wavy';
    ok(app.filteredPurchases().length === 1 && app.filteredPurchases()[0].order_id === '5888', 'search matches item names');
    app.purchaseSearch = '';

    // ---- export
    await app.savePurchaseEdits('a', { ownerName: 'Juan', petName: 'Ramen', ringColour: 'gun metal', address: 'block 1\nS520001', notes: 'Ramen\nback blank' });
    ok(app.invoiceFolderFor('2026-11-14T17:53:03Z') === '2026-11-15', 'an order at 1:53am Singapore time counts as the 15th');
    const day = app.purchasesInRange({ from: '2026-11-15', to: '2026-11-15' });
    ok(day.length === 2 && day[0].order_id === '5888' && day[1].order_id === '001000', 'date range uses Singapore dates, oldest first');
    ok(app.purchasesInRange({ from: null, to: null }).length === 3, '"All" exports every order');
    const b = app.exportRangeBounds('custom', '2026-11-20', '2026-11-01');
    ok(b.from === '2026-11-01' && b.to === '2026-11-20', 'reversed custom dates are put the right way round');
    const week = app.exportRangeBounds('week');
    ok(/^\d{4}-\d{2}-\d{2}$/.test(week.from) && week.from <= week.to && new Date(week.from + 'T12:00:00Z').getUTCDay() === 1, '"This week" starts on Monday', week.from);

    const both = app.buildExportSheets(app.purchasesInRange({ from: null, to: null }), 'both');
    ok(both.length === 2 && both[0].name === 'Invoices' && both[1].name === 'Items', 'layout "both" gives two sheets');
    const headers = both[0].columns.map((c) => c.header).join('|');
    ok(headers === "Order no.|Date|Time|Owner name|Pet's name|Colour of ring|Phone|Email|Address|Items|Qty|Subtotal|Discount|Delivery|Total|Notes|Photos", 'invoice columns', headers);
    const r = both[0].rows.find((x) => x[0] === '001000');
    ok(r[3] === 'Juan' && r[4] === 'Ramen' && r[5] === 'Gun metal' && r[8] === 'block 1\nS520001' && r[9] === '1 x Christmas Tag\n1 x 3 Charms' && r[10] === 2 && r[14] === 35.75 && r[15] === 'Ramen\nback blank', 'invoice row filled from the order');
    ok(r[1] === 46341 && Math.abs(r[2] - (10 * 60 + 36) / 1440) < 1e-9, 'date and time are real Excel values in Singapore time (15 Nov 2026, 10:36)', `${r[1]} ${r[2]}`);
    const old = both[0].rows.find((x) => x[0] === '1678');
    ok(old[4] === '' && old[5] === '' && old[8] === '' && old[16] === 0, 'old orders export with the new columns blank');
    ok(both[0].rows.find((x) => x[0] === '5888')[3] === '', 'the "Customer" placeholder exports as a blank owner name');
    ok(both[1].rows.length === 4 && both[1].rows.filter((x) => x[0] === '001000').length === 2, 'items sheet has one row per item');
    ok(app.buildExportSheets(loaded, 'orders').length === 1 && app.buildExportSheets(loaded, 'items')[0].name === 'Items', 'single layouts give one sheet');
    const parts = ctx.XlsxLite.buildParts(both);
    const bytes = Buffer.concat(parts.map((p) => Buffer.from(p)));
    ok(bytes.slice(0, 2).toString() === 'PK' && bytes.includes(Buffer.from('xl/worksheets/sheet2.xml')) && bytes.includes(Buffer.from('SUM(O2:O4)')), 'workbook is a zip with both sheets and a totals formula');
    if (process.env.EXPORT_SAMPLE) fs.writeFileSync(process.env.EXPORT_SAMPLE, bytes);

    // ---- invoice email (api/send-invoice.js) with the mail server and sign-in check stubbed
    let mail = null;
    const realLoad = Module._load;
    Module._load = function (request, ...rest) {
        if (request === 'nodemailer') return { createTransport: () => ({ sendMail: async (m) => { mail = m; return { messageId: 'test' }; } }) };
        return realLoad.call(this, request, ...rest);
    };
    process.env.GMAIL_USER = 'shop@example.com'; process.env.GMAIL_APP_PASSWORD = 'x';
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co'; process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon';
    global.fetch = async () => ({ ok: true, json: async () => ({ app_metadata: { role: 'pos_staff' } }) });
    const handler = require(path.join(root, 'api/send-invoice.js'));
    Module._load = realLoad;
    const longNote = 'Front: MOCHI\nBack: 9123 4567\n\n\n\nBlue base, white words. ' + 'x'.repeat(200);
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer tok' }, body: {
        pdfBase64: Buffer.from('%PDF-1.4 ' + 'x'.repeat(1500)).toString('base64'), customerEmail: 'a@b.co', customerName: 'Jamie', purchaseDate: '2026-11-15T02:36:30Z', invoiceNumber: '001000', fileName: 'WoofCrafts_Order_001000.pdf',
        order: { items: [{ name: 'Tag', quantity: 1, price: 15, subtotal: 15 }], subtotal: 15, discountAmount: 0, deliveryFee: 2.5, deliveryMethod: 'delivery', total: 17.5,
            customerComment: longNote, petName: 'Mochi <b>', ringColour: 'Gun metal', address: 'Blk 1 Test Rd #02-03\nS123456' } } }, res);
    const result = res.body ? JSON.parse(res.body) : {};
    ok(res.statusCode === 200 && result.success === true && mail, 'invoice email handler accepts the new fields', res.body);
    if (mail) {
        ok(mail.text.includes("Pet's name: Mochi <b>") && mail.text.includes('Colour of ring: Gun metal') && mail.text.includes('Delivery address: Blk 1 Test Rd #02-03, S123456'), 'plain-text email lists pet, ring colour and address');
        ok(mail.text.includes('Front: MOCHI\nBack: 9123 4567\n\nBlue base') && mail.text.includes('x'.repeat(200)), 'email keeps the whole note with its line breaks (no 120-character cut)');
        ok(mail.html.includes('Mochi &lt;b&gt;') && !mail.html.includes('Mochi <b>') && mail.html.includes('Front: MOCHI<br>Back: 9123 4567'), 'HTML email escapes text and keeps line breaks');
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
