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
        addEventListener() {}, focus() {}, showModal() { this.open = true; }, close() { this.open = false; }, open: false, setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; }, removeAttribute(k) { delete attrs[k]; },
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

    // ---- a delivery sale with two tags, every field filled in
    app.cart = [{ productId: 1, name: 'Tennis Ball Tag', price: 15, quantity: 2, needsDetails: true, tags: [
        { pet: ' Mochi ', ring: 'gun metal', front: 'MOCHI', back: '9123 4567' },
        { pet: 'Peanut', ring: 'gun metal', front: 'PEANUT', back: '9123 4567' }] }];
    app.setFulfilment('delivery'); app.setPaymentMethod('paynow');
    mk('customer-email').value = 'a@b.co'; mk('customer-name').value = 'Jamie'; mk('customer-phone').value = '9123 4567';
    mk('customer-address').value = 'Blk 1 Test Rd #02-03\nS123456'; mk('customer-comment').value = 'Gift wrap please';
    app.orderPhotos = [{ blob: new Blob(['x']), url: 'blob:x' }];
    await app.sendOrderEmail();
    let row = calls.inserts[0] && calls.inserts[0].row;
    ok(row && row.customer_name === 'Jamie' && row.pet_name === 'Mochi, Peanut' && row.ring_colour === 'gun metal' && row.address === 'Blk 1 Test Rd #02-03\nS123456' && row.delivery_method === 'delivery',
        'order saved with owner, pets from the tags, common ring colour, address, delivery method');
    ok(row.fulfilment === 'delivery' && row.payment_method === 'paynow' && row.status === 'to_make', 'delivery order with tags starts as To make, paid by PayNow');
    ok(Array.isArray(row.tags) && row.tags.length === 2 && row.tags[0].pet_name === 'Mochi' && row.tags[0].front === 'MOCHI' && row.tags[1].back === '9123 4567' && row.tags.every((t) => t.made === false && t.item === 'Tennis Ball Tag'), 'one saved entry per tag: pet, ring, front, back');
    ok(row.items.length === 1 && row.items[0].quantity === 2 && row.items[0].subtotal === 30 && !('tags' in row.items[0]), 'items and prices are saved as before, without the tag details');
    ok(row.customer_comment === 'Gift wrap please', 'notes saved separately from engraving text');
    ok(calls.uploads.some((u) => u.b === 'order-photos' && /^\d{4}-\d{2}-\d{2}\/001000-\d+-1\.jpg$/.test(u.p)), 'photo uploaded under the order number');
    const photoUpdate = calls.updates.find((u) => u.payload.photo_paths);
    ok(photoUpdate && photoUpdate.payload.photo_paths.length === 1 && Object.keys(photoUpdate.payload).length === 1, 'photo path written to the order, and nothing else');
    const sent = calls.fetches[0].body.order;
    ok(sent.petName === 'Mochi, Peanut' && sent.paymentMethod === 'PayNow' && sent.fulfilment === 'Delivery' && sent.tags.length === 2 && sent.tags[1].front === 'PEANUT' && /Blk 1/.test(sent.address), 'email request carries how, payment and each tag');
    ok(app.lastPdfDetails.petName === 'Mochi, Peanut' && app.lastPdfDetails.customerName === 'Jamie' && app.lastPdfDetails.tags.length === 2 && app.lastPdfDetails.fulfilment === 'delivery', 'PDF gets the tags, how and payment');
    ok(/Order #001000 saved/.test(mk('order-done-body').innerHTML) && /Invoice emailed to a@b\.co/.test(mk('order-done-body').innerHTML) && !/order-done-share/.test(mk('order-done-body').innerHTML), 'saved screen: order number, email sent, no Share button when emailed');
    ok(app.orderPhotos.length === 0 && mk('customer-address').value === '' && mk('cart-panel').scrollTop === 0 && app.fulfilmentTouched === false && app.paymentMethod === '',
        'form is empty and the cart is back at the top for the next customer');

    // ---- charms handed over at the booth: no name, phone or email needed, nothing emailed
    const fetchesBefore = calls.fetches.length;
    app.cart = [{ productId: 2, name: 'Charms', price: 4, quantity: 1, needsDetails: false, tags: [] }];
    mk('customer-email').value = ''; mk('customer-name').value = ''; mk('customer-phone').value = ''; mk('customer-address').value = 'left over from earlier';
    app.setFulfilment('taken_now'); app.setPaymentMethod('cash');
    await app.sendOrderEmail();
    row = calls.inserts[1].row;
    ok(row.fulfilment === 'taken_now' && row.status === 'collected' && row.payment_method === 'cash' && row.delivery_method === 'pickup' && row.delivery_fee === 0, 'taken-now charm order: collected straight away, cash, no delivery fee');
    ok(row.pet_name === null && row.ring_colour === null && row.address === null && row.customer_name === '' && row.customer_email === '' && row.tags.length === 0, 'optional fields stay empty and no address is kept');
    ok(calls.fetches.length === fetchesBefore, 'no email is sent when there is no email address');
    ok(app.lastPdfDetails.customerName === 'Customer', 'PDF falls back to "Customer" when no owner name is given');
    ok(/Order #001001 saved/.test(mk('order-done-body').innerHTML) && /No email given/.test(mk('order-done-body').innerHTML) && /order-done-share/.test(mk('order-done-body').innerHTML), 'saved screen offers Share invoice when there is no email');
    ok(app.lastInvoice && app.lastInvoice.orderId === '001001' && app.lastInvoice.pdfBase64 === 'QUJD', 'the invoice PDF is kept ready to share');

    // ---- delivery tag order, no tags filled in: still made-to-order
    app.cart = [{ productId: 1, name: 'Daisy Tag', price: 15, quantity: 1, needsDetails: true, tags: [{ pet: '', ring: '', front: '', back: '' }] }];
    app.setFulfilment('delivery'); app.setPaymentMethod('cash'); mk('customer-name').value = 'Lee'; mk('customer-phone').value = '81234567'; mk('customer-email').value = '';
    await app.sendOrderEmail();
    row = calls.inserts[2].row;
    ok(row.fulfilment === 'delivery' && row.status === 'to_make' && row.tags.length === 1 && row.pet_name === null, 'delivery tag order: To make');

    // ---- a charm for delivery needs no making, so it starts as Made
    app.cart = [{ productId: 2, name: 'Charms', price: 4, quantity: 1, needsDetails: false, tags: [] }];
    app.setFulfilment('delivery'); app.setPaymentMethod('paynow'); mk('customer-name').value = 'Kai'; mk('customer-phone').value = '81234567'; mk('customer-address').value = 'Blk 2'; mk('customer-email').value = 'k@k.co';
    await app.sendOrderEmail();
    ok(calls.inserts[3].row.status === 'made' && calls.inserts[3].row.delivery_fee === 2.5, 'delivery of charms only: Made (ready to post), fee charged');

    // ---- a failed photo upload never blocks the sale
    failPhotoUpload = true;
    app.cart = [{ productId: 2, name: 'Charms', price: 4, quantity: 1, needsDetails: false, tags: [] }];
    app.setFulfilment('delivery'); app.setPaymentMethod('cash'); mk('customer-name').value = 'Kai'; mk('customer-phone').value = '81234567'; mk('customer-address').value = 'Blk 2'; mk('customer-email').value = 'e@f.co';
    app.orderPhotos = [{ blob: new Blob(['x']), url: 'blob:x' }];
    const before = calls.fetches.length;
    await app.sendOrderEmail(); failPhotoUpload = false;
    ok(calls.inserts.length === 5 && calls.fetches.length === before + 1 && /Photo not saved/.test(mk('order-done-body').innerHTML), 'photo upload failure: order saved, email sent, staff told');

    // ---- validation
    app.cart = []; app.setPaymentMethod('cash');
    ok(app.validateCheckout() === false && /Add an item/.test(toasts.at(-1).m), 'empty cart is refused');
    app.cart = [{ productId: 2, name: 'Charms', price: 4, quantity: 1, needsDetails: false, tags: [] }];
    mk('customer-email').value = ''; mk('customer-name').value = ''; mk('customer-phone').value = '';
    app.setFulfilment('taken_now'); app.setPaymentMethod('');
    ok(app.validateCheckout() === false && !mk('payment-error').classList.contains('hidden') && mk('payment-error').textContent === 'Choose PayNow or Cash.', 'payment must be chosen');
    app.setPaymentMethod('cash');
    ok(app.validateCheckout() === true, 'taken now needs only a payment method: no name, phone or email');
    app.setFulfilment('collect');
    ok(app.validateCheckout() === false && mk('customer-name-error').textContent === 'Enter the owner name.' && mk('customer-phone-error').textContent !== '' && mk('customer-name').getAttribute('aria-invalid') === 'true', 'collect at booth needs owner name and phone, shown inline');
    mk('customer-name').value = 'Lee'; mk('customer-phone').value = '123';
    ok(app.validateCheckout() === false && /full phone/.test(mk('customer-phone-error').textContent), 'a too-short phone number is refused');
    mk('customer-phone').value = '+65 8123 4567';
    ok(app.validateCheckout() === true && mk('customer-phone-error').textContent === '', 'a valid phone number passes and the error clears');
    mk('customer-email').value = 'not-an-email';
    ok(app.validateCheckout() === false && mk('customer-email-error').textContent !== '' && mk('customer-email-local').getAttribute('aria-invalid') === 'true', 'an email that is typed must be valid');
    mk('customer-email').value = 'ok@ok.co';
    ok(app.validateCheckout() === true && mk('customer-email-error').textContent === '', 'inline email error clears when the email is valid');
    app.setFulfilment('delivery'); mk('customer-address').value = '';
    const asked = []; ctx.ui.confirm = async (m, ti) => { asked.push(ti); return false; };
    const insBefore = calls.inserts.length; await app.sendOrderEmail();
    ok(asked.length === 1 && /address/i.test(asked[0]) && calls.inserts.length === insBefore, 'delivery with no address asks first, and saves nothing if staff say no');
    ctx.ui.confirm = async () => true;

    // ---- the form follows the cart
    app.fulfilmentTouched = false; app.cart = [{ productId: 1, name: 'Daisy Tag', price: 15, quantity: 1, needsDetails: true, tags: [{ pet: '', ring: '', front: '', back: '' }] }];
    app.afterCartChange(); ok(app.fulfilment === 'taken_now', 'a cart with tags defaults to Taken now (Collect at booth is gone)');
    ok(!/data-fulfilment="collect"/.test(require('fs').readFileSync(path.join(root, 'pos.html'), 'utf8')), 'the order form no longer offers Collect at booth');
    ok(app.fulfilmentLabel('collect') === 'Collect at booth', 'old orders saved as Collect at booth keep their label');
    app.cart = [{ productId: 2, name: 'Charms', price: 4, quantity: 1, needsDetails: false, tags: [] }];
    app.afterCartChange(); ok(app.fulfilment === 'taken_now', 'a charms-only cart defaults to Taken now');
    app.setFulfilment('delivery', true); app.afterCartChange(); ok(app.fulfilment === 'delivery', 'once staff choose, the cart stops choosing for them');
    app.products = [{ id: 9, name: 'Star Tag', price: 10, needsDetails: true }, { id: 8, name: 'Charm', price: 4, needsDetails: false }];
    app.cart = [{ productId: 9, name: 'Star Tag', price: 10, quantity: 3 }, { productId: 8, name: 'Charm', price: 4, quantity: 2 }];
    app.syncCartTags();
    ok(app.cart[0].tags.length === 3 && app.cart[1].tags.length === 0 && app.cart[0].needsDetails === true, 'one engraving card per tag, none for charms (also for a cart saved before this update)');
    app.cart[0].quantity = 1; app.syncCartTags(); ok(app.cart[0].tags.length === 1, 'removing a tag removes its card');
    app.cart[0].tags[0].pet = 'Mo'; app.cart[0].tags[0].ring = 'gold'; app.cart[0].quantity = 2; app.syncCartTags();
    ok(app.cart[0].tags.length === 2 && app.cart[0].tags[0].pet === 'Mo' && app.cart[0].tags[1].pet === '', 'adding a tag keeps what was already typed');
    app.renderTagDetails(); const cardsHtml = mk('tag-details').innerHTML;
    ok((cardsHtml.match(/class="tag-card"/g) || []).length === 2 && /Same as tag above/.test(cardsHtml) && /\(2 of 2\)/.test(cardsHtml) && !/Charm/.test(cardsHtml), 'tag cards: one per tag, "Same as tag above" from the second, no card for charms');
    app.cart = [];

    // ---- discount toggles
    app.cart = [{ productId: 2, name: 'Charms', price: 4, quantity: 1, needsDetails: false, tags: [] }];
    app.discountApplied = false; app.applyDiscount(); const on = app.discountApplied; app.applyDiscount();
    ok(on === true && app.discountApplied === false, 'discount button switches the discount on and off'); app.cart = [];

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
    ok(headers === "Order no.|Date|Time|Status|How|Payment|Owner name|Pet's name|Colour of ring|Engraving (front / back)|Phone|Email|Address|Items|Qty|Subtotal|Discount|Delivery|Total|Notes|Photos", 'invoice columns', headers);
    const r = both[0].rows.find((x) => x[0] === '001000');
    ok(r[6] === 'Juan' && r[7] === 'Ramen' && r[8] === 'Gun metal' && r[12] === 'block 1\nS520001' && r[13] === '1 x Christmas Tag\n1 x 3 Charms' && r[14] === 2 && r[18] === 35.75 && r[19] === 'Ramen\nback blank' && r[3] === '' && r[4] === '', 'invoice row filled from the order (old order: status and how blank)');
    ok(r[1] === 46341 && Math.abs(r[2] - (10 * 60 + 36) / 1440) < 1e-9, 'date and time are real Excel values in Singapore time (15 Nov 2026, 10:36)', `${r[1]} ${r[2]}`);
    const old = both[0].rows.find((x) => x[0] === '1678');
    ok(old[3] === '' && old[4] === '' && old[5] === '' && old[7] === '' && old[8] === '' && old[12] === '' && old[20] === 0, 'old orders export with the new columns blank');
    ok(both[0].rows.find((x) => x[0] === '5888')[6] === '', 'the "Customer" placeholder exports as a blank owner name');
    ok(both[1].rows.length === 4 && both[1].rows.filter((x) => x[0] === '001000').length === 2, 'items sheet has one row per item');
    ok(app.buildExportSheets(loaded, 'orders').length === 1 && app.buildExportSheets(loaded, 'items')[0].name === 'Items', 'single layouts give one sheet');
    const parts = ctx.XlsxLite.buildParts(both);
    const bytes = Buffer.concat(parts.map((p) => Buffer.from(p)));
    ok(bytes.slice(0, 2).toString() === 'PK' && bytes.includes(Buffer.from('xl/worksheets/sheet2.xml')) && bytes.includes(Buffer.from('SUM(S2:S4)')), 'workbook is a zip with both sheets and a totals formula');
    if (process.env.EXPORT_SAMPLE) fs.writeFileSync(process.env.EXPORT_SAMPLE, bytes);

    // ---- order status: To make -> Made -> Collected / Posted, tag ticks, void
    const tagOrder = { id: 't1', order_id: '001100', customer_name: 'Mei', customer_phone: '8123 4567', customer_email: '', customer_comment: '', subtotal: 30, discount_amount: 0, delivery_fee: 0, total: 30,
        items: [{ name: 'Daisy Tag', price: 15, quantity: 2, subtotal: 30 }], fulfilment: 'collect', delivery_method: 'pickup', payment_method: 'paynow', status: 'to_make', photo_paths: [],
        tags: [{ item: 'Daisy Tag', number: 1, of: 2, pet_name: 'Milo', ring_colour: 'gold', front: 'MILO', back: '8123', made: false }, { item: 'Daisy Tag', number: 2, of: 2, pet_name: 'Luna', ring_colour: 'silver', front: 'LUNA', back: '8123', made: false }],
        pet_name: 'Milo, Luna', ring_colour: null, created_at: new Date().toISOString() };
    const charmOrder = { id: 't2', order_id: '001101', customer_name: '', customer_phone: '', customer_comment: '', subtotal: 4, discount_amount: 0, delivery_fee: 0, total: 4, items: [{ name: 'Charms', price: 4, quantity: 1, subtotal: 4 }],
        fulfilment: 'taken_now', delivery_method: 'pickup', payment_method: 'cash', status: 'collected', tags: [], photo_paths: [], created_at: new Date().toISOString() };
    const postOrder = { id: 't3', order_id: '001102', customer_name: 'Ann', customer_phone: '91112222', customer_comment: '', subtotal: 15, discount_amount: 0, delivery_fee: 2.5, total: 17.5, items: [{ name: 'Cloud Tag', price: 15, quantity: 1, subtotal: 15 }],
        fulfilment: 'delivery', delivery_method: 'delivery', payment_method: 'paynow', status: 'made', tags: [{ item: 'Cloud Tag', number: 1, of: 1, pet_name: 'Bo', ring_colour: 'gold', front: 'BO', back: '', made: true }], photo_paths: [], created_at: new Date().toISOString() };
    orders = [tagOrder, charmOrder, postOrder, ...orders.filter((o) => !['t1', 't2', 't3'].includes(o.id))];
    app.statusFilter = 'all'; app.renderPurchasesList(await app.loadPurchases());
    ok(app.nextStatusFor(tagOrder) === 'made' && app.nextStatusFor({ ...tagOrder, status: 'made' }) === 'collected' && app.nextStatusFor(postOrder) === 'posted' && app.nextStatusFor(charmOrder) === null && app.nextStatusFor({ id: 'x', status: null }) === null,
        'next step: To make -> Made -> Collected (booth) or Posted (delivery); done and old orders have none');
    ok(mk('purchases-badge').textContent === '1' && !mk('purchases-badge').classList.contains('hidden'), 'Purchases tab badge counts orders still to make');
    ok(/status-to_make/.test(mk('purchases-list').innerHTML) && /status-collected/.test(mk('purchases-list').innerHTML), 'list rows show status chips');
    ok(/Sales today/.test(mk('purchases-summary').innerHTML) && /\$51\.50/.test(mk('purchases-summary').innerHTML) && /PayNow \$47\.50 · Cash \$4\.00/.test(mk('purchases-summary').innerHTML), "today's summary: sales, orders, PayNow vs cash", mk('purchases-summary').innerHTML.replace(/\s+/g, ' ').slice(0, 300));
    ok(/Tags to make<\/span><strong>2<\/strong>/.test(mk('purchases-summary').innerHTML), 'summary counts tags still to make');
    app.statusFilter = 'to_make'; ok(app.filteredPurchases().length === 1 && app.filteredPurchases()[0].order_id === '001100', 'filter: To make');
    app.statusFilter = 'done'; ok(app.filteredPurchases().length === 1 && app.filteredPurchases()[0].order_id === '001101', 'filter: Done = collected or posted');
    app.statusFilter = 'all'; app.purchaseSearch = 'luna'; ok(app.filteredPurchases().length === 1, 'search finds a pet name inside a tag'); app.purchaseSearch = '';

    calls.updates.length = 0;
    await app.setTagMade('t1', 0, true);
    ok(app.purchaseCache.get('t1').status === 'to_make' && app.purchaseCache.get('t1').tags[0].made === true && calls.updates.at(-1).payload.status === undefined, 'ticking one of two tags keeps the order To make');
    await app.setTagMade('t1', 1, true);
    ok(app.purchaseCache.get('t1').status === 'made' && calls.updates.at(-1).payload.status === 'made', 'ticking the last tag makes the order Made');
    await app.setTagMade('t1', 0, false);
    ok(app.purchaseCache.get('t1').status === 'to_make', 'unticking a tag puts the order back to To make');
    ok(Object.keys(calls.updates.at(-1).payload).sort().join() === 'status,tags', 'tag ticks send only tags and status');
    await app.setTagMade('t1', 0, true);
    await app.changeStatus('t1', 'collected');
    ok(app.purchaseCache.get('t1').status === 'collected' && /Collected/.test(toasts.at(-1).m), 'moving to Collected saves and confirms');
    ok(Object.keys(calls.updates.at(-1).payload).join() === 'status', 'a status change sends only the status');

    app.renderPurchaseDetails(app.purchaseCache.get('t3'));
    let d3 = mk('purchase-details').innerHTML;
    ok(/id="status-advance"[^>]*data-next="posted"/.test(d3) && /Mark as posted/.test(d3) && /Tags <span/.test(d3) && /1 of 1 made/.test(d3) && /Front: BO/.test(d3) && !/ready-link/.test(d3), 'delivery order that is Made offers "Mark as posted" and no WhatsApp message');
    app.renderPurchaseDetails({ ...tagOrder, status: 'made', id: 't1' });
    const d1 = mk('purchase-details').innerHTML;
    ok(/wa\.me\/6581234567\?text=/.test(d1) && /ready for collection/.test(decodeURIComponent(d1)) && /Mark as collected/.test(d1), 'booth order that is Made: WhatsApp message to +65 number and "Mark as collected"');
    ok(app.whatsappReadyLink({ customer_phone: '123' }) === '' && app.whatsappReadyLink({ customer_phone: '+44 7700 900123', order_id: '1' }).includes('wa.me/447700900123'), 'WhatsApp link only with a real phone; foreign numbers are kept as typed');
    app.renderPurchaseDetails(app.purchaseCache.get('t1'), { editing: true });
    const ed = mk('purchase-details').innerHTML;
    ok((ed.match(/class="tag-card edit-tag"/g) || []).length === 2 && /edit-payment/.test(ed) && !/id="edit-pet-name"/.test(ed), 'edit mode: one editor per tag plus payment; no single pet field');
    const edited = await app.savePurchaseEdits('t1', { ownerName: 'Mei', petName: '', ringColour: '', address: '', notes: '', paymentMethod: 'cash',
        tags: [{ pet_name: 'Milo', ring_colour: 'gold', front: 'MILO!', back: '8123' }, { pet_name: 'Luna', ring_colour: 'gold', front: 'LUNA', back: '8123' }] });
    ok(edited.tags[0].front === 'MILO!' && edited.tags[0].made === true && edited.ring_colour === 'gold' && edited.pet_name === 'Milo, Luna' && edited.payment_method === 'cash' && edited.total === 30, 'editing tags keeps the made ticks, updates the pet and ring summary, never the money');

    await app.changeStatus('t2', 'void', { void_reason: 'test order' });
    const v = app.purchaseCache.get('t2');
    ok(v.status === 'void' && v.void_reason === 'test order' && v.order_id === '001101' && v.total === 4 && v.items.length === 1, 'void keeps the order, items and total, and records the reason');
    ok(calls.updates.at(-1).filters[0][1] === 't2' && !calls.updates.some((u) => u.payload.total !== undefined), 'void never touches the money');
    app.renderPurchasesList();
    ok(/is-void/.test(mk('purchases-list').innerHTML) && /status-void/.test(mk('purchases-list').innerHTML), 'void orders stay in the list, greyed out');
    const sumAfter = mk('purchases-summary').innerHTML;
    ok(/Sales today<\/span><strong>\$47\.50/.test(sumAfter), 'voided orders are left out of the day total', sumAfter.replace(/\s+/g, ' ').slice(0, 200));
    app.renderPurchaseDetails(app.purchaseCache.get('t2'), { voiding: true });
    ok(/id="void-confirm"/.test(mk('purchase-details').innerHTML) && /stay in your records/.test(mk('purchase-details').innerHTML), 'void asks for a reason and says nothing is deleted');

    app.showMakeList();
    ok(/Nothing to make right now/.test(mk('purchase-details').innerHTML), 'make list is empty when every tag is made');
    orders.find((o) => o.id === 't1').status = 'to_make'; orders.find((o) => o.id === 't1').tags.forEach((x) => { x.made = false; });
    app.renderPurchasesList(await app.loadPurchases()); app.showMakeList();
    const ml2 = mk('purchase-details').innerHTML;
    ok(/MILO!/.test(ml2) && /LUNA/.test(ml2) && /data-tag-index="1"/.test(ml2) && /2 tags in 1 order/.test(ml2), 'make list shows each tag to make, front and back, with a Made button', ml2.replace(/\s+/g, ' ').slice(0, 200));
    app.purchasesView = 'invoice';

    // ---- export of status, tags and void
    const ex = app.buildExportSheets(app.purchasesInRange({ from: null, to: null }), 'both');
    const inv = ex[0].rows.find((x) => x[0] === '001100');
    ok(inv[3] === 'To make' && inv[4] === 'Collect at booth' && inv[5] === 'Cash' && inv[9] === 'Milo: MILO! / 8123\nLuna: LUNA / 8123', 'invoices sheet: status, how, payment and engraving');
    const voidRow = ex[0].rows.find((x) => x[0] === '001101');
    ok(voidRow[3] === 'Void' && voidRow[14] === 0 && voidRow[15] === 0 && voidRow[18] === 0 && /VOID: test order \(original total \$4\.00\)/.test(voidRow[19]), 'voided order stays in the file with zero amounts and the original total in Notes');
    const tagRows = ex[1].rows.filter((x) => x[0] === '001100');
    ok(tagRows.length === 2 && tagRows[0][6] === 'Milo' && tagRows[0][7] === 'Gold' && tagRows[0][8] === 'MILO!' && tagRows[1][9] === '8123' && tagRows[0][10] === 1 && tagRows[0][12] === 15, 'items sheet: one row per tag with pet, ring, front, back');
    ok(ex[1].columns.length === ex[1].rows[0].length && ex[0].columns.length === ex[0].rows[0].length && ex[0].totals.length === ex[0].columns.length && ex[1].totals.length === ex[1].columns.length, 'sheet rows, columns and totals line up');
    const oldRows = ex[1].rows.filter((x) => x[0] === '1678');
    ok(oldRows.length === 1 && oldRows[0][2] === '' && oldRows[0][6] === '' && oldRows[0][10] === 1, 'old orders still export as one row per item');
    const wb = Buffer.concat(ctx.XlsxLite.buildParts(ex).map((p) => Buffer.from(p)));
    ok(wb.slice(0, 2).toString() === 'PK' && wb.includes(Buffer.from('SUM(S2:S')), 'workbook with the new columns builds');

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
            customerComment: longNote, petName: 'Mochi <b>', ringColour: 'Gun metal', address: 'Blk 1 Test Rd #02-03\nS123456', fulfilment: 'Delivery', paymentMethod: 'PayNow',
            tags: [{ item: 'Tag', number: 1, of: 2, petName: 'Mochi <b>', ringColour: 'Gold', front: 'MOCHI', back: '9123' }, { item: 'Tag', number: 2, of: 2, petName: 'Peanut', ringColour: 'Gold', front: 'PEANUT', back: '' }] } } }, res);
    const result = res.body ? JSON.parse(res.body) : {};
    ok(res.statusCode === 200 && result.success === true && mail, 'invoice email handler accepts the new fields', res.body);
    if (mail) {
        ok(mail.text.includes('How: Delivery') && mail.text.includes('Payment: PayNow') && mail.text.includes('Delivery address: Blk 1 Test Rd #02-03, S123456'), 'plain-text email lists how, payment and address');
        ok(mail.text.includes('Engraving details:') && mail.text.includes('Tag (1/2): Mochi <b> | Gold ring | Front: MOCHI | Back: 9123') && mail.text.includes('Tag (2/2): Peanut | Gold ring | Front: PEANUT') && !mail.text.includes("Pet's name:"), 'plain-text email lists each tag instead of one pet and ring');
        ok(mail.text.includes('Front: MOCHI\nBack: 9123 4567\n\nBlue base') && mail.text.includes('x'.repeat(200)), 'email keeps the whole note with its line breaks (no 120-character cut)');
        ok(mail.html.includes('Mochi &lt;b&gt;') && !mail.html.includes('Mochi <b>') && mail.html.includes('Front: MOCHI<br>Back: 9123 4567') && mail.html.includes('ENGRAVING DETAILS'), 'HTML email escapes text, keeps line breaks and lists the tags');
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
