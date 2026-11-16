// WoofCrafts POS System - Main Application Logic
// Requires js/utils.js (escapeHtml, safeImageSrc, PLACEHOLDER_IMAGE, PLACEHOLDER_THUMB)

class POSApp {
    constructor() {
        this.cart = [];
        this.discountApplied = false;
        this.products = [];
        this.supabaseClientPromise = null;
        this.purchaseCache = new Map();
        this.purchasesLoaded = false;
        this.lastPurchasesSource = 'unknown'; // 'supabase' | 'local'
        this.loadError = null;
        this.activeCategory = 'all';
        this.deliveryEnabled = false;  // true only when "Delivery" is chosen; set by setFulfilment()
        this.FREE_DELIVERY_MIN = 50;   // SGD, measured after any discount
        this.DELIVERY_FEE = 2.5;       // SGD
        this.fulfilment = 'collect';   // 'taken_now' | 'collect' | 'delivery'
        this.fulfilmentTouched = false; // true once staff pick a button, so the cart stops choosing for them
        this.paymentMethod = '';       // '', 'paynow' or 'cash'
        this.lastInvoice = null;       // most recent invoice PDF, for the Share button on the saved screen
        this.orderPhotos = [];         // optional photos for the order being taken: { blob, url }
        this.MAX_ORDER_PHOTOS = 3;
        this.allPurchases = [];
        this.selectedPurchaseId = null;
        this.purchaseSearch = '';
        this.editingPurchase = false;
        this.statusFilter = 'all';     // 'all' | 'to_make' | 'made' | 'done'
        this.purchasesView = 'invoice'; // 'invoice' | 'makelist'
        
        this.init();
    }

    async init() {
        // Staff must be signed in with Supabase Auth
        const session = await window.WoofAuth.requireStaff();
        if (!session) return;
        
        try {
            await this.loadProducts();
            if (!Array.isArray(this.products)) this.products = [];
            
            this.loadCart();
            console.log(`✓ Successfully loaded ${this.products.length} products`);
            this.renderProducts();
            this.renderCart();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing POS:', error);
            this.products = [];
            this.renderProducts();
            this.renderCart();
            this.setupEventListeners();
        }
    }

    async loadProducts() {
        const supabaseClient = await this.getSupabaseClient();
        if (supabaseClient) {
            try {
                const config = this.getSupabaseConfig();
                const tableName = config.supabaseProductsTable || 'products';

                const { data, error } = await supabaseClient
                    .from(tableName)
                    .select('id,title,description,price,category,image_url,created_at,needs_details')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                this.loadError = null;

                if (Array.isArray(data) && data.length > 0) {
                    this.products = data.map((row) => {
                        return {
                            id: row.id,
                            name: row.title,
                            description: row.description || '',
                            price: Number(row.price),
                            category: (row.category || 'general'),
                            image: row.image_url || '',
                            needsDetails: typeof row.needs_details === 'boolean' ? row.needs_details : /tag/i.test(String(row.title || ''))
                        };
                    });
                    console.log(`✓ Loaded ${this.products.length} products from Supabase`);
                    return;
                }

                if (Array.isArray(data) && data.length === 0) {
                    this.products = [];
                    console.log('Supabase products table is empty');
                    return;
                }
            } catch (error) {
                console.error('Could not load products from Supabase:', error);
                // An unexplained empty grid is the worst thing to hand someone at a
                // market stall, so the page says what happened and offers a retry.
                this.loadError = error.message || 'The connection failed';
                this.products = [];
                return;
            }
        }

        // For shared product state across devices, require Supabase configuration.
        console.warn('Supabase is not configured. Product list is unavailable.');
        this.products = [];
    }

    getSupabaseConfig() {
        const config = window.SUPABASE_CONFIG || {};
        return {
            supabaseUrl: config.supabaseUrl,
            supabaseAnonKey: config.supabaseAnonKey,
            supabaseStorageBucket: config.supabaseStorageBucket || 'product-images',
            supabaseProductsTable: config.supabaseProductsTable || 'products'
        };
    }

    async getSupabaseClient() {
        return window.WoofAuth.getClient();
    }

    isSupabaseConfigured() {
        const config = this.getSupabaseConfig();
        return Boolean(config.supabaseUrl) && Boolean(config.supabaseAnonKey);
    }

    async logPurchaseToSupabase(orderDetails) {
        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) return;

        if (!orderDetails || typeof orderDetails !== 'object') {
            throw new Error('[PurchaseLog] orderDetails must be an object');
        }

        const items = Array.isArray(orderDetails.items) ? orderDetails.items : [];

        const payload = {
            order_id: String(orderDetails.orderId || ''),
            customer_name: String(orderDetails.customerName || ''),
            customer_email: String(orderDetails.customerEmail || ''),
            customer_phone: String(orderDetails.customerPhone || ''),
            customer_comment: String(orderDetails.customerComment || ''),
            subtotal: Number(orderDetails.subtotal || 0),
            discount_amount: Number(orderDetails.discountAmount || 0),
            delivery_fee: Number(orderDetails.deliveryFee || 0),
            total: Number(orderDetails.total || 0),
            items: items,
            pet_name: String(orderDetails.petName || '').trim() || null,
            address: String(orderDetails.address || '').trim() || null,
            ring_colour: orderDetails.ringColour || null,
            delivery_method: orderDetails.deliveryMethod === 'pickup' ? 'pickup' : 'delivery',
            fulfilment: orderDetails.fulfilment || null,
            payment_method: orderDetails.paymentMethod || null,
            status: orderDetails.status || null,
            tags: Array.isArray(orderDetails.tags) ? orderDetails.tags : []
        };
        // A row id chosen here lets photos be attached without reading the order back.
        if (orderDetails.rowId) payload.id = orderDetails.rowId;

        const { error } = await supabaseClient.from('orders').insert(payload);
        if (error) {
            throw new Error(`[PurchaseLog] Supabase insert failed: ${error.message}`);
        }
    }

    getLocalPurchasesKey() {
        return 'woofcrafts_purchases';
    }

    logPurchaseLocally(orderDetails) {
        if (!orderDetails || typeof orderDetails !== 'object') {
            throw new Error('[PurchaseLog] orderDetails must be an object');
        }

        const items = Array.isArray(orderDetails.items) ? orderDetails.items : [];
        const nowIso = new Date().toISOString();
        const localRecord = {
            id: `local_${String(orderDetails.orderId || '')}_${Date.now()}`,
            order_id: String(orderDetails.orderId || ''),
            customer_name: String(orderDetails.customerName || ''),
            customer_email: String(orderDetails.customerEmail || ''),
            customer_phone: String(orderDetails.customerPhone || ''),
            customer_comment: String(orderDetails.customerComment || ''),
            subtotal: Number(orderDetails.subtotal || 0),
            discount_amount: Number(orderDetails.discountAmount || 0),
            delivery_fee: Number(orderDetails.deliveryFee || 0),
            total: Number(orderDetails.total || 0),
            items,
            pet_name: String(orderDetails.petName || '').trim() || null,
            address: String(orderDetails.address || '').trim() || null,
            ring_colour: orderDetails.ringColour || null,
            delivery_method: orderDetails.deliveryMethod === 'pickup' ? 'pickup' : 'delivery',
            fulfilment: orderDetails.fulfilment || null,
            payment_method: orderDetails.paymentMethod || null,
            status: orderDetails.status || null,
            tags: Array.isArray(orderDetails.tags) ? orderDetails.tags : [],
            photo_paths: [],
            created_at: nowIso
        };

        const storageKey = this.getLocalPurchasesKey();
        const existingRaw = localStorage.getItem(storageKey);
        let existing = [];
        if (existingRaw) {
            try {
                const parsed = JSON.parse(existingRaw);
                if (Array.isArray(parsed)) existing = parsed;
            } catch {
                existing = [];
            }
        }

        // Prepend newest; cap to last 200.
        const next = [localRecord, ...existing].slice(0, 200);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return localRecord;
    }

    async logPurchase(orderDetails) {
        // Prefer Supabase when configured; always fall back to local storage.
        if (this.isSupabaseConfigured()) {
            try {
                await this.logPurchaseToSupabase(orderDetails);
                this.lastPurchasesSource = 'supabase';
                return;
            } catch (error) {
                console.warn('[PurchaseLog] Supabase logging failed; falling back to local storage:', error);
            }
        }

        this.logPurchaseLocally(orderDetails);
        this.lastPurchasesSource = 'local';
    }

    async loadPurchasesFromSupabase() {
        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) return [];

        // Every order, newest first, read in pages so nothing is cut off.
        const pageSize = 500;
        const all = [];
        for (let from = 0; ; from += pageSize) {
            const { data, error } = await supabaseClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .order('id', { ascending: true })
                .range(from, from + pageSize - 1);

            if (error) {
                throw new Error(`[PurchaseLog] Supabase select failed: ${error.message}`);
            }
            if (!Array.isArray(data)) break;
            all.push(...data);
            if (data.length < pageSize) break;
        }
        return all;
    }

    loadPurchasesFromLocalStorage() {
        const storageKey = this.getLocalPurchasesKey();
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed;
        } catch {
            return [];
        }
    }

    async loadPurchases() {
        if (this.isSupabaseConfigured()) {
            try {
                const purchases = await this.loadPurchasesFromSupabase();
                this.lastPurchasesSource = 'supabase';
                return purchases;
            } catch (error) {
                console.error('[PurchaseLog] Failed to load from Supabase; falling back to local storage:', error);
            }
        }

        this.lastPurchasesSource = 'local';
        return this.loadPurchasesFromLocalStorage();
    }

    formatCurrency(value) {
        return `$${Number(value || 0).toFixed(2)}`;
    }

    escapePurchaseText(text) {
        return escapeHtml(text);
    }

    // ------------------------------------------------------------ purchases
    // Invoice list on the left, the selected invoice on the right. On a phone the
    // list fills the screen and an invoice opens over it with a Back button.

    /** Date (yyyy-mm-dd) and time (HH:MM) of an order in Singapore time. */
    sgtParts(dateLike) {
        const date = dateLike ? new Date(dateLike) : new Date();
        if (Number.isNaN(date.getTime())) return { date: '', time: '' };
        const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
        return { date: this.invoiceFolderFor(date), time: time === '24:00' ? '00:00' : time };
    }

    ringColourLabel(value) {
        const key = String(value || '').toLowerCase();
        return { 'silver': 'Silver', 'gold': 'Gold', 'gun metal': 'Gun metal' }[key] || '';
    }

    /** The name staff typed, or '' for the old placeholder that meant "no name given". */
    ownerNameOf(purchase) {
        const name = String((purchase && purchase.customer_name) || '').trim();
        return name === 'Customer' ? '' : name;
    }

    purchaseItemCount(purchase) {
        const items = Array.isArray(purchase && purchase.items) ? purchase.items : [];
        return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }

    // ---- Order status: To make -> Made -> Collected / Posted (or Void)
    static get STATUS_LABELS() {
        return { to_make: 'To make', made: 'Made', collected: 'Collected', posted: 'Posted', void: 'Void' };
    }

    statusLabel(status) {
        return POSApp.STATUS_LABELS[status] || 'Not set';
    }

    statusChipHtml(purchase) {
        const status = purchase && purchase.status;
        if (!POSApp.STATUS_LABELS[status]) return '';
        return `<span class="status-chip status-${status}">${escapeHtml(this.statusLabel(status))}</span>`;
    }

    isVoid(purchase) {
        return Boolean(purchase && purchase.status === 'void');
    }

    isDelivery(purchase) {
        return Boolean(purchase && (purchase.fulfilment === 'delivery' || (!purchase.fulfilment && purchase.delivery_method === 'delivery')));
    }

    /** The one tap that moves an order forward, or null when there is nothing next. */
    nextStatusFor(purchase) {
        if (!purchase) return null;
        if (purchase.status === 'to_make') return 'made';
        if (purchase.status === 'made') return this.isDelivery(purchase) ? 'posted' : 'collected';
        return null;
    }

    advanceLabel(next) {
        return { made: 'Mark as made', collected: 'Mark as collected', posted: 'Mark as posted' }[next] || '';
    }

    statusMatchesFilter(purchase, filter) {
        if (!filter || filter === 'all') return true;
        if (filter === 'done') return purchase.status === 'collected' || purchase.status === 'posted';
        return purchase.status === filter;
    }

    tagsToMakeCount(purchase) {
        const tags = Array.isArray(purchase && purchase.tags) ? purchase.tags : [];
        return tags.filter((t) => !t.made).length;
    }

    /** Badge on the Purchases tab, today's summary and the status filter chips. */
    renderPurchasesChrome(all) {
        const live = all.filter((p) => !this.isVoid(p));
        const toMake = live.filter((p) => p.status === 'to_make');
        const badge = document.getElementById('purchases-badge');
        if (badge) {
            badge.textContent = String(toMake.length);
            badge.classList.toggle('hidden', toMake.length === 0);
            badge.setAttribute('aria-label', `${toMake.length} orders still to make`);
        }

        const today = this.invoiceFolderFor(new Date());
        const todays = live.filter((p) => p.created_at && this.invoiceFolderFor(p.created_at) === today);
        const sum = (list) => list.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        const paynow = sum(todays.filter((p) => p.payment_method === 'paynow'));
        const cash = sum(todays.filter((p) => p.payment_method === 'cash'));
        const tagsLeft = toMake.reduce((acc, p) => acc + this.tagsToMakeCount(p), 0);
        const summaryEl = document.getElementById('purchases-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="summary-grid">
                    <div><span>Sales today</span><strong>${escapeHtml(this.formatCurrency(sum(todays)))}</strong></div>
                    <div><span>Orders today</span><strong>${todays.length}</strong></div>
                    <div><span>Tags to make</span><strong>${tagsLeft}</strong></div>
                </div>
                ${(paynow || cash) ? `<p class="summary-pay">PayNow ${escapeHtml(this.formatCurrency(paynow))} · Cash ${escapeHtml(this.formatCurrency(cash))}</p>` : ''}`;
        }

        const filtersEl = document.getElementById('status-filters');
        if (filtersEl) {
            const count = (filter) => all.filter((p) => filter === 'all' ? true : (!this.isVoid(p) && this.statusMatchesFilter(p, filter))).length;
            const active = this.statusFilter || 'all';
            filtersEl.innerHTML = [['all', 'All'], ['to_make', 'To make'], ['made', 'Made'], ['done', 'Done']].map(([value, label]) =>
                `<button type="button" class="filter-chip" data-status-filter="${value}" aria-pressed="${active === value}">${label} <span class="filter-count">${count(value)}</span></button>`).join('');
        }
    }

    /** Ready-made WhatsApp message to the customer. Singapore numbers get +65. */
    whatsappReadyLink(purchase) {
        const digits = String((purchase && purchase.customer_phone) || '').replace(/\D/g, '');
        if (digits.length < 7) return '';
        const number = digits.length === 8 ? '65' + digits : digits;
        const owner = this.ownerNameOf(purchase);
        const text = `Hi${owner ? ' ' + owner : ''}, your WoofCrafts order #${purchase.order_id} is ready for collection at the booth. Thank you!`;
        return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    }

    /** One generic, safe update of an order's editable columns (database or this device). */
    async updateOrderFields(purchaseId, changes) {
        const id = String(purchaseId || '');
        const current = this.purchaseCache.get(id);
        if (!current) throw new Error('This invoice is no longer in the list. Refresh and try again.');

        let updated;
        if (id.startsWith('local_')) {
            const storageKey = this.getLocalPurchasesKey();
            const list = this.loadPurchasesFromLocalStorage();
            const index = list.findIndex((p) => String(p.id) === id);
            if (index < 0) throw new Error('This invoice is no longer on this device.');
            const stamp = new Date().toISOString();
            const extra = {};
            if ('status' in changes && changes.status !== list[index].status) {
                extra.status_changed_at = stamp;
                if (changes.status === 'void') extra.voided_at = stamp;
            }
            const detailKeys = ['customer_name', 'pet_name', 'ring_colour', 'address', 'customer_comment', 'tags'];
            if (detailKeys.some((key) => key in changes)) extra.notes_edited_at = stamp;
            list[index] = { ...list[index], ...changes, ...extra };
            localStorage.setItem(storageKey, JSON.stringify(list));
            updated = list[index];
        } else {
            const client = await this.getSupabaseClient();
            if (!client) throw new Error('Not connected to the order database.');
            const { data, error } = await client.from('orders').update(changes).eq('id', id).select('*').single();
            if (error || !data) throw new Error(error ? error.message : 'The order was not found.');
            updated = data;
        }

        this.purchaseCache.set(id, updated);
        if (Array.isArray(this.allPurchases)) {
            this.allPurchases = this.allPurchases.map((p) => (String(p.id) === id ? updated : p));
        }
        return updated;
    }

    afterPurchaseUpdate(updated, message) {
        this.renderPurchasesList();
        if (this.purchasesView === 'makelist') this.renderMakeList();
        else this.renderPurchaseDetails(updated);
        if (message) ui.showToast(message, 'success');
    }

    async changeStatus(purchaseId, status, extra = {}) {
        const current = this.purchaseCache.get(String(purchaseId));
        const changes = { status, ...extra };
        const updated = await this.updateOrderFields(purchaseId, changes);
        this.afterPurchaseUpdate(updated, `Invoice #${(current && current.order_id) || ''}: ${this.statusLabel(status)}.`);
    }

    /** Tick or untick one tag. The order becomes Made when every tag is made. */
    async setTagMade(purchaseId, index, made) {
        const current = this.purchaseCache.get(String(purchaseId));
        if (!current || !Array.isArray(current.tags) || !current.tags[index]) return;
        const tags = current.tags.map((t, i) => (i === index ? { ...t, made: Boolean(made) } : t));
        const changes = { tags };
        const allMade = tags.every((t) => t.made);
        if (current.status === 'to_make' && allMade) changes.status = 'made';
        if (current.status === 'made' && !allMade) changes.status = 'to_make';
        const updated = await this.updateOrderFields(purchaseId, changes);
        const msg = changes.status === 'made' ? `Invoice #${updated.order_id}: all tags made.` : '';
        this.afterPurchaseUpdate(updated, msg);
    }

    /** Status changes are kept in the database; show the last few on the invoice. */
    async loadStatusHistory(purchase) {
        const el = () => {
            const card = document.querySelector('.purchase-details-card');
            if (!card || card.getAttribute('data-purchase-id') !== String(purchase.id)) return null;
            return document.getElementById('status-history');
        };
        if (!el() || String(purchase.id).startsWith('local_')) return;
        try {
            const client = await this.getSupabaseClient();
            if (!client) return;
            const { data, error } = await client.from('order_status_history')
                .select('old_status,new_status,note,changed_at').eq('order_uuid', purchase.id).order('changed_at', { ascending: false }).limit(8);
            if (error || !Array.isArray(data) || data.length === 0) return;
            const target = el();
            if (!target) return;
            target.innerHTML = '<h4>History</h4><ul>' + data.map((row) => {
                const when = new Date(row.changed_at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                const from = row.old_status ? this.statusLabel(row.old_status) + ' → ' : '';
                return `<li>${escapeHtml(when)}: ${escapeHtml(from + this.statusLabel(row.new_status))}${row.note ? ' (' + escapeHtml(row.note) + ')' : ''}</li>`;
            }).join('') + '</ul>';
        } catch (error) {
            console.warn('Could not load status history:', error);
        }
    }

    /** Workbench view: every tag still to make, oldest order first. */
    showMakeList() {
        this.purchasesView = 'makelist';
        this.editingPurchase = false;
        this.selectPurchaseRow(null);
        this.renderMakeList();
        const layoutEl = document.getElementById('purchases-layout');
        if (layoutEl) layoutEl.classList.add('show-detail');
        const detailsEl = document.getElementById('purchase-details');
        if (detailsEl) detailsEl.scrollTop = 0;
    }

    renderMakeList() {
        const detailsEl = document.getElementById('purchase-details');
        if (!detailsEl) return;
        const orders = (this.allPurchases || [])
            .filter((p) => p.status === 'to_make' && !this.isVoid(p))
            .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
        const tagTotal = orders.reduce((sum, p) => sum + this.tagsToMakeCount(p), 0);

        const groups = orders.map((p) => {
            const tags = Array.isArray(p.tags) ? p.tags : [];
            const { date, time } = this.sgtParts(p.created_at);
            const rows = tags.map((t, index) => {
                if (t.made) return '';
                const ring = this.ringColourLabel(t.ring_colour);
                const label = t.of > 1 ? `${t.item} (${t.number}/${t.of})` : t.item;
                return `
                    <li class="makelist-tag">
                        <div class="makelist-tag-main">
                            <p class="makelist-tag-name">${escapeHtml(label || '')}${t.pet_name ? ` · <strong>${escapeHtml(t.pet_name)}</strong>` : ''}${ring ? ` · ${escapeHtml(ring)} ring` : ''}</p>
                            <p class="makelist-engrave"><span>Front</span> ${t.front ? escapeHtml(t.front) : '<em>none</em>'}</p>
                            <p class="makelist-engrave"><span>Back</span> ${t.back ? escapeHtml(t.back) : '<em>none</em>'}</p>
                        </div>
                        <button type="button" class="btn-secondary makelist-made no-print" data-purchase-id="${escapeHtml(String(p.id))}" data-tag-index="${index}">${iconSvg('check')} Made</button>
                    </li>`;
            }).join('');
            const owner = this.ownerNameOf(p);
            return `
                <section class="makelist-order">
                    <h3><button type="button" class="link-btn" data-open-purchase="${escapeHtml(String(p.id))}">#${escapeHtml(p.order_id || '')}</button>
                        <span>${escapeHtml(owner)}</span>
                        <span class="makelist-when">${escapeHtml(date)} ${escapeHtml(time)} · ${escapeHtml(this.fulfilmentLabel(p.fulfilment))}</span></h3>
                    ${rows ? `<ul class="makelist-tags">${rows}</ul>` : '<p class="field-note">No tags listed for this order.</p>'}
                </section>`;
        }).join('');

        detailsEl.innerHTML = `
            <article class="purchase-details-card makelist-card" data-purchase-id="makelist">
                <button type="button" class="btn-secondary purchase-back-btn" id="purchase-back-btn">${iconSvg('back')} Purchases</button>
                <div class="purchase-details-head">
                    <div class="purchase-details-heading">
                        <h2 class="purchase-details-title">Tags to make</h2>
                        <p class="purchase-details-date">${tagTotal} ${tagTotal === 1 ? 'tag' : 'tags'} in ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}, oldest first</p>
                    </div>
                    <div class="purchase-details-actions no-print"><button type="button" class="btn-secondary" id="makelist-print">${iconSvg('receipt')} Print</button></div>
                </div>
                ${groups || '<div class="empty-state"><p>Nothing to make right now</p></div>'}
            </article>`;
    }

    filteredPurchases() {
        const all = (Array.isArray(this.allPurchases) ? this.allPurchases : []).filter((p) => this.statusMatchesFilter(p, this.statusFilter));
        const query = String(this.purchaseSearch || '').trim().toLowerCase();
        if (!query) return all;
        return all.filter((p) => {
            const items = Array.isArray(p.items) ? p.items.map((item) => item && item.name).join(' ') : '';
            const tagText = Array.isArray(p.tags) ? p.tags.map((t) => [t.pet_name, t.front, t.back].join(' ')).join(' ') : '';
            const haystack = [p.order_id, p.customer_name, p.pet_name, p.customer_email, p.customer_phone, p.address, p.customer_comment, items, tagText, this.statusLabel(p.status)]
                .map((value) => String(value || '')).join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }

    renderPurchasesList(purchases) {
        if (Array.isArray(purchases)) {
            this.allPurchases = purchases;
            this.purchaseCache.clear();
            purchases.forEach((p) => { if (p && p.id) this.purchaseCache.set(String(p.id), p); });
        }

        const listEl = document.getElementById('purchases-list');
        if (!listEl) return;
        const countEl = document.getElementById('purchases-count');
        const all = Array.isArray(this.allPurchases) ? this.allPurchases : [];
        this.renderPurchasesChrome(all);

        if (all.length === 0) {
            const localModeNotice = !this.isSupabaseConfigured()
                ? '<p class="empty-state-note">The order database is not connected. Purchases made on this device will show here.</p>'
                : '';
            listEl.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('receipt')}</span>
                    <p>No purchases yet</p>
                    <p class="empty-state-note">Orders show here after you send an invoice.</p>
                    ${localModeNotice}
                </div>
            `;
            if (countEl) countEl.textContent = '';
            return;
        }

        const visible = this.filteredPurchases();
        if (countEl) {
            countEl.textContent = visible.length === all.length
                ? `${all.length} ${all.length === 1 ? 'invoice' : 'invoices'}`
                : `${visible.length} of ${all.length} invoices`;
        }

        if (visible.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('search')}</span>
                    <p>No invoice matches</p>
                    <button type="button" class="btn-secondary" id="purchases-search-clear">Clear search and filter</button>
                </div>
            `;
            return;
        }

        // Day totals for the date headings.
        const dayTotals = new Map();
        visible.forEach((p) => {
            const day = p.created_at ? this.invoiceFolderFor(p.created_at) : '';
            const entry = dayTotals.get(day) || { count: 0, total: 0 };
            if (!this.isVoid(p)) {
                entry.count += 1;
                entry.total += Number(p.total) || 0;
            }
            dayTotals.set(day, entry);
        });

        let lastDay = null;
        listEl.innerHTML = visible.map((p) => {
            const purchaseId = String(p.id);
            const orderId = escapeHtml(p.order_id || '');
            const owner = escapeHtml(this.ownerNameOf(p));
            const pet = escapeHtml(p.pet_name || '');
            const { date: day, time } = this.sgtParts(p.created_at);
            const count = this.purchaseItemCount(p);

            let heading = '';
            if (day !== lastDay) {
                lastDay = day;
                const info = dayTotals.get(day);
                const headingText = p.created_at
                    ? new Date(p.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                    : 'No date';
                heading = `<h3 class="purchase-date-heading"><span>${escapeHtml(headingText)}</span><span class="purchase-date-total">${info.count} · ${escapeHtml(this.formatCurrency(info.total))}</span></h3>`;
            }

            const sub = [pet, `${count} ${count === 1 ? 'item' : 'items'}`, escapeHtml(time)].filter(Boolean).join(' · ');
            const selected = purchaseId === String(this.selectedPurchaseId || '');
            return `${heading}
                <button type="button" class="purchase-row${this.isVoid(p) ? ' is-void' : ''}" data-purchase-id="${escapeHtml(purchaseId)}" aria-current="${selected ? 'true' : 'false'}"
                    aria-label="Invoice ${orderId}${owner ? ', ' + owner : ''}${POSApp.STATUS_LABELS[p.status] ? ', ' + this.statusLabel(p.status) : ''}, ${escapeHtml(this.formatCurrency(p.total))}">
                    <span class="purchase-row-main">
                        <span class="purchase-row-title">#${orderId}${owner ? ` <span class="purchase-row-owner">${owner}</span>` : ''}</span>
                        <span class="purchase-row-sub">${sub}</span>
                        ${this.statusChipHtml(p) ? `<span class="purchase-row-status">${this.statusChipHtml(p)}</span>` : ''}
                    </span>
                    <span class="purchase-row-total">${escapeHtml(this.formatCurrency(p.total))}</span>
                </button>
            `;
        }).join('');
    }

    /** True when the list and the invoice sit side by side. */
    isPurchasesWide() {
        return Boolean(window.matchMedia && window.matchMedia('(min-width: 768px)').matches);
    }

    detailField(label, value, extraClass = '') {
        const text = String(value || '').trim();
        return `<div class="detail-field ${extraClass}"><dt>${escapeHtml(label)}</dt><dd class="${text ? '' : 'is-empty'}">${text ? escapeHtml(text) : 'Not recorded'}</dd></div>`;
    }

    renderPurchaseDetails(purchase, options = {}) {
        const detailsEl = document.getElementById('purchase-details');
        const layoutEl = document.getElementById('purchases-layout');
        if (!detailsEl) return;

        if (!purchase) {
            this.selectedPurchaseId = null;
            this.editingPurchase = false;
            if (layoutEl) layoutEl.classList.remove('show-detail');
            detailsEl.innerHTML = `
                <div class="empty-state purchase-details-empty">
                    <span class="empty-icon">${iconSvg('receipt')}</span>
                    <p>Pick an invoice from the list</p>
                </div>
            `;
            return;
        }

        const editing = Boolean(options.editing);
        const voiding = Boolean(options.voiding);
        this.purchasesView = 'invoice';
        this.editingPurchase = editing;
        const purchaseId = String(purchase.id);
        const safeOrderId = escapeHtml(purchase.order_id || '');
        const createdAt = purchase.created_at ? new Date(purchase.created_at) : null;
        const dateText = createdAt
            ? createdAt.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + this.sgtParts(createdAt).time
            : '';
        const notes = String(purchase.customer_comment || '');
        const ring = String(purchase.ring_colour || '').toLowerCase();
        const items = Array.isArray(purchase.items) ? purchase.items : [];
        const tags = Array.isArray(purchase.tags) ? purchase.tags : [];
        const voided = this.isVoid(purchase);

        const itemsRows = items.map((item) => {
            const qty = Number(item.quantity || 0);
            return `
                <tr>
                    <td>${escapeHtml(item.name || '')}</td>
                    <td class="purchase-details-qty-cell">${qty}</td>
                    <td class="purchase-details-price-cell">${this.formatCurrency(item.price)}</td>
                    <td class="purchase-details-subtotal-cell">${this.formatCurrency(item.subtotal || (Number(item.price || 0) * qty))}</td>
                </tr>
            `;
        }).join('');

        const editedStamp = purchase.notes_edited_at
            ? `<p class="edited-stamp">Edited ${escapeHtml(new Date(purchase.notes_edited_at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</p>`
            : '';

        const deliveryText = purchase.delivery_method === 'pickup'
            ? 'Pickup'
            : (Number(purchase.delivery_fee || 0) > 0 ? this.formatCurrency(purchase.delivery_fee) : (purchase.delivery_method === 'delivery' ? 'Free' : ''));

        const legacyFields = `
                <div class="input-group">
                    <label for="edit-pet-name">Pet's name</label>
                    <input type="text" id="edit-pet-name" class="input-field" autocomplete="off" value="${escapeHtml(purchase.pet_name || '')}">
                </div>
                <div class="input-group">
                    <span class="group-label" id="edit-ring-label">Colour of ring</span>
                    <div class="segmented" id="edit-ring-colour" role="group" aria-labelledby="edit-ring-label">
                        ${['silver', 'gold', 'gun metal'].map((value) => `<button type="button" class="seg-btn" data-ring="${value}" aria-pressed="${ring === value}">${this.ringColourLabel(value)}</button>`).join('')}
                    </div>
                </div>`;
        const tagEditor = tags.map((t, i) => `
                <fieldset class="tag-card edit-tag" data-tag-index="${i}">
                    <legend class="tag-card-name">${escapeHtml(t.item || 'Tag')}${t.of > 1 ? ` (${t.number}/${t.of})` : ''}</legend>
                    <div class="input-group">
                        <label for="edit-tag-${i}-pet">Pet's name</label>
                        <input type="text" id="edit-tag-${i}-pet" class="input-field" data-field="pet_name" autocomplete="off" value="${escapeHtml(t.pet_name || '')}">
                    </div>
                    <div class="input-group">
                        <span class="group-label" id="edit-tag-${i}-ring-label">Colour of ring</span>
                        <div class="segmented edit-tag-ring" role="group" aria-labelledby="edit-tag-${i}-ring-label">
                            ${['silver', 'gold', 'gun metal'].map((value) => `<button type="button" class="seg-btn" data-ring="${value}" aria-pressed="${String(t.ring_colour || '') === value}">${this.ringColourLabel(value)}</button>`).join('')}
                        </div>
                    </div>
                    <div class="tag-card-text">
                        <div class="input-group"><label for="edit-tag-${i}-front">Front</label><input type="text" id="edit-tag-${i}-front" class="input-field" data-field="front" maxlength="80" autocomplete="off" value="${escapeHtml(t.front || '')}"></div>
                        <div class="input-group"><label for="edit-tag-${i}-back">Back</label><input type="text" id="edit-tag-${i}-back" class="input-field" data-field="back" maxlength="80" autocomplete="off" value="${escapeHtml(t.back || '')}"></div>
                    </div>
                </fieldset>`).join('');

        const infoBlock = editing ? `
            <form class="purchase-edit-form" id="purchase-edit-form" novalidate>
                <div class="input-group">
                    <label for="edit-owner-name">Owner name</label>
                    <input type="text" id="edit-owner-name" class="input-field" autocomplete="off" value="${escapeHtml(this.ownerNameOf(purchase))}">
                </div>
                ${tags.length ? tagEditor : legacyFields}
                <div class="input-group">
                    <span class="group-label" id="edit-payment-label">Payment</span>
                    <div class="segmented segmented-2" id="edit-payment" role="group" aria-labelledby="edit-payment-label">
                        ${['paynow', 'cash'].map((value) => `<button type="button" class="seg-btn" data-payment="${value}" aria-pressed="${purchase.payment_method === value}">${this.paymentLabel(value)}</button>`).join('')}
                    </div>
                </div>
                <div class="input-group">
                    <label for="edit-address">Delivery address</label>
                    <textarea id="edit-address" class="input-field textarea-short" rows="2" autocomplete="off">${escapeHtml(purchase.address || '')}</textarea>
                </div>
                <div class="input-group">
                    <label for="edit-notes">Notes</label>
                    <textarea id="edit-notes" class="input-field textarea-resizable" rows="5">${escapeHtml(notes)}</textarea>
                </div>
                <p class="field-note">The invoice PDF already sent to the customer keeps the original text. Earlier versions of these fields are kept in the order history.</p>
                <div class="purchase-edit-actions">
                    <button type="button" class="btn-secondary" id="purchase-edit-cancel">Cancel</button>
                    <button type="submit" class="btn-primary" id="purchase-edit-save">${iconSvg('check')} Save changes</button>
                </div>
            </form>
        ` : `
            <dl class="detail-grid">
                ${this.detailField('Owner name', this.ownerNameOf(purchase))}
                ${tags.length ? '' : this.detailField("Pet's name", purchase.pet_name)}
                ${tags.length ? '' : this.detailField('Colour of ring', this.ringColourLabel(purchase.ring_colour))}
                ${this.detailField('How', this.fulfilmentLabel(purchase.fulfilment))}
                ${this.detailField('Payment', this.paymentLabel(purchase.payment_method))}
                ${this.detailField('Phone', purchase.customer_phone)}
                ${this.detailField('Email', purchase.customer_email, 'detail-field-wide detail-field-email')}
                ${this.detailField('Delivery address', purchase.address, 'detail-field-wide')}
            </dl>
            <section class="detail-notes" aria-labelledby="detail-notes-heading">
                <h3 id="detail-notes-heading">Notes</h3>
                <p class="purchase-details-notes ${notes.trim() ? '' : 'is-empty'}">${notes.trim() ? escapeHtml(notes.trim()) : 'No notes'}</p>
                ${editedStamp}
            </section>
        `;

        // Status: where this order is in the making, with the one tap that moves it on.
        const next = this.nextStatusFor(purchase);
        const readyLink = purchase.status === 'made' && !this.isDelivery(purchase) ? this.whatsappReadyLink(purchase) : '';
        const sinceText = purchase.status_changed_at
            ? 'since ' + new Date(purchase.status_changed_at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '';
        const statusBlock = editing ? '' : (voiding ? `
            <section class="status-block" aria-labelledby="void-heading">
                <h3 id="void-heading">Void invoice #${safeOrderId}?</h3>
                <p class="field-note">The invoice and its PDF stay in your records, marked Void and left out of totals.</p>
                <div class="input-group">
                    <label for="void-reason">Reason (optional)</label>
                    <input type="text" id="void-reason" class="input-field" autocomplete="off" placeholder="Test order, wrong item, customer cancelled">
                </div>
                <div class="purchase-edit-actions">
                    <button type="button" class="btn-secondary" id="void-cancel">Keep invoice</button>
                    <button type="button" class="btn-primary btn-danger-soft" id="void-confirm">Void invoice</button>
                </div>
            </section>` : `
            <section class="status-block${voided ? ' is-void' : ''}" aria-labelledby="status-heading">
                <div class="status-row">
                    <h3 id="status-heading">Status</h3>
                    ${this.statusChipHtml(purchase) || '<span class="status-chip status-none">Not set</span>'}
                    ${sinceText ? `<span class="field-note">${escapeHtml(sinceText)}</span>` : ''}
                </div>
                ${voided && purchase.void_reason ? `<p class="field-note">Reason: ${escapeHtml(purchase.void_reason)}</p>` : ''}
                <div class="status-actions">
                    ${next ? `<button type="button" class="btn-primary" id="status-advance" data-next="${next}">${iconSvg('check')} ${escapeHtml(this.advanceLabel(next))}</button>` : ''}
                    ${readyLink ? `<a class="btn-secondary" id="ready-link" href="${escapeHtml(readyLink)}" target="_blank" rel="noopener">Tell customer it's ready</a>` : ''}
                    <label class="status-select-wrap"><span class="visually-hidden">Change status</span>
                        <select id="status-set" class="input-field" aria-label="Change status">
                            <option value="">Change status…</option>
                            ${['to_make', 'made', 'collected', 'posted'].filter((v) => v !== purchase.status).map((v) => `<option value="${v}">${this.statusLabel(v)}</option>`).join('')}
                        </select>
                    </label>
                    ${voided ? '' : `<button type="button" class="btn-secondary" id="void-open">Void</button>`}
                </div>
                <div id="status-history" class="status-history"></div>
            </section>`);

        const canTick = !voided && (purchase.status === 'to_make' || purchase.status === 'made');
        const madeCount = tags.filter((t) => t.made).length;
        const tagsBlock = (editing || voiding || !tags.length) ? '' : `
            <section class="detail-tags" aria-labelledby="detail-tags-heading">
                <h3 id="detail-tags-heading">Tags <span class="field-note">${madeCount} of ${tags.length} made</span></h3>
                <ul class="tag-list">
                    ${tags.map((t, i) => `
                        <li class="tag-row${t.made ? ' is-made' : ''}">
                            <label class="tag-made"><input type="checkbox" class="tag-made-input" data-tag-index="${i}" ${t.made ? 'checked' : ''} ${canTick ? '' : 'disabled'}><span class="visually-hidden">Made: ${escapeHtml(t.item || 'Tag')} ${t.number || ''}</span></label>
                            <div class="tag-row-body">
                                <strong>${escapeHtml(t.item || 'Tag')}${t.of > 1 ? ` (${t.number}/${t.of})` : ''}</strong>
                                <span>${t.pet_name ? escapeHtml(t.pet_name) : '<em>no pet name</em>'}${t.ring_colour ? ' · ' + escapeHtml(this.ringColourLabel(t.ring_colour)) + ' ring' : ''}</span>
                                <span class="tag-engrave">Front: ${t.front ? escapeHtml(t.front) : '<em>none</em>'}</span>
                                <span class="tag-engrave">Back: ${t.back ? escapeHtml(t.back) : '<em>none</em>'}</span>
                            </div>
                        </li>`).join('')}
                </ul>
            </section>`;

        const photoPaths = Array.isArray(purchase.photo_paths) ? purchase.photo_paths : [];
        const canAddPhoto = !String(purchaseId).startsWith('local_') && this.isSupabaseConfigured();
        const photosBlock = editing ? '' : `
            <section class="detail-photos" aria-labelledby="detail-photos-heading">
                <h3 id="detail-photos-heading">Photos</h3>
                <div class="photo-strip" id="detail-photo-strip" data-photo-count="${photoPaths.length}">
                    ${photoPaths.length ? '<p class="field-note">Loading photos…</p>' : '<p class="field-note">No photo for this order.</p>'}
                </div>
                ${canAddPhoto ? `<button type="button" class="btn-secondary" id="detail-photo-add">${iconSvg('camera')} Add photo</button>` : ''}
            </section>
        `;

        detailsEl.innerHTML = `
            <article class="purchase-details-card" data-purchase-id="${escapeHtml(purchaseId)}">
                <button type="button" class="btn-secondary purchase-back-btn" id="purchase-back-btn">${iconSvg('back')} Purchases</button>
                <div class="purchase-details-head">
                    <div class="purchase-details-heading">
                        <h2 class="purchase-details-title">Invoice #${safeOrderId}</h2>
                        ${dateText ? `<p class="purchase-details-date">${escapeHtml(dateText)}</p>` : ''}
                    </div>
                    ${(editing || voiding) ? '' : `
                    <div class="purchase-details-actions">
                        <button type="button" class="btn-secondary" id="purchase-edit-btn">${iconSvg('edit')} Edit</button>
                        ${purchase.order_id && purchase.created_at ? `
                            <button type="button" class="btn-secondary invoice-open-btn"
                                data-invoice-order="${escapeHtml(String(purchase.order_id))}"
                                data-invoice-date="${escapeHtml(String(purchase.created_at))}">
                                ${iconSvg('receipt')} Invoice PDF
                            </button>
                        ` : ''}
                    </div>`}
                </div>

                ${statusBlock}
                ${infoBlock}
                ${tagsBlock}
                ${photosBlock}

                <div class="purchase-details-table-wrap">
                    <table class="purchase-details-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th class="purchase-details-qty-cell">Qty</th>
                                <th class="purchase-details-price-cell">Price</th>
                                <th class="purchase-details-subtotal-cell">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${itemsRows}</tbody>
                    </table>
                </div>

                <div class="purchase-details-totals">
                    <div class="purchase-total-box">
                        <div class="purchase-total-label">Subtotal</div>
                        <div class="purchase-total-value">${this.formatCurrency(purchase.subtotal)}</div>
                    </div>
                    ${Number(purchase.discount_amount || 0) > 0 ? `
                        <div class="purchase-total-box">
                            <div class="purchase-total-label">Discount</div>
                            <div class="purchase-total-value purchase-total-value-muted">-${this.formatCurrency(purchase.discount_amount)}</div>
                        </div>
                    ` : ''}
                    ${deliveryText ? `
                        <div class="purchase-total-box">
                            <div class="purchase-total-label">Delivery</div>
                            <div class="purchase-total-value">${escapeHtml(deliveryText)}</div>
                        </div>
                    ` : ''}
                    <div class="purchase-total-box purchase-total-box-highlight">
                        <div class="purchase-total-label">Total</div>
                        <div class="purchase-total-value purchase-total-value-highlight">${this.formatCurrency(purchase.total)}</div>
                    </div>
                </div>
            </article>
        `;

        if (!editing && !voiding) this.loadStatusHistory(purchase);
        if (voiding) { const reason = document.getElementById('void-reason'); if (reason && reason.focus) reason.focus(); }
        if (!editing && photoPaths.length) this.renderPurchasePhotos(purchase);
        if (editing) {
            const notesField = document.getElementById('edit-notes');
            if (notesField && notesField.focus) notesField.focus({ preventScroll: false });
        }
    }

    /** Photos live in a private bucket, so each one needs a short-lived signed link. */
    async renderPurchasePhotos(purchase) {
        const paths = Array.isArray(purchase.photo_paths) ? purchase.photo_paths : [];
        const stripFor = () => {
            const card = document.querySelector('.purchase-details-card');
            if (!card || card.getAttribute('data-purchase-id') !== String(purchase.id)) return null;
            return document.getElementById('detail-photo-strip');
        };
        try {
            const client = await this.getSupabaseClient();
            if (!client) throw new Error('not connected');
            const { data, error } = await client.storage.from('order-photos').createSignedUrls(paths, 900);
            if (error || !Array.isArray(data)) throw new Error(error ? error.message : 'no links');
            const strip = stripFor();
            if (!strip) return; // the user has moved on to another invoice
            const links = data.filter((entry) => entry && entry.signedUrl);
            strip.innerHTML = links.length
                ? links.map((entry, index) => `
                    <a class="photo-thumb" href="${escapeHtml(entry.signedUrl)}" target="_blank" rel="noopener" aria-label="Open photo ${index + 1}">
                        <img src="${escapeHtml(entry.signedUrl)}" alt="Order photo ${index + 1}" loading="lazy" decoding="async">
                    </a>`).join('')
                : '<p class="field-note">The photos for this order could not be found.</p>';
        } catch (error) {
            console.error('Could not load order photos:', error);
            const strip = stripFor();
            if (strip) strip.innerHTML = '<p class="field-note">Photos could not be loaded. Check the connection and open the invoice again.</p>';
        }
    }

    selectPurchaseRow(purchaseId) {
        this.selectedPurchaseId = purchaseId ? String(purchaseId) : null;
        document.querySelectorAll('#purchases-list .purchase-row').forEach((row) => {
            row.setAttribute('aria-current', String(row.getAttribute('data-purchase-id') === this.selectedPurchaseId));
        });
    }

    async showPurchaseDetails(purchaseId, options = {}) {
        const id = String(purchaseId || '');
        if (!id) return;

        let purchase = this.purchaseCache.get(id);
        if (!purchase) {
            const supabaseClient = await this.getSupabaseClient();
            if (!supabaseClient) return;
            const { data, error } = await supabaseClient.from('orders').select('*').eq('id', id).single();
            if (error) throw new Error(`[PurchaseLog] Failed to load purchase ${id}: ${error.message}`);
            purchase = data;
            this.purchaseCache.set(id, data);
        }

        this.selectPurchaseRow(id);
        this.renderPurchaseDetails(purchase);

        const layoutEl = document.getElementById('purchases-layout');
        const detailsEl = document.getElementById('purchase-details');
        if (!options.keepList && layoutEl) layoutEl.classList.add('show-detail');
        if (detailsEl) {
            detailsEl.scrollTop = 0;
            if (!this.isPurchasesWide() && !options.keepList) {
                window.scrollTo(0, 0);
                if (detailsEl.focus) detailsEl.focus({ preventScroll: true });
            }
        }
    }

    closePurchaseDetails() {
        const layoutEl = document.getElementById('purchases-layout');
        if (layoutEl) layoutEl.classList.remove('show-detail');
        this.editingPurchase = false;
        if (this.purchasesView === 'makelist') {
            this.purchasesView = 'invoice';
            const first = this.allPurchases && this.allPurchases[0];
            if (this.isPurchasesWide() && first) this.showPurchaseDetails(first.id, { keepList: true });
            else this.renderPurchaseDetails(null);
        }
        const selected = document.querySelector('#purchases-list .purchase-row[aria-current="true"]');
        if (selected) {
            if (selected.scrollIntoView) selected.scrollIntoView({ block: 'center' });
            if (selected.focus) selected.focus({ preventScroll: true });
        }
    }

    async refreshPurchasesView() {
        const purchases = await this.loadPurchases();
        this.purchasesLoaded = true;
        this.renderPurchasesList(purchases);

        if (this.purchasesView === 'makelist') { this.renderMakeList(); return; }
        // Keep the open invoice open across a refresh; on a wide screen show the newest one.
        const keepId = this.selectedPurchaseId && this.purchaseCache.has(String(this.selectedPurchaseId)) ? String(this.selectedPurchaseId) : null;
        const layoutEl = document.getElementById('purchases-layout');
        const detailOpen = Boolean(layoutEl && layoutEl.classList.contains('show-detail'));
        if (keepId && (this.isPurchasesWide() || detailOpen)) {
            if (!this.editingPurchase) await this.showPurchaseDetails(keepId, { keepList: !detailOpen });
        } else if (this.isPurchasesWide() && purchases.length > 0) {
            await this.showPurchaseDetails(purchases[0].id, { keepList: true });
        } else {
            this.renderPurchaseDetails(null);
        }
    }

    async reloadPurchases() {
        const listEl = document.getElementById('purchases-list');
        try {
            await this.refreshPurchasesView();
        } catch (error) {
            console.error('Error loading purchases:', error);
            if (listEl) {
                listEl.innerHTML = `
                    <div class="empty-state">
                        <span class="empty-icon">${iconSvg('alert')}</span>
                        <p>Purchases did not load</p>
                        <p class="empty-state-note">Check the connection, then try again.</p>
                        <button type="button" class="btn-secondary" id="purchases-retry-btn">${iconSvg('refresh')} Try again</button>
                    </div>
                `;
            }
        }
    }

    /** Save edits to an order's notes and details. Money, items and the order number cannot be changed. */
    async savePurchaseEdits(purchaseId, values) {
        const changes = {
            customer_name: String(values.ownerName || '').trim(),
            pet_name: String(values.petName || '').trim() || null,
            ring_colour: this.ringColourLabel(values.ringColour) ? String(values.ringColour).toLowerCase() : null,
            address: String(values.address || '').trim() || null,
            customer_comment: String(values.notes || '').trim()
        };
        // Per-tag details: keep each tag's "made" tick, and keep the order-level pet and ring in step.
        if (Array.isArray(values.tags)) {
            const current = this.purchaseCache.get(String(purchaseId));
            const old = current && Array.isArray(current.tags) ? current.tags : [];
            const tags = values.tags.map((t, i) => ({
                ...(old[i] || {}),
                pet_name: String(t.pet_name || '').trim(),
                ring_colour: this.ringColourLabel(t.ring_colour) ? String(t.ring_colour).toLowerCase() : '',
                front: String(t.front || '').trim(),
                back: String(t.back || '').trim()
            }));
            changes.tags = tags;
            changes.pet_name = this.petNamesOf(tags) || null;
            changes.ring_colour = this.commonRingColour(tags) || null;
        }
        if (values.paymentMethod === 'paynow' || values.paymentMethod === 'cash') changes.payment_method = values.paymentMethod;
        return this.updateOrderFields(purchaseId, changes);
    }

    /** Shrink a camera photo before upload: about 1600px on the long side, well under the bucket limit. */
    async prepareOrderPhoto(file) {
        const MAX_SIDE = 1600;
        const TARGET_BYTES = 450 * 1024;
        const HARD_LIMIT = 4 * 1024 * 1024;

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (error) {
            throw new Error('That photo could not be read. Take it again or pick a JPG or PNG.');
        }
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        if (bitmap.close) bitmap.close();

        const toBlob = (quality) => new Promise((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('That photo could not be processed. Take it again.'))), 'image/jpeg', quality);
        });
        let blob = await toBlob(0.82);
        for (const quality of [0.72, 0.62, 0.5]) {
            if (blob.size <= TARGET_BYTES) break;
            blob = await toBlob(quality);
        }
        if (blob.size > HARD_LIMIT) throw new Error('That photo is too large to save. Take it again from a little further back.');
        return blob;
    }

    orderPhotoPath(orderId, dateLike, index) {
        return `${this.invoiceFolderFor(dateLike)}/${orderId}-${Date.now()}-${index}.jpg`;
    }

    /** Upload photo blobs for an order and return the storage paths that succeeded. */
    async uploadOrderPhotos(orderId, dateLike, blobs) {
        const client = await this.getSupabaseClient();
        if (!client) throw new Error('Not connected to storage');
        const saved = [];
        for (let i = 0; i < blobs.length; i++) {
            const path = this.orderPhotoPath(orderId, dateLike, i + 1);
            const { error } = await client.storage.from('order-photos').upload(path, blobs[i], { contentType: 'image/jpeg', upsert: false });
            if (error) throw new Error(error.message);
            saved.push(path);
        }
        return saved;
    }

    async addPhotoToPurchase(purchaseId, file) {
        const id = String(purchaseId || '');
        const purchase = this.purchaseCache.get(id);
        if (!purchase || !file) return;
        const addBtn = document.getElementById('detail-photo-add');
        if (addBtn) { addBtn.disabled = true; addBtn.innerHTML = iconSvg('camera') + ' Saving photo…'; }
        try {
            const blob = await this.prepareOrderPhoto(file);
            const [path] = await this.uploadOrderPhotos(purchase.order_id, purchase.created_at, [blob]);
            const client = await this.getSupabaseClient();
            const nextPaths = [...(Array.isArray(purchase.photo_paths) ? purchase.photo_paths : []), path];
            const { data, error } = await client.from('orders').update({ photo_paths: nextPaths }).eq('id', id).select('*').single();
            if (error || !data) throw new Error(error ? error.message : 'The order was not found.');
            this.purchaseCache.set(id, data);
            this.allPurchases = (this.allPurchases || []).map((p) => (String(p.id) === id ? data : p));
            if (String(this.selectedPurchaseId) === id && !this.editingPurchase) this.renderPurchaseDetails(data);
            ui.showToast('Photo added to invoice #' + purchase.order_id + '.', 'success');
        } catch (error) {
            console.error('Could not add photo:', error);
            ui.showToast('The photo was not saved: ' + (error.message || 'unknown error') + '. Try again.', 'error');
            if (addBtn) { addBtn.disabled = false; addBtn.innerHTML = iconSvg('camera') + ' Add photo'; }
        }
    }

    // ---- Excel export
    /** First and last day (yyyy-mm-dd, Singapore time) for an export range, or nulls for everything. */
    exportRangeBounds(range, customFrom, customTo) {
        const today = this.invoiceFolderFor(new Date());
        const [y, m, d] = today.split('-').map(Number);
        const iso = (date) => date.toISOString().slice(0, 10);
        if (range === 'today') return { from: today, to: today };
        if (range === 'week') {
            const noon = new Date(Date.UTC(y, m - 1, d, 12));
            const sinceMonday = (noon.getUTCDay() + 6) % 7;
            noon.setUTCDate(noon.getUTCDate() - sinceMonday);
            return { from: iso(noon), to: today };
        }
        if (range === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
        if (range === 'custom') {
            let from = customFrom || null;
            let to = customTo || null;
            if (from && to && from > to) [from, to] = [to, from];
            return { from, to };
        }
        return { from: null, to: null };
    }

    purchasesInRange(bounds) {
        const all = Array.isArray(this.allPurchases) ? this.allPurchases : [];
        return all
            .filter((p) => {
                const day = p.created_at ? this.invoiceFolderFor(p.created_at) : '';
                if (bounds.from && (!day || day < bounds.from)) return false;
                if (bounds.to && (!day || day > bounds.to)) return false;
                return true;
            })
            .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    }

    /** Excel serial date and day-fraction time for an order, in Singapore time. */
    excelDateParts(dateLike) {
        const { date, time } = this.sgtParts(dateLike);
        if (!date) return { serial: '', fraction: '' };
        const [y, m, d] = date.split('-').map(Number);
        const [hh, mm] = time.split(':').map(Number);
        return { serial: Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569, fraction: ((hh * 60) + mm) / 1440 };
    }

    buildExportSheets(purchases, layout) {
        const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
        // A voided order stays in the file, marked Void, with its amounts left at zero so totals stay right.
        const live = (p, value) => (this.isVoid(p) ? 0 : value);
        const statusText = (p) => (POSApp.STATUS_LABELS[p.status] ? this.statusLabel(p.status) : '');
        const notesText = (p) => {
            const base = String(p.customer_comment || '');
            if (!this.isVoid(p)) return base;
            const was = `VOID${p.void_reason ? ': ' + p.void_reason : ''} (original total ${this.formatCurrency(p.total)})`;
            return base ? `${was}\n${base}` : was;
        };
        const sheets = [];

        if (layout === 'orders' || layout === 'both') {
            sheets.push({
                name: 'Invoices',
                columns: [
                    { header: 'Order no.', width: 11 },
                    { header: 'Date', width: 13, type: 'date' },
                    { header: 'Time', width: 8, type: 'time' },
                    { header: 'Status', width: 12 },
                    { header: 'How', width: 17 },
                    { header: 'Payment', width: 10 },
                    { header: 'Owner name', width: 22 },
                    { header: "Pet's name", width: 22 },
                    { header: 'Colour of ring', width: 15 },
                    { header: 'Engraving (front / back)', width: 36, type: 'wrap' },
                    { header: 'Phone', width: 13 },
                    { header: 'Email', width: 30 },
                    { header: 'Address', width: 40, type: 'wrap' },
                    { header: 'Items', width: 34, type: 'wrap' },
                    { header: 'Qty', width: 6, type: 'number' },
                    { header: 'Subtotal', width: 11, type: 'money' },
                    { header: 'Discount', width: 11, type: 'money' },
                    { header: 'Delivery', width: 11, type: 'money' },
                    { header: 'Total', width: 11, type: 'money' },
                    { header: 'Notes', width: 44, type: 'wrap' },
                    { header: 'Photos', width: 8, type: 'number' }
                ],
                rows: purchases.map((p) => {
                    const { serial, fraction } = this.excelDateParts(p.created_at);
                    const items = Array.isArray(p.items) ? p.items : [];
                    const tags = Array.isArray(p.tags) ? p.tags : [];
                    const engraving = tags.map((t) => `${t.pet_name || t.item || 'Tag'}: ${t.front || '-'} / ${t.back || '-'}`).join('\n');
                    return [
                        String(p.order_id || ''), serial, fraction,
                        statusText(p), this.fulfilmentLabel(p.fulfilment), this.paymentLabel(p.payment_method),
                        this.ownerNameOf(p), String(p.pet_name || ''), this.ringColourLabel(p.ring_colour), engraving,
                        String(p.customer_phone || ''), String(p.customer_email || ''), String(p.address || ''),
                        items.map((item) => `${Number(item.quantity) || 0} x ${item.name || ''}`).join('\n'),
                        live(p, this.purchaseItemCount(p)),
                        money(live(p, p.subtotal)), money(live(p, p.discount_amount)), money(live(p, p.delivery_fee)), money(live(p, p.total)),
                        notesText(p),
                        Array.isArray(p.photo_paths) ? p.photo_paths.length : 0
                    ];
                }),
                totals: ['Total', null, null, null, null, null, null, null, null, null, null, null, null, null, { sum: true }, { sum: true }, { sum: true }, { sum: true }, { sum: true }, null, null]
            });
        }

        if (layout === 'items' || layout === 'both') {
            // One row per item sold; tags that carry engraving details get one row each.
            const rows = [];
            purchases.forEach((p) => {
                const { serial } = this.excelDateParts(p.created_at);
                const tags = Array.isArray(p.tags) ? p.tags : [];
                (Array.isArray(p.items) ? p.items : []).forEach((item) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.price) || 0;
                    const itemTags = tags.filter((t) => t.item === item.name);
                    const common = [String(p.order_id || ''), serial, statusText(p), this.paymentLabel(p.payment_method), this.ownerNameOf(p)];
                    const tail = [String(p.address || ''), notesText(p)];
                    if (itemTags.length > 0) {
                        itemTags.forEach((t) => {
                            rows.push([...common, String(item.name || ''), String(t.pet_name || ''), this.ringColourLabel(t.ring_colour), String(t.front || ''), String(t.back || ''),
                                live(p, 1), money(price), money(live(p, price)), ...tail]);
                        });
                    } else {
                        rows.push([...common, String(item.name || ''), String(p.pet_name || ''), this.ringColourLabel(p.ring_colour), '', '',
                            live(p, qty), money(price), money(live(p, item.subtotal != null ? item.subtotal : qty * price)), ...tail]);
                    }
                });
            });
            sheets.push({
                name: 'Items',
                columns: [
                    { header: 'Order no.', width: 11 },
                    { header: 'Date', width: 13, type: 'date' },
                    { header: 'Status', width: 12 },
                    { header: 'Payment', width: 10 },
                    { header: 'Owner name', width: 22 },
                    { header: 'Item', width: 28 },
                    { header: "Pet's name", width: 22 },
                    { header: 'Colour of ring', width: 15 },
                    { header: 'Front', width: 24 },
                    { header: 'Back', width: 24 },
                    { header: 'Qty', width: 6, type: 'number' },
                    { header: 'Price', width: 10, type: 'money' },
                    { header: 'Subtotal', width: 11, type: 'money' },
                    { header: 'Address', width: 40, type: 'wrap' },
                    { header: 'Notes', width: 44, type: 'wrap' }
                ],
                rows,
                totals: ['Total', null, null, null, null, null, null, null, null, null, { sum: true }, null, { sum: true }, null, null]
            });
        }
        return sheets;
    }

    readExportChoices() {
        const checked = (name, fallback) => {
            const el = document.querySelector(`input[name="${name}"]:checked`);
            return el ? el.value : fallback;
        };
        const range = checked('export-range', 'all');
        const layout = checked('export-layout', 'orders');
        const fromEl = document.getElementById('export-from');
        const toEl = document.getElementById('export-to');
        const bounds = this.exportRangeBounds(range, fromEl ? fromEl.value : '', toEl ? toEl.value : '');
        return { range, layout, bounds };
    }

    updateExportSummary() {
        const summaryEl = document.getElementById('export-summary');
        const datesEl = document.getElementById('export-dates');
        const downloadBtn = document.getElementById('export-download');
        const { range, bounds } = this.readExportChoices();
        if (datesEl) datesEl.classList.toggle('hidden', range !== 'custom');
        const count = this.purchasesInRange(bounds).length;
        if (summaryEl) summaryEl.textContent = count === 0 ? 'No invoices in that range.' : `${count} ${count === 1 ? 'invoice' : 'invoices'} will be exported.`;
        if (downloadBtn) downloadBtn.disabled = count === 0;
    }

    async openExportDialog() {
        const dialog = document.getElementById('export-dialog');
        if (!dialog) return;
        if (!this.purchasesLoaded) await this.reloadPurchases();
        this.updateExportSummary();
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
    }

    closeExportDialog() {
        const dialog = document.getElementById('export-dialog');
        if (!dialog) return;
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
    }

    downloadExport() {
        const { layout, bounds } = this.readExportChoices();
        const purchases = this.purchasesInRange(bounds);
        if (purchases.length === 0) return;
        try {
            if (!window.XlsxLite) throw new Error('The export tool did not load. Refresh the page and try again');
            const blob = window.XlsxLite.build(this.buildExportSheets(purchases, layout));
            const today = this.invoiceFolderFor(new Date());
            const span = bounds.from || bounds.to
                ? `${bounds.from || 'start'}_to_${bounds.to || today}`
                : `all_to_${today}`;
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `WoofCrafts_Orders_${span}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            this.closeExportDialog();
            ui.showToast(`Exported ${purchases.length} ${purchases.length === 1 ? 'invoice' : 'invoices'} to Excel.`, 'success');
        } catch (error) {
            console.error('Export failed:', error);
            ui.showToast((error.message || 'The export failed') + '.', 'error');
        }
    }

    setupPurchaseTabs() {
        const posBtn = document.getElementById('pos-tab-btn');
        const purchasesBtn = document.getElementById('purchases-tab-btn');
        const viewPos = document.getElementById('view-pos');
        const viewPurchases = document.getElementById('view-purchases');

        if (!posBtn || !purchasesBtn || !viewPos || !viewPurchases) return;

        const setActive = (active) => {
            const isPos = active === 'pos';
            viewPos.classList.toggle('hidden', !isPos);
            viewPurchases.classList.toggle('hidden', isPos);
            document.body.classList.toggle('purchases-open', !isPos);
            if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);

            posBtn.setAttribute('aria-selected', String(isPos));
            purchasesBtn.setAttribute('aria-selected', String(!isPos));
        };

        posBtn.addEventListener('click', () => setActive('pos'));
        purchasesBtn.addEventListener('click', async () => {
            setActive('purchases');
            // Always reload: a sale made a minute ago has to be in the list.
            if (!this.editingPurchase) await this.reloadPurchases();
        });

        const on = (id, type, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(type, handler);
        };

        on('purchases-refresh-btn', 'click', () => this.reloadPurchases());
        on('export-open-btn', 'click', () => this.openExportDialog());
        on('make-list-btn', 'click', () => this.showMakeList());
        on('status-filters', 'click', (event) => {
            const chip = event.target && event.target.closest ? event.target.closest('[data-status-filter]') : null;
            if (!chip) return;
            this.statusFilter = chip.getAttribute('data-status-filter') || 'all';
            this.renderPurchasesList();
        });
        on('export-cancel', 'click', () => this.closeExportDialog());
        on('export-download', 'click', () => this.downloadExport());
        on('export-form', 'change', () => this.updateExportSummary());
        on('purchases-search', 'input', (event) => {
            this.purchaseSearch = event.target.value || '';
            this.renderPurchasesList();
        });

        on('purchases-list', 'click', async (event) => {
            const target = event.target && event.target.closest ? event.target : null;
            if (!target) return;
            if (target.closest('#purchases-retry-btn')) { this.reloadPurchases(); return; }
            if (target.closest('#purchases-search-clear')) {
                this.purchaseSearch = '';
                this.statusFilter = 'all';
                const searchEl = document.getElementById('purchases-search');
                if (searchEl) searchEl.value = '';
                this.renderPurchasesList();
                return;
            }
            const row = target.closest('[data-purchase-id]');
            if (!row) return;
            if (this.editingPurchase && !(await ui.confirm('Leave without saving your changes to this invoice?', 'Unsaved changes'))) return;
            try {
                await this.showPurchaseDetails(row.getAttribute('data-purchase-id'));
            } catch (error) {
                console.error('Error showing purchase details:', error);
                ui.showToast('Could not load this purchase. Check the connection and try again.', 'error');
            }
        });

        on('purchase-details', 'click', async (event) => {
            const target = event.target && event.target.closest ? event.target : null;
            if (!target) return;
            const id = this.selectedPurchaseId;
            const purchase = id ? this.purchaseCache.get(String(id)) : null;

            if (target.closest('#purchase-back-btn')) {
                if (this.editingPurchase && !(await ui.confirm('Leave without saving your changes to this invoice?', 'Unsaved changes'))) return;
                if (this.editingPurchase && purchase) this.renderPurchaseDetails(purchase);
                this.closePurchaseDetails();
                return;
            }
            if (target.closest('#makelist-print')) { window.print(); return; }
            const madeBtn = target.closest('.makelist-made');
            if (madeBtn) {
                madeBtn.disabled = true;
                try {
                    await this.setTagMade(madeBtn.getAttribute('data-purchase-id'), Number(madeBtn.getAttribute('data-tag-index')), true);
                } catch (error) {
                    madeBtn.disabled = false;
                    ui.showToast('Not saved: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
                }
                return;
            }
            const openBtn = target.closest('[data-open-purchase]');
            if (openBtn) { await this.showPurchaseDetails(openBtn.getAttribute('data-open-purchase')); return; }
            if (!purchase) return;
            if (target.closest('#purchase-edit-btn')) { this.renderPurchaseDetails(purchase, { editing: true }); return; }
            if (target.closest('#purchase-edit-cancel')) { this.renderPurchaseDetails(purchase); return; }
            if (target.closest('#detail-photo-add')) {
                const input = document.getElementById('detail-photo-input');
                if (input) input.click();
                return;
            }
            const ringBtn = target.closest('#edit-ring-colour .seg-btn, .edit-tag-ring .seg-btn');
            if (ringBtn) {
                const group = ringBtn.parentElement;
                const wasPressed = ringBtn.getAttribute('aria-pressed') === 'true';
                group.querySelectorAll('.seg-btn').forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
                ringBtn.setAttribute('aria-pressed', String(!wasPressed));
                return;
            }
            const payBtn = target.closest('#edit-payment .seg-btn');
            if (payBtn) {
                payBtn.parentElement.querySelectorAll('.seg-btn').forEach((btn) => btn.setAttribute('aria-pressed', String(btn === payBtn)));
                return;
            }
            const guard = async (work) => {
                try { await work(); } catch (error) {
                    console.error('Could not update the order:', error);
                    ui.showToast('Not saved: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
                }
            };
            const advance = target.closest('#status-advance');
            if (advance) { advance.disabled = true; await guard(() => this.changeStatus(id, advance.getAttribute('data-next'))); advance.disabled = false; return; }
            if (target.closest('#void-open')) { this.renderPurchaseDetails(purchase, { voiding: true }); return; }
            if (target.closest('#void-cancel')) { this.renderPurchaseDetails(purchase); return; }
            if (target.closest('#void-confirm')) {
                const reason = (document.getElementById('void-reason')?.value || '').trim();
                await guard(() => this.changeStatus(id, 'void', { void_reason: reason || null }));
            }
        });

        on('purchase-details', 'change', async (event) => {
            const target = event.target;
            if (!target || !target.matches) return;
            const id = this.selectedPurchaseId;
            if (target.matches('#status-set') && target.value && id) {
                const value = target.value;
                target.value = '';
                try { await this.changeStatus(id, value); } catch (error) {
                    ui.showToast('Not saved: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
                }
            }
            if (target.matches('.tag-made-input') && id) {
                try { await this.setTagMade(id, Number(target.getAttribute('data-tag-index')), target.checked); } catch (error) {
                    target.checked = !target.checked;
                    ui.showToast('Not saved: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
                }
            }
        });

        on('purchase-details', 'submit', async (event) => {
            if (!event.target || event.target.id !== 'purchase-edit-form') return;
            event.preventDefault();
            const id = this.selectedPurchaseId;
            const saveBtn = document.getElementById('purchase-edit-save');
            const value = (fieldId) => { const el = document.getElementById(fieldId); return el ? el.value : ''; };
            const pressed = document.querySelector('#edit-ring-colour .seg-btn[aria-pressed="true"]');
            const tagFieldsets = Array.from(document.querySelectorAll('#purchase-edit-form .edit-tag'));
            const editedTags = tagFieldsets.length ? tagFieldsets.map((fs) => {
                const field = (name) => { const el = fs.querySelector(`[data-field="${name}"]`); return el ? el.value : ''; };
                const ringBtnOn = fs.querySelector('.edit-tag-ring .seg-btn[aria-pressed="true"]');
                return { pet_name: field('pet_name'), front: field('front'), back: field('back'), ring_colour: ringBtnOn ? ringBtnOn.getAttribute('data-ring') : '' };
            }) : undefined;
            const payBtn = document.querySelector('#edit-payment .seg-btn[aria-pressed="true"]');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = iconSvg('check') + ' Saving…'; }
            try {
                const updated = await this.savePurchaseEdits(id, {
                    ownerName: value('edit-owner-name'),
                    petName: value('edit-pet-name'),
                    ringColour: pressed ? pressed.getAttribute('data-ring') : '',
                    address: value('edit-address'),
                    notes: value('edit-notes'),
                    tags: editedTags,
                    paymentMethod: payBtn ? payBtn.getAttribute('data-payment') : ''
                });
                this.renderPurchasesList();
                this.renderPurchaseDetails(updated);
                ui.showToast('Invoice #' + (updated.order_id || '') + ' updated.', 'success');
            } catch (error) {
                console.error('Could not save invoice edits:', error);
                ui.showToast('Your changes were not saved: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
                if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = iconSvg('check') + ' Save changes'; }
            }
        });

        on('detail-photo-input', 'change', async (event) => {
            const file = event.target.files && event.target.files[0];
            event.target.value = '';
            if (file && this.selectedPurchaseId) await this.addPhotoToPurchase(this.selectedPurchaseId, file);
        });
    }

    async refreshProducts() {
        // Force reload products and re-render
        console.log('Refreshing products...');
        await this.loadProducts();
        this.renderProducts();
        console.log(`✓ Products refreshed: ${this.products.length} total`);
    }

    getFixedProducts() {
        // Fallback products with real image paths (just in case products.json doesn't load)
        return [
            // PET TAG Category
            {
                id: 1,
                name: 'Big Identification Tag',
                price: 35.00,
                category: 'tags',
                image: 'assets/Dog product images/Big Identification Tag.jpg',
                description: 'Large identification tag for your furry friend'
            },
            {
                id: 2,
                name: 'Small Identification Tag',
                price: 30.00,
                category: 'tags',
                image: 'assets/Dog product images/Small Identification Tag.jpg',
                description: 'Compact identification tag for smaller pets'
            },
            {
                id: 3,
                name: 'Big Alphabet Tag',
                price: 22.00,
                category: 'tags',
                image: 'assets/Dog product images/Big Alphabet Tag.jpg',
                description: 'Large alphabet-style pet tag'
            },
            {
                id: 4,
                name: 'Small Alphabet Tag',
                price: 20.00,
                category: 'tags',
                image: 'assets/Dog product images/Small Alphabet Tag.jpg',
                description: 'Small alphabet-style pet tag'
            },
            // ADD ONS Category
            {
                id: 5,
                name: 'NFC',
                price: 5.00,
                category: 'addons',
                image: 'assets/Dog product images/Charms.jpg',
                description: 'NFC chip addon for smart pet tracking'
            },
            {
                id: 6,
                name: 'Charms',
                price: 4.00,
                category: 'addons',
                image: 'assets/Dog product images/Charms.jpg',
                description: 'Decorative charms for pet accessories'
            },
            {
                id: 7,
                name: 'Photo Stand',
                price: 10.00,
                category: 'addons',
                image: 'assets/Dog product images/Photo Stand.jpg',
                description: 'Display stand for your pet\'s photo'
            },
            // CHRISTMAS SPECIALS Category
            {
                id: 8,
                name: 'Christmas Tag',
                price: 25.00,
                category: 'christmas',
                image: 'assets/Dog product images/Christmas Tag – Brown.jpg',
                description: 'Festive Christmas-themed pet tag'
            },
            {
                id: 9,
                name: 'Christmas Socks',
                price: 20.00,
                category: 'christmas',
                image: 'assets/Dog product images/Christmas Socks Ornament.jpg',
                description: 'Holiday socks ornament for your pet'
            },
            {
                id: 10,
                name: 'Christmas Photoframe',
                price: 15.00,
                category: 'christmas',
                image: 'assets/Dog product images/Christmas Photo Frame.jpg',
                description: 'Festive photo frame for pet pictures'
            },
            // PROMOTION - 3 Charms Option
            {
                id: 11,
                name: '3 Charms',
                price: 10.00,
                category: 'promotion',
                image: 'assets/Dog product images/3 Charms.jpg',
                description: 'Special set of 3 charms - promotional offer'
            }
        ];
    }
    
    initializeDefaultProducts() {
        // This method is kept for backward compatibility but is no longer used
        // Fixed products are now always included via getFixedProducts()
        this.products = this.getFixedProducts();
        localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
    }

    loadCart() {
        const storedCart = localStorage.getItem('woofcrafts_cart');
        if (storedCart) {
            try {
                this.cart = JSON.parse(storedCart);
                if (!Array.isArray(this.cart)) {
                    this.cart = [];
                }
            } catch (e) {
                console.warn('Corrupted cart data in localStorage, resetting:', e);
                this.cart = [];
                localStorage.removeItem('woofcrafts_cart');
            }
        }
    }

    saveCart() {
        localStorage.setItem('woofcrafts_cart', JSON.stringify(this.cart));
    }

    renderCategoryFilter(products) {
        const filterEl = document.getElementById('category-filter');
        if (!filterEl) return;

        const seen = new Map();
        products.forEach((product) => {
            const key = String(product.category || 'general').toLowerCase();
            if (!seen.has(key)) seen.set(key, key.charAt(0).toUpperCase() + key.slice(1));
        });

        // A filter only helps when there is something to choose between.
        if (seen.size < 2) {
            filterEl.innerHTML = '';
            filterEl.classList.add('hidden');
            this.activeCategory = 'all';
            return;
        }
        if (this.activeCategory !== 'all' && !seen.has(this.activeCategory)) this.activeCategory = 'all';

        const chip = (key, label) =>
            `<button type="button" class="chip" data-category="${escapeHtml(key)}" aria-pressed="${this.activeCategory === key}">${escapeHtml(label)}</button>`;
        filterEl.classList.remove('hidden');
        filterEl.innerHTML = chip('all', 'All') + Array.from(seen, ([key, label]) => chip(key, label)).join('');
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');

        if (!grid) {
            console.error('Products grid element not found');
            return;
        }

        // Filter out any invalid products
        const validProducts = this.products.filter(product => product && product.id && product.name);
        this.renderCategoryFilter(validProducts);

        if (this.loadError) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('alert')}</span>
                    <p>Products did not load</p>
                    <p class="empty-state-note">${escapeHtml(this.loadError)}</p>
                    <button type="button" class="btn-secondary" id="retry-products-btn">${iconSvg('refresh')} Try again</button>
                </div>
            `;
            const retry = document.getElementById('retry-products-btn');
            if (retry) retry.addEventListener('click', async () => {
                retry.disabled = true;
                await this.loadProducts();
                this.renderProducts();
            });
            return;
        }

        if (validProducts.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('box')}</span>
                    <p>No products yet</p>
                    <a href="products.html" class="empty-link">Add a product</a>
                </div>
            `;
            return;
        }

        const visibleProducts = this.activeCategory === 'all'
            ? validProducts
            : validProducts.filter(p => String(p.category || 'general').toLowerCase() === this.activeCategory);

        grid.innerHTML = visibleProducts.map(product => {
            const productName = escapeHtml(product.name || '');
            let imageSrc = safeImageSrc(product.image) || PLACEHOLDER_IMAGE;
            if (!imageSrc) imageSrc = PLACEHOLDER_IMAGE;

            const safeId = JSON.stringify(product.id);
            return `
                <div class="product-card" onclick='safeAddToCart(${safeId})'>
                    <div class="product-media">
                        <img src="${escapeHtml(imageSrc)}" alt="${productName}" class="product-image" loading="lazy" decoding="async"
                             onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE}'">
                        <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
                    </div>
                    <div class="product-name">${productName}</div>
                    <button type="button" class="quick-add-btn" onclick='event.stopPropagation(); safeAddToCart(${safeId})' aria-label="Add ${productName} to cart" title="Add to cart">${iconSvg('plus')}</button>
                </div>
            `;
        }).join('');
    }

    addToCart(productId) {
        try {
            // Normalize ID: support both numeric and string IDs from products.json vs form-added products
            const normalizedId = (typeof productId === 'string' && /^\d+$/.test(productId))
                ? parseInt(productId, 10) : productId;

            const product = this.products.find(p => p.id == normalizedId || String(p.id) === String(normalizedId));
        if (!product) {
            ui.showToast('Product not found. Refresh the page and try again.', 'error');
            return;
        }

            const existingItem = this.cart.find(item => item.productId == normalizedId || String(item.productId) === String(normalizedId));
            
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                this.cart.push({
                    productId: product.id,
                    name: product.name,
                    price: parseFloat(product.price),
                    image: product.image,
                    quantity: 1,
                    needsDetails: !!product.needsDetails,
                    tags: []
                });
            }
            this.syncCartTags();

            this.saveCart();
            this.renderCart();
            
            // Visual feedback
            ['cart-count', 'cart-bar-count'].forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.style.animation = 'none';
                setTimeout(() => { el.style.animation = 'scaleIn 0.25s'; }, 10);
            });
        } catch (error) {
            console.error('❌ Error in addToCart:', error);
            ui.showToast('Could not add the item: ' + error.message, 'error');
        }
    }

    removeFromCart(productId) {
        const normalizedId = (typeof productId === 'string' && /^\d+$/.test(productId))
            ? parseInt(productId, 10) : productId;
        this.cart = this.cart.filter(item => item.productId != normalizedId && String(item.productId) !== String(normalizedId));
        this.saveCart();
        this.renderCart();
    }

    updateQuantity(productId, change) {
        const normalizedId = (typeof productId === 'string' && /^\d+$/.test(productId))
            ? parseInt(productId, 10) : productId;
        const item = this.cart.find(i => i.productId == normalizedId || String(i.productId) === String(normalizedId));
        if (!item) return;

        item.quantity += change;
        if (item.quantity <= 0) {
            this.removeFromCart(productId);
        } else {
            this.syncCartTags();
            this.saveCart();
            this.renderCart();
        }
    }

    renderCart() {
        this.syncCartTags();
        this.renderCartList();
        this.afterCartChange();
    }

    renderCartList() {
        const cartItems = document.getElementById('cart-items');
        const cartCount = document.getElementById('cart-count');
        
        // Update cart count badge
        const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
        if (cartCount) {
            cartCount.textContent = totalItems;
        }
        const cartBarCount = document.getElementById('cart-bar-count');
        if (cartBarCount) cartBarCount.textContent = totalItems;
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <span class="empty-cart-icon">${iconSvg('cart')}</span>
                    <p>Your cart is empty</p>
                    <p class="empty-cart-hint">Tap a product to add it.</p>
                </div>
            `;
            this.updateTotals();
            return;
        }

        const safeId = (id) => JSON.stringify(id);
        cartItems.innerHTML = this.cart.map(item => {
            const subtotal = item.price * item.quantity;
            const itemName = escapeHtml(item.name || '');
            const imageSrc = safeImageSrc(item.image) || PLACEHOLDER_THUMB;
            return `
                <div class="cart-item">
                    <img src="${escapeHtml(imageSrc)}" alt="${itemName}" class="cart-item-thumbnail" 
                         onerror="this.src='${PLACEHOLDER_THUMB}'">
                    <div class="cart-item-main">
                        <div class="cart-item-details">
                            <div class="cart-item-name">${itemName}</div>
                            <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
                        </div>
                        <div class="cart-item-controls">
                            <button type="button" class="quantity-btn" aria-label="Remove one ${itemName}" onclick='(window.posApp || posApp).updateQuantity(${safeId(item.productId)}, -1)'>${iconSvg('minus')}</button>
                            <span class="quantity-display">${item.quantity}</span>
                            <button type="button" class="quantity-btn" aria-label="Add one ${itemName}" onclick='(window.posApp || posApp).updateQuantity(${safeId(item.productId)}, 1)'>${iconSvg('plus')}</button>
                        </div>
                        <div class="cart-item-total">$${subtotal.toFixed(2)}</div>
                        <button type="button" class="remove-btn" aria-label="Remove ${itemName} from cart" onclick='(window.posApp || posApp).removeFromCart(${safeId(item.productId)})' title="Remove">${iconSvg('trash')}</button>
                    </div>
                </div>
            `;
        }).join('');

        this.updateTotals();
    }

    calculateSubtotal() {
        return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    /** Tap once to take 5% off, tap again to remove it. */
    applyDiscount() {
        if (this.discountApplied) { this.clearDiscount(); return; }
        if (this.cart.length === 0) return;

        this.discountApplied = true;
        this.updateTotals();

        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) {
            discountBtn.setAttribute('aria-pressed', 'true');
            discountBtn.innerHTML = iconSvg('check') + ' 5% discount on. Tap to remove';
        }
    }

    clearDiscount() {
        this.discountApplied = false;
        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) {
            discountBtn.disabled = false;
            discountBtn.setAttribute('aria-pressed', 'false');
            discountBtn.innerHTML = iconSvg('percent') + ' Apply 5% discount';
        }
        this.updateTotals();
    }

    // ---- Order details: ring colour, address, photos
    // ---- Round 2: how the customer gets it, engraving details per tag, payment
    static get FULFILMENT_INFO() {
        return {
            taken_now: { label: 'Taken now', note: 'Handed over now. No delivery fee. Name and phone are optional.' },
            collect: { label: 'Collect at booth', note: 'The customer comes back for it. We need a name and phone to tell them when it is ready.' },
            delivery: { label: 'Delivery', note: 'Posted to the customer. Delivery fee applies. Needs a name, phone and address.' }
        };
    }

    fulfilmentLabel(value) {
        const info = POSApp.FULFILMENT_INFO[value];
        return info ? info.label : '';
    }

    paymentLabel(value) {
        return value === 'paynow' ? 'PayNow' : value === 'cash' ? 'Cash' : '';
    }

    productNeedsDetails(item) {
        if (typeof item.needsDetails === 'boolean') return item.needsDetails;
        const product = this.products.find((p) => String(p.id) === String(item.productId));
        if (product && typeof product.needsDetails === 'boolean') return product.needsDetails;
        return /tag/i.test(String(item.name || ''));
    }

    /** Keeps one engraving card per unit of every product that needs details. */
    syncCartTags() {
        this.cart.forEach((item) => {
            item.needsDetails = this.productNeedsDetails(item);
            if (!item.needsDetails) { item.tags = []; return; }
            if (!Array.isArray(item.tags)) item.tags = [];
            while (item.tags.length < item.quantity) item.tags.push({ pet: '', ring: '', front: '', back: '' });
            if (item.tags.length > item.quantity) item.tags.length = item.quantity;
        });
    }

    cartHasTags() {
        return this.cart.some((item) => item.needsDetails && item.tags && item.tags.length > 0);
    }

    afterCartChange() {
        if (!this.fulfilmentTouched) {
            this.setFulfilment(this.cart.length === 0 ? 'collect' : (this.cartHasTags() ? 'collect' : 'taken_now'), false);
        }
        this.renderTagDetails();
        this.updateSendButton();
    }

    setFulfilment(value, touched = true) {
        if (!POSApp.FULFILMENT_INFO[value]) return;
        if (touched) this.fulfilmentTouched = true;
        this.fulfilment = value;
        this.deliveryEnabled = value === 'delivery';
        document.querySelectorAll('#fulfilment .seg-btn').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(btn.getAttribute('data-fulfilment') === value));
        });
        const note = document.getElementById('fulfilment-note');
        if (note) note.textContent = POSApp.FULFILMENT_INFO[value].note;
        const needsContact = value !== 'taken_now';
        [['customer-name-opt'], ['customer-phone-opt']].forEach(([id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = needsContact ? '(required)' : '(optional)';
            el.classList.toggle('is-required', needsContact);
        });
        this.clearFormErrors();
        this.updateTotals();
        this.syncAddressField();
    }

    setPaymentMethod(value) {
        this.paymentMethod = value === 'paynow' || value === 'cash' ? value : '';
        document.querySelectorAll('#payment-method .seg-btn').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(btn.getAttribute('data-payment') === this.paymentMethod));
        });
        this.setInlineError('payment-error', '');
    }

    updateSendButton() {
        const btn = document.getElementById('send-email-btn');
        if (!btn || btn.disabled) return;
        const hasEmail = Boolean((document.getElementById('customer-email')?.value || '').trim());
        btn.innerHTML = hasEmail ? iconSvg('mail') + ' Send invoice' : iconSvg('check') + ' Save order';
    }

    setInlineError(errorId, message, inputId) {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
            errorEl.textContent = message || '';
            errorEl.classList.toggle('hidden', !message);
        }
        const inputEl = inputId ? document.getElementById(inputId) : null;
        if (inputEl) {
            if (message) inputEl.setAttribute('aria-invalid', 'true');
            else if (inputEl.removeAttribute) inputEl.removeAttribute('aria-invalid');
        }
    }

    clearFormErrors() {
        this.setInlineError('customer-name-error', '', 'customer-name');
        this.setInlineError('customer-phone-error', '', 'customer-phone');
        this.setInlineError('payment-error', '');
        this.setFieldError('');
    }

    /** All the engraving details in the cart, one entry per tag, in cart order. */
    collectTags() {
        const tags = [];
        this.cart.forEach((item) => {
            if (!item.needsDetails || !Array.isArray(item.tags)) return;
            item.tags.forEach((tag, index) => {
                tags.push({
                    item: item.name,
                    number: index + 1,
                    of: item.quantity,
                    pet_name: String(tag.pet || '').trim(),
                    ring_colour: this.ringColourLabel(tag.ring) ? tag.ring : '',
                    front: String(tag.front || '').trim(),
                    back: String(tag.back || '').trim(),
                    made: false
                });
            });
        });
        return tags;
    }

    /** Names for the order list and search: "Milo, Luna". */
    petNamesOf(tags) {
        const seen = [];
        (tags || []).forEach((t) => {
            const name = String(t.pet_name || '').trim();
            if (name && !seen.some((n) => n.toLowerCase() === name.toLowerCase())) seen.push(name);
        });
        return seen.join(', ');
    }

    /** One ring colour for the whole order, only when every tag has the same one. */
    commonRingColour(tags) {
        if (!tags || tags.length === 0) return '';
        const first = tags[0].ring_colour || '';
        return first && tags.every((t) => t.ring_colour === first) ? first : '';
    }

    initialStatus(fulfilment, tags) {
        if (fulfilment === 'taken_now') return 'collected';
        return tags.length > 0 ? 'to_make' : 'made';
    }

    renderTagDetails() {
        const host = document.getElementById('tag-details');
        if (!host) return;
        const hasTags = this.cartHasTags();
        if (!hasTags) { host.innerHTML = ''; return; }

        let flat = 0;
        const cards = [];
        this.cart.forEach((item, ci) => {
            if (!item.needsDetails) return;
            item.tags.forEach((tag, ti) => {
                const id = `tag-${ci}-${ti}`;
                const blank = !String(tag.pet || '').trim() && !String(tag.front || '').trim() && !String(tag.back || '').trim();
                const ringBtns = [['silver', 'Silver'], ['gold', 'Gold'], ['gun metal', 'Gun metal']].map(([value, label]) =>
                    `<button type="button" class="seg-btn" data-ring="${value}" aria-pressed="${tag.ring === value}">${label}</button>`).join('');
                cards.push(`
                    <div class="tag-card" data-ci="${ci}" data-ti="${ti}">
                        <div class="tag-card-head">
                            <span class="tag-card-name">${escapeHtml(item.name)} <span class="tag-card-count">${item.quantity > 1 ? `(${ti + 1} of ${item.quantity})` : ''}</span></span>
                            ${flat > 0 ? '<button type="button" class="btn-secondary tag-copy-btn" data-act="copy">Same as tag above</button>' : ''}
                        </div>
                        <div class="input-group">
                            <label for="${id}-pet">Pet's name</label>
                            <input type="text" id="${id}-pet" class="input-field" data-field="pet" value="${escapeHtml(tag.pet || '')}" autocomplete="off" autocapitalize="words" enterkeyhint="next">
                        </div>
                        <div class="input-group">
                            <span class="group-label" id="${id}-ring-label">Colour of ring</span>
                            <div class="segmented" role="group" aria-labelledby="${id}-ring-label">${ringBtns}</div>
                        </div>
                        <div class="tag-card-text">
                            <div class="input-group">
                                <label for="${id}-front">Front</label>
                                <input type="text" id="${id}-front" class="input-field" data-field="front" value="${escapeHtml(tag.front || '')}" maxlength="80" autocomplete="off" enterkeyhint="next">
                            </div>
                            <div class="input-group">
                                <label for="${id}-back">Back</label>
                                <input type="text" id="${id}-back" class="input-field" data-field="back" value="${escapeHtml(tag.back || '')}" maxlength="80" autocomplete="off" enterkeyhint="next">
                            </div>
                        </div>
                        <p class="tag-card-warn${blank ? '' : ' hidden'}">No name or engraving text yet.</p>
                    </div>`);
                flat += 1;
            });
        });
        host.innerHTML = `<h4 class="tag-details-title">Engraving details</h4>${cards.join('')}`;
    }

    onTagInput(target) {
        const card = target.closest('.tag-card');
        const field = target.getAttribute('data-field');
        if (!card || !field) return;
        const item = this.cart[Number(card.getAttribute('data-ci'))];
        const tag = item && item.tags ? item.tags[Number(card.getAttribute('data-ti'))] : null;
        if (!tag) return;
        tag[field] = target.value;
        const blank = !String(tag.pet || '').trim() && !String(tag.front || '').trim() && !String(tag.back || '').trim();
        const warn = card.querySelector('.tag-card-warn');
        if (warn) warn.classList.toggle('hidden', !blank);
        this.saveCart();
    }

    onTagClick(target) {
        const card = target.closest('.tag-card');
        if (!card) return;
        const ci = Number(card.getAttribute('data-ci'));
        const ti = Number(card.getAttribute('data-ti'));
        const item = this.cart[ci];
        const tag = item && item.tags ? item.tags[ti] : null;
        if (!tag) return;

        const ringBtn = target.closest('.seg-btn[data-ring]');
        if (ringBtn) {
            const value = ringBtn.getAttribute('data-ring');
            tag.ring = tag.ring === value ? '' : value;   // tap again to clear
            card.querySelectorAll('.seg-btn[data-ring]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-ring') === tag.ring)));
            this.saveCart();
            return;
        }
        if (target.closest('[data-act="copy"]')) {
            // Copy from the tag shown just above this one (it may belong to another product).
            const flat = [];
            this.cart.forEach((it) => { if (it.needsDetails) (it.tags || []).forEach((t) => flat.push(t)); });
            const at = flat.indexOf(tag);
            const above = at > 0 ? flat[at - 1] : null;
            if (!above) return;
            tag.pet = above.pet;
            tag.ring = above.ring;
            this.saveCart();
            this.renderTagDetails();
        }
    }

    // ---- Validation, inline errors
    focusField(id) {
        const el = document.getElementById(id);
        if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* older browsers */ } }
        if (el && el.focus) el.focus({ preventScroll: true });
    }

    validateCheckout() {
        // Ensure hidden field is synced with the composer UI (local part + domain selection).
        this.updateCustomerEmailFromComposer();
        this.clearFormErrors();

        if (this.cart.length === 0) {
            ui.showToast('Add an item to the cart first.', 'error');
            return false;
        }

        const problems = [];   // { message, focusId }
        const needsContact = this.fulfilment !== 'taken_now';
        const name = (document.getElementById('customer-name')?.value || '').trim();
        const phone = (document.getElementById('customer-phone')?.value || '').trim();
        const email = (document.getElementById('customer-email')?.value || '').trim();

        if (needsContact && !name) {
            this.setInlineError('customer-name-error', 'Enter the owner name.', 'customer-name');
            problems.push({ message: 'Enter the owner name.', focusId: 'customer-name' });
        }
        if (needsContact && phone.replace(/\D/g, '').length < 7) {
            const message = phone ? 'Enter a full phone number.' : 'Enter a phone number so we can reach the customer.';
            this.setInlineError('customer-phone-error', message, 'customer-phone');
            problems.push({ message, focusId: 'customer-phone' });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            const message = 'Enter a valid email address, like name@gmail.com, or clear it.';
            this.setFieldError(message);
            problems.push({ message, focusId: 'customer-email-local' });
        }
        if (!this.paymentMethod) {
            this.setInlineError('payment-error', 'Choose PayNow or Cash.');
            problems.push({ message: 'Choose PayNow or Cash.', focusId: 'payment-method' });
        }

        if (problems.length) {
            ui.showToast(problems[0].message, 'error');
            const first = problems[0].focusId;
            if (first === 'payment-method') {
                const group = document.getElementById('payment-method');
                if (group && group.scrollIntoView) { try { group.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* older browsers */ } }
            } else {
                this.focusField(first);
            }
            return false;
        }
        return true;
    }

    // ---- "Order saved" screen
    showOrderDone(info) {
        const dialog = document.getElementById('order-done');
        const body = document.getElementById('order-done-body');
        if (!dialog || !body) return;
        const row = (state, text) => `<li><span class="${state}">${iconSvg(state === 'ok' ? 'check' : state === 'bad' ? 'alert' : 'minus')}</span><span>${escapeHtml(text)}</span></li>`;
        const steps = [];
        steps.push(row('ok', `Order saved to ${info.where}`));
        steps.push(info.pdfFiled ? row('ok', 'Invoice PDF filed') : row('bad', 'Invoice PDF could not be filed'));
        if (info.email) steps.push(row('ok', `Invoice emailed to ${info.email}`));
        else steps.push(row('skip', 'No email given, so nothing was emailed'));
        if (info.photosAttempted) steps.push(info.photosSaved ? row('ok', 'Photo saved') : row('bad', 'Photo not saved. Add it again from Purchases'));
        const warn = info.problems.length > 0;
        const summary = [this.fulfilmentLabel(info.fulfilment), this.paymentLabel(info.paymentMethod)].filter(Boolean).join(' · ');
        body.innerHTML = `
            <div class="order-done-head">
                <span class="order-done-tick${warn ? ' is-warn' : ''}">${iconSvg(warn ? 'alert' : 'check')}</span>
                <h3 id="order-done-title">Order #${escapeHtml(info.orderId)} saved</h3>
                <p class="order-done-sub">$${Number(info.total).toFixed(2)} · ${escapeHtml(summary)}</p>
            </div>
            <ul class="order-done-steps">${steps.join('')}</ul>
            <div class="order-done-actions">
                ${info.email ? '' : '<button type="button" class="btn-secondary" id="order-done-share">Share invoice</button>'}
                <button type="button" class="btn-primary" id="order-done-new">New order</button>
            </div>`;
        const close = () => { if (dialog.open) dialog.close(); };
        const newBtn = document.getElementById('order-done-new');
        if (newBtn) newBtn.addEventListener('click', close);
        const shareBtn = document.getElementById('order-done-share');
        if (shareBtn) shareBtn.addEventListener('click', () => this.shareLastInvoice());
        if (!dialog.open) dialog.showModal();
        if (newBtn && newBtn.focus) newBtn.focus();
    }

    async shareLastInvoice() {
        const invoice = this.lastInvoice;
        if (!invoice) return;
        try {
            const binary = atob(invoice.pdfBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            const file = new File([bytes], invoice.fileName, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `WoofCrafts invoice #${invoice.orderId}` });
            } else {
                window.open(URL.createObjectURL(file), '_blank');
            }
        } catch (error) {
            if (error && error.name === 'AbortError') return;   // customer closed the share sheet
            ui.showToast('Could not share the invoice: ' + (error.message || 'unknown error'), 'error');
        }
    }

    /** The delivery address only matters when the order is being delivered. */
    syncAddressField() {
        const group = document.getElementById('address-group');
        if (group) group.classList.toggle('hidden', !this.deliveryEnabled);
    }

    renderOrderPhotos() {
        const strip = document.getElementById('order-photos');
        const btn = document.getElementById('order-photo-btn');
        const btnText = document.getElementById('order-photo-btn-text');
        const count = this.orderPhotos.length;
        if (strip) {
            strip.innerHTML = this.orderPhotos.map((photo, index) => `
                <div class="photo-thumb">
                    <img src="${escapeHtml(photo.url)}" alt="Order photo ${index + 1}">
                    <button type="button" class="photo-remove" data-photo-index="${index}" aria-label="Remove photo ${index + 1}">${iconSvg('x')}</button>
                </div>`).join('');
        }
        if (btnText) btnText.textContent = count === 0 ? 'Take photo' : 'Add another photo';
        if (btn) btn.classList.toggle('hidden', count >= this.MAX_ORDER_PHOTOS);
    }

    async addOrderPhoto(file) {
        if (!file) return;
        if (this.orderPhotos.length >= this.MAX_ORDER_PHOTOS) {
            ui.showToast(`An order can have up to ${this.MAX_ORDER_PHOTOS} photos.`, 'error');
            return;
        }
        try {
            const blob = await this.prepareOrderPhoto(file);
            this.orderPhotos.push({ blob, url: URL.createObjectURL(blob) });
            this.renderOrderPhotos();
        } catch (error) {
            console.error('Could not prepare photo:', error);
            ui.showToast(error.message || 'That photo could not be used. Take it again.', 'error');
        }
    }

    removeOrderPhoto(index) {
        const [removed] = this.orderPhotos.splice(index, 1);
        if (removed && removed.url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(removed.url);
        this.renderOrderPhotos();
    }

    clearOrderPhotos() {
        this.orderPhotos.forEach((photo) => {
            if (photo && photo.url && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(photo.url);
        });
        this.orderPhotos = [];
        this.renderOrderPhotos();
    }

    setFieldError(message) {
        const errorEl = document.getElementById('customer-email-error');
        const inputEl = document.getElementById('customer-email-local');
        if (errorEl) {
            errorEl.textContent = message || '';
            errorEl.classList.toggle('hidden', !message);
        }
        if (inputEl) {
            if (message) inputEl.setAttribute('aria-invalid', 'true');
            else if (inputEl.removeAttribute) inputEl.removeAttribute('aria-invalid');
        }
    }

    /** Subtotal, discount, delivery and total for the current cart. Delivery is free from 50 SGD. */
    calculateTotals() {
        const subtotal = this.calculateSubtotal();
        const discountPercent = this.discountApplied ? 0.05 : 0;
        const discountAmount = subtotal * discountPercent;
        const afterDiscount = subtotal - discountAmount;
        const deliveryFee = (this.deliveryEnabled && subtotal > 0 && afterDiscount < this.FREE_DELIVERY_MIN) ? this.DELIVERY_FEE : 0;
        return { subtotal, discountPercent, discountAmount, afterDiscount, deliveryFee, total: afterDiscount + deliveryFee };
    }

    /** yyyy-mm-dd in Singapore time: the name of the folder an invoice is saved in. */
    invoiceFolderFor(dateLike) {
        const date = dateLike ? new Date(dateLike) : new Date();
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    }

    invoicePathFor(orderId, dateLike) {
        return `${this.invoiceFolderFor(dateLike)}/WoofCrafts_Order_${orderId}.pdf`;
    }

    async allocateOrderId() {
        const client = await this.getSupabaseClient();
        if (!client) throw new Error('Not connected to the order database');
        const { data, error } = await client.rpc('next_order_id');
        if (error || !data) throw new Error('Could not get an order number' + (error ? ': ' + error.message : ''));
        return String(data);
    }

    async saveInvoicePdf(orderId, dateLike, pdfBase64) {
        const client = await this.getSupabaseClient();
        if (!client) throw new Error('Not connected to storage');
        const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        const { error } = await client.storage.from('invoices').upload(
            this.invoicePathFor(orderId, dateLike),
            new Blob([bytes], { type: 'application/pdf' }),
            { contentType: 'application/pdf', upsert: true }
        );
        if (error) throw new Error(error.message);
    }

    async openSavedInvoice(orderId, dateLike) {
        try {
            const client = await this.getSupabaseClient();
            const { data, error } = await client.storage.from('invoices').createSignedUrl(this.invoicePathFor(orderId, dateLike), 300);
            if (error || !data || !data.signedUrl) throw new Error(error ? error.message : 'missing');
            window.open(data.signedUrl, '_blank', 'noopener');
        } catch (error) {
            ui.showToast('No saved invoice PDF for this order.', 'error');
        }
    }

    updateTotals() {
        const { subtotal, discountAmount, deliveryFee, total } = this.calculateTotals();

        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        const discountAmountEl = document.getElementById('discount-amount');
        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        const deliveryEl = document.getElementById('delivery-fee');
        if (deliveryEl) deliveryEl.textContent = !this.deliveryEnabled ? 'Pickup' : (subtotal > 0 && deliveryFee === 0) ? 'Free' : `$${deliveryFee.toFixed(2)}`;
        const hintEl = document.getElementById('delivery-hint');
        if (hintEl) {
            const away = this.FREE_DELIVERY_MIN - (subtotal - discountAmount);
            if (this.deliveryEnabled && deliveryFee > 0 && away > 0) {
                hintEl.textContent = `Add $${away.toFixed(2)} more for free delivery.`;
                hintEl.classList.remove('hidden');
            } else {
                hintEl.classList.add('hidden');
            }
        }
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
        document.querySelectorAll('[data-cart-total]').forEach((el) => { el.textContent = `$${total.toFixed(2)}`; });
        if (discountAmountEl) {
            if (this.discountApplied && discountAmount > 0) {
                discountAmountEl.textContent = `-$${discountAmount.toFixed(2)}`;
                discountAmountEl.classList.remove('hidden');
            } else {
                discountAmountEl.classList.add('hidden');
            }
        }
    }

    async clearCart(skipConfirm = false) {
        if (skipConfirm || await ui.confirm('Remove every item from this order?', 'Reset cart')) {
            this.cart = [];
            this.discountApplied = false;
            this.fulfilmentTouched = false;
            this.setPaymentMethod('');
            this.saveCart();
            this.renderCart();
            this.clearDiscount();
            this.clearCustomerInfo();
        }
    }

    resetCart() {
        this.cart = [];
        this.discountApplied = false;
        this.fulfilmentTouched = false;
        this.setPaymentMethod('');
        this.saveCart();
        this.renderCart();
        this.clearDiscount();
        this.clearCustomerInfo();
    }

    clearCustomerInfo() {
        document.getElementById('customer-name').value = '';
        const customerEmailLocalInput = document.getElementById('customer-email-local');
        if (customerEmailLocalInput) customerEmailLocalInput.value = '';

        const customerEmailSelectedDomainEl = document.getElementById('customer-email-domain-selected');
        if (customerEmailSelectedDomainEl) customerEmailSelectedDomainEl.textContent = 'gmail.com';

        const customerEmailDomainCustomInput = document.getElementById('customer-email-domain-custom');
        if (customerEmailDomainCustomInput) {
            customerEmailDomainCustomInput.value = '';
            customerEmailDomainCustomInput.classList.add('hidden');
        }

        const customerEmailHiddenInput = document.getElementById('customer-email');
        if (customerEmailHiddenInput) customerEmailHiddenInput.value = '';

        const domainButtons = Array.from(document.querySelectorAll('.email-domain-buttons .domain-btn[data-domain]'));
        domainButtons.forEach((buttonEl) => {
            const domain = buttonEl.getAttribute('data-domain');
            buttonEl.classList.toggle('active', domain === 'gmail.com');
        });

        document.getElementById('customer-phone').value = '';
        const commentField = document.getElementById('customer-comment');
        if (commentField) commentField.value = '';

        const addressField = document.getElementById('customer-address');
        if (addressField) addressField.value = '';
        this.clearOrderPhotos();
        this.syncAddressField();
        this.clearFormErrors();
        this.updateSendButton();

        // The next customer's order starts at the top of the cart, not halfway down the form.
        const panel = document.getElementById('cart-panel');
        if (panel) panel.scrollTop = 0;
    }

    /**
     * Reads the visible email composer UI (local part + selected domain) and updates the hidden
     * `#customer-email` input used by the existing checkout/email logic.
     * @throws {Error} Never throws; errors are logged and hidden input is set to ''.
     */
    updateCustomerEmailFromComposer() {
        try {
            const customerEmailHiddenInput = document.getElementById('customer-email');
            const customerEmailLocalInput = document.getElementById('customer-email-local');
            const customerEmailSelectedDomainEl = document.getElementById('customer-email-domain-selected');
            const customerEmailDomainCustomInput = document.getElementById('customer-email-domain-custom');

            if (!customerEmailHiddenInput || !customerEmailLocalInput || !customerEmailSelectedDomainEl) return;

            const localPart = (customerEmailLocalInput.value || '').trim();
            let domainPart = (customerEmailSelectedDomainEl.textContent || '').trim();

            const isCustomVisible = Boolean(customerEmailDomainCustomInput) && !customerEmailDomainCustomInput.classList.contains('hidden');
            if (isCustomVisible && customerEmailDomainCustomInput) {
                domainPart = (customerEmailDomainCustomInput.value || '').trim();
            }

            customerEmailHiddenInput.value = localPart && domainPart ? `${localPart}@${domainPart}` : '';
            this.updateSendButton();
        } catch (error) {
            console.error('[CustomerEmailComposer] Failed to update hidden email:', error);
            const hiddenInput = document.getElementById('customer-email');
            if (hiddenInput) hiddenInput.value = '';
        }
    }

    setupCustomerEmailDomainPicker() {
        try {
            const customerEmailHiddenInput = document.getElementById('customer-email');
            const customerEmailLocalInput = document.getElementById('customer-email-local');
            const customerEmailSelectedDomainEl = document.getElementById('customer-email-domain-selected');
            const customerEmailDomainCustomInput = document.getElementById('customer-email-domain-custom');

            if (!customerEmailHiddenInput || !customerEmailLocalInput || !customerEmailSelectedDomainEl) return;

            const defaultDomain = 'gmail.com';

            const domainButtons = Array.from(document.querySelectorAll('.email-domain-buttons .domain-btn[data-domain]'));
            if (domainButtons.length === 0) return;

            const setActiveDomainButton = (domain) => {
                domainButtons.forEach((buttonEl) => {
                    const buttonDomain = buttonEl.getAttribute('data-domain');
                    buttonEl.classList.toggle('active', buttonDomain === domain);
                });
            };

            const setCustomMode = (enabled) => {
                if (!customerEmailDomainCustomInput) return;
                if (enabled) {
                    customerEmailDomainCustomInput.classList.remove('hidden');
                    customerEmailSelectedDomainEl.textContent = 'custom';
                } else {
                    customerEmailDomainCustomInput.classList.add('hidden');
                }
            };

            const applyDomainSelection = (domain) => {
                if (domain === '__other__') {
                    setCustomMode(true);
                    setActiveDomainButton('__other__');
                    if (customerEmailDomainCustomInput && customerEmailDomainCustomInput.focus) customerEmailDomainCustomInput.focus();
                } else {
                    setCustomMode(false);
                    customerEmailSelectedDomainEl.textContent = domain;
                    setActiveDomainButton(domain);
                }

                this.updateCustomerEmailFromComposer();
            };

            // Wire button clicks.
            domainButtons.forEach((buttonEl) => {
                buttonEl.addEventListener('click', () => {
                    const domain = buttonEl.getAttribute('data-domain') || defaultDomain;
                    applyDomainSelection(domain);
                });
            });

            // Wire local part + custom domain typing.
            customerEmailLocalInput.addEventListener('input', () => {
                const typed = customerEmailLocalInput.value || '';
                const at = typed.indexOf('@');
                if (at >= 0) {
                    // "jane@gmail.com" in the name box: keep "jane" and pick the provider.
                    const domainPart = typed.slice(at + 1).trim().toLowerCase();
                    customerEmailLocalInput.value = typed.slice(0, at).trim();
                    const presetButton = domainButtons.find((btn) => btn.getAttribute('data-domain') === domainPart);
                    if (presetButton) {
                        applyDomainSelection(domainPart);
                    } else if (domainPart) {
                        setCustomMode(true);
                        setActiveDomainButton('__other__');
                        if (customerEmailDomainCustomInput) customerEmailDomainCustomInput.value = domainPart;
                        customerEmailSelectedDomainEl.textContent = domainPart;
                    }
                }
                this.setFieldError('');
                this.updateCustomerEmailFromComposer();
            });
            if (customerEmailDomainCustomInput) {
                customerEmailDomainCustomInput.addEventListener('input', () => {
                    const customDomain = (customerEmailDomainCustomInput.value || '').trim();
                    customerEmailSelectedDomainEl.textContent = customDomain || 'custom';
                    this.updateCustomerEmailFromComposer();
                });
            }

            // Sync from any existing hidden email value if present.
            const existingEmail = (customerEmailHiddenInput.value || '').trim();
            if (existingEmail && existingEmail.includes('@')) {
                const parts = existingEmail.split('@');
                const localPart = (parts[0] || '').trim();
                const domainPart = (parts.slice(1).join('@') || '').trim();

                customerEmailLocalInput.value = localPart;

                const presetButton = domainButtons.find((btn) => btn.getAttribute('data-domain') === domainPart);
                if (presetButton) {
                    applyDomainSelection(domainPart);
                } else if (domainPart) {
                    setCustomMode(true);
                    if (customerEmailDomainCustomInput) customerEmailDomainCustomInput.value = domainPart;
                    setActiveDomainButton('__other__');
                    customerEmailSelectedDomainEl.textContent = domainPart;
                    this.updateCustomerEmailFromComposer();
                } else {
                    applyDomainSelection(defaultDomain);
                }
            } else {
                applyDomainSelection(defaultDomain);
            }
        } catch (error) {
            console.error('[CustomerEmailComposer] Failed to initialize:', error);
        }
    }

    /**
     * Generate a professional invoice PDF and return it as base64 (no `data:*;base64,` prefix).
     * @param {object} orderDetails
     * @returns {Promise<string>}
     * @throws {Error} If jsPDF or autoTable is not available.
     */
    async generateInvoicePdfBase64(orderDetails) {
        if (!orderDetails || typeof orderDetails !== 'object') {
            throw new Error('[InvoicePdf] orderDetails must be an object');
        }

        // Wait briefly for CDN-loaded libraries (best-effort).
        const ensureLibrariesLoaded = async () => {
            const start = Date.now();
            while (Date.now() - start < 5000) {
                if (window.jspdf && window.jspdf.jsPDF) return true;
                await new Promise((r) => setTimeout(r, 50));
            }
            return false;
        };

        const librariesOk = await ensureLibrariesLoaded();
        if (!librariesOk) {
            throw new Error('[InvoicePdf] jsPDF failed to load in time');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });

        if (typeof doc.autoTable !== 'function') {
            throw new Error('[InvoicePdf] autoTable failed to load');
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginLeft = 40;
        const marginRight = 40;
        const availableWidth = pageWidth - marginLeft - marginRight;

        const safeOrderId = String(orderDetails.orderId || '');
        const createdDate = orderDetails.orderDate
            ? new Date(orderDetails.orderDate)
            : new Date();
        const formattedDate = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric'
        }).format(createdDate);

        const customerName = orderDetails.customerName || 'Customer';
        const customerEmail = orderDetails.customerEmail || '';
        const customerPhone = orderDetails.customerPhone || '';
        const customerComment = orderDetails.customerComment || '';

        const subtotal = Number(orderDetails.subtotal || 0);
        const discountAmount = Number(orderDetails.discountAmount || 0);
        const deliveryFee = Number(orderDetails.deliveryFee || 0);
        const total = Number(orderDetails.total || 0);

        const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;
        const palette = {
            brand: [184, 148, 95],
            brandLight: [243, 233, 218],
            ink: [46, 35, 24],
            muted: [112, 90, 66],
            line: [226, 210, 186],
            white: [255, 255, 255]
        };

        // Branded header
        const headerHeight = 98;
        doc.setFillColor(...palette.brandLight);
        doc.roundedRect(marginLeft, 24, availableWidth, headerHeight, 16, 16, 'F');
        doc.setDrawColor(...palette.line);
        doc.roundedRect(marginLeft, 24, availableWidth, headerHeight, 16, 16, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(...palette.brand);
        doc.text('WoofCrafts', marginLeft + 20, 60);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...palette.ink);
        doc.text(`Invoice #${safeOrderId}`, marginLeft + availableWidth - 20, 58, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(...palette.muted);
        doc.text(`Issued ${formattedDate}`, marginLeft + availableWidth - 20, 78, { align: 'right' });

        // Bill-to section
        let yCursor = 150;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...palette.brand);
        doc.text('BILL TO', marginLeft, yCursor);
        yCursor += 18;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(...palette.ink);
        doc.text(`Name: ${customerName}`, marginLeft, yCursor);
        yCursor += 14;
        if (customerEmail) {
            doc.text(`Email: ${customerEmail}`, marginLeft, yCursor);
            yCursor += 14;
        }

        if (customerPhone) {
            doc.text(`Phone: ${customerPhone}`, marginLeft, yCursor);
            yCursor += 14;
        }

        const address = String(orderDetails.address || '').trim();
        const fulfilmentLabel = this.fulfilmentLabel(orderDetails.fulfilment);
        const paymentLabel = this.paymentLabel(orderDetails.paymentMethod);
        if (fulfilmentLabel) {
            doc.text(`How: ${fulfilmentLabel}`, marginLeft, yCursor);
            yCursor += 14;
        }
        if (paymentLabel) {
            doc.text(`Payment: ${paymentLabel}`, marginLeft, yCursor);
            yCursor += 14;
        }
        if (address) {
            const addressLines = doc.splitTextToSize(`Delivery address: ${address.replace(/\s*\n\s*/g, ', ')}`, availableWidth);
            doc.text(addressLines, marginLeft, yCursor);
            yCursor += addressLines.length * 14;
        }

        if (customerComment) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...palette.brand);
            doc.text('Notes', marginLeft, yCursor + 6);
            yCursor += 20;
            const commentLines = doc.splitTextToSize(String(customerComment), availableWidth);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...palette.ink);
            doc.text(commentLines, marginLeft, yCursor);
            yCursor += commentLines.length * 12;
        }

        const lineItemsStartY = Math.max(yCursor + 12, 205);

        const head = [['Item', 'Qty', 'Price', 'Subtotal']];
        const body = Array.isArray(orderDetails.items) ? orderDetails.items.map((item) => {
            return [
                String(item.name || ''),
                String(item.quantity || 0),
                formatCurrency(item.price),
                formatCurrency(item.subtotal)
            ];
        }) : [];

        doc.autoTable({
            startY: lineItemsStartY,
            margin: { left: marginLeft, right: marginRight },
            head,
            body,
            theme: 'grid',
            styles: {
                fontSize: 10,
                cellPadding: 6,
                lineColor: palette.line,
                textColor: palette.ink
            },
            headStyles: {
                fillColor: palette.brand,
                textColor: palette.white,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [252, 248, 242]
            },
            columnStyles: {
                1: { halign: 'center', cellWidth: 60 },
                2: { halign: 'right', cellWidth: 90 },
                3: { halign: 'right', cellWidth: 100 }
            }
        });

        // One row per tag: what to engrave and which ring.
        const pdfTags = Array.isArray(orderDetails.tags) ? orderDetails.tags : [];
        if (pdfTags.length > 0) {
            const tagStartY = ((doc.lastAutoTable && doc.lastAutoTable.finalY) || lineItemsStartY + 30) + 20;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...palette.brand);
            doc.text('ENGRAVING DETAILS', marginLeft, tagStartY);
            doc.autoTable({
                startY: tagStartY + 8,
                margin: { left: marginLeft, right: marginRight },
                head: [['Tag', 'Pet', 'Ring', 'Front', 'Back']],
                body: pdfTags.map((t) => [
                    t.of > 1 ? `${t.item} (${t.number}/${t.of})` : String(t.item || ''),
                    String(t.pet_name || '-'),
                    this.ringColourLabel(t.ring_colour) || '-',
                    String(t.front || '-'),
                    String(t.back || '-')
                ]),
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 5, lineColor: palette.line, textColor: palette.ink },
                headStyles: { fillColor: palette.brand, textColor: palette.white, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [252, 248, 242] }
            });
        }

        const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : lineItemsStartY + 30;
        let totalsY = finalY + 24;
        const summaryCardHeight = 82 + (discountAmount > 0 ? 18 : 0);
        if (totalsY + summaryCardHeight > pageHeight - 90) {
            doc.addPage();
            totalsY = 64;
        }

        const summaryCardWidth = 220;
        const summaryX = marginLeft + availableWidth - summaryCardWidth;
        doc.setFillColor(...palette.brandLight);
        doc.roundedRect(summaryX, totalsY, summaryCardWidth, summaryCardHeight, 12, 12, 'F');
        doc.setDrawColor(...palette.line);
        doc.roundedRect(summaryX, totalsY, summaryCardWidth, summaryCardHeight, 12, 12, 'S');

        let summaryLineY = totalsY + 24;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(...palette.muted);
        doc.text('Subtotal', summaryX + 16, summaryLineY);
        doc.text(formatCurrency(subtotal), summaryX + summaryCardWidth - 16, summaryLineY, { align: 'right' });
        summaryLineY += 18;

        if (discountAmount > 0) {
            doc.text('Discount', summaryX + 16, summaryLineY);
            doc.text(`-${formatCurrency(discountAmount)}`, summaryX + summaryCardWidth - 16, summaryLineY, { align: 'right' });
            summaryLineY += 18;
        }

        doc.text('Delivery', summaryX + 16, summaryLineY);
        doc.text(orderDetails.deliveryMethod === 'pickup' ? (orderDetails.fulfilment === 'taken_now' ? 'Not needed' : 'Pickup') : (deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Free'), summaryX + summaryCardWidth - 16, summaryLineY, { align: 'right' });
        summaryLineY += 18;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...palette.brand);
        doc.text('Total', summaryX + 16, summaryLineY + 2);
        doc.text(formatCurrency(total), summaryX + summaryCardWidth - 16, summaryLineY + 2, { align: 'right' });

        // Footer note
        const footerY = pageHeight - 36;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...palette.muted);
        doc.text('Thank you for supporting WoofCrafts. We hope your pet loves their new goodies.', marginLeft, footerY);

        const dataUriString = doc.output('datauristring');
        const commaIndex = dataUriString.indexOf(',');
        if (commaIndex < 0) {
            throw new Error('[InvoicePdf] Unexpected jsPDF output format');
        }
        const pdfBase64 = dataUriString.slice(commaIndex + 1);
        if (!pdfBase64) throw new Error('[InvoicePdf] Failed to extract pdf base64');

        return pdfBase64;
    }

    async sendOrderEmail() {
        if (!this.validateCheckout()) return;

        // A delivery with no address is allowed (it can be added later), but not by accident.
        if (this.fulfilment === 'delivery' && !(document.getElementById('customer-address')?.value || '').trim() && !this.pendingOrderLogged) {
            const goOn = await ui.confirm('There is no delivery address yet. You can add it later from Purchases.', 'Save without an address?');
            if (!goOn) { this.focusField('customer-address'); return; }
        }

        const sendBtn = document.getElementById('send-email-btn');
        const hasEmailAtStart = Boolean((document.getElementById('customer-email')?.value || '').trim());
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = iconSvg(hasEmailAtStart ? 'mail' : 'check') + (hasEmailAtStart ? ' Sending…' : ' Saving…');
        }

        const customerNameRaw = document.getElementById('customer-name').value.trim();
        const customerNameForInvoice = customerNameRaw || 'Customer';
        const customerEmail = document.getElementById('customer-email').value.trim();
        const customerPhone = document.getElementById('customer-phone').value.trim();
        
        const { subtotal, discountPercent, discountAmount, deliveryFee, total } = this.calculateTotals();

        // A retry after a failed email reuses the same order id and date, so one
        // sale never becomes two rows in the order history.
        let orderId = this.pendingOrderId;
        if (!orderId) {
            try {
                orderId = await this.allocateOrderId();
            } catch (error) {
                ui.showToast(error.message + '. Check the connection and try again.', 'error');
                if (sendBtn) sendBtn.disabled = false;
                this.updateSendButton();
                return;
            }
        }
        const orderDateIso = this.pendingOrderDate || new Date().toISOString();
        this.pendingOrderId = orderId;
        this.pendingOrderDate = orderDateIso;

        const customerComment = document.getElementById('customer-comment')?.value.trim() || '';
        const fieldValue = (id) => { const el = document.getElementById(id); return el && typeof el.value === 'string' ? el.value.trim() : ''; };
        const tags = this.collectTags();
        const petName = this.petNamesOf(tags);
        const ringColour = this.commonRingColour(tags);
        const address = this.deliveryEnabled ? fieldValue('customer-address') : '';
        const fulfilment = this.fulfilment;
        const paymentMethod = this.paymentMethod;

        // One row id per sale, kept across retries, so photos can be attached to the right order.
        if (!this.pendingRowId && typeof crypto !== 'undefined' && crypto.randomUUID) this.pendingRowId = crypto.randomUUID();

        const orderDetails = {
            orderId: orderId,
            orderDate: orderDateIso,
            rowId: this.pendingRowId || null,
            petName: petName,
            address: address,
            ringColour: ringColour,
            tags: tags,
            fulfilment: fulfilment,
            paymentMethod: paymentMethod,
            status: this.initialStatus(fulfilment, tags),
            customerName: customerNameRaw,
            customerEmail: customerEmail,
            customerPhone: customerPhone,
            customerComment: customerComment,
            items: this.cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.price * item.quantity
            })),
            subtotal: subtotal,
            discountAmount: discountAmount,
            discountPercent: discountPercent * 100,
            deliveryFee: deliveryFee,
            deliveryMethod: fulfilment === 'delivery' ? 'delivery' : 'pickup',
            total: total
        };

        try {
            // Record the sale first. The order record matters more than the invoice
            // email: a booth sale that is never written down is lost for good.
            if (!this.pendingOrderLogged) {
                await this.logPurchase(orderDetails);
                this.pendingOrderLogged = true;
            }

            // Optional photos. The sale is already recorded, so a failed upload must never stop the invoice.
            let photosSaved = true;
            if (this.orderPhotos.length > 0 && !this.pendingPhotosSaved) {
                try {
                    if (this.lastPurchasesSource !== 'supabase') throw new Error('order saved on this device only');
                    const paths = await this.uploadOrderPhotos(orderDetails.orderId, orderDateIso, this.orderPhotos.map((photo) => photo.blob));
                    const client = await this.getSupabaseClient();
                    const query = client.from('orders').update({ photo_paths: paths });
                    const { error: photoError } = orderDetails.rowId
                        ? await query.eq('id', orderDetails.rowId)
                        : await query.eq('order_id', orderDetails.orderId);
                    if (photoError) throw new Error(photoError.message);
                    this.pendingPhotosSaved = true;
                } catch (photoError) {
                    photosSaved = false;
                    console.error('Could not save order photos:', photoError);
                }
            }

            const pdfBase64 = await this.generateInvoicePdfBase64({ ...orderDetails, customerName: customerNameForInvoice });
            const fileName = `WoofCrafts_Order_${orderDetails.orderId}.pdf`;

            // File a copy in the invoices folder for today's date. A failure here must not stop the email.
            let savedCopy = true;
            try {
                await this.saveInvoicePdf(orderDetails.orderId, orderDateIso, pdfBase64);
            } catch (saveError) {
                savedCopy = false;
                console.error('Could not save invoice copy:', saveError);
            }

            this.lastInvoice = { orderId: orderDetails.orderId, fileName, pdfBase64 };

            // Email is optional: with no address the order and PDF are still saved.
            if (orderDetails.customerEmail) {
                const accessToken = await window.WoofAuth.getAccessToken();
                const response = await fetch('/api/send-invoice', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken || ''}`
                    },
                    body: JSON.stringify({
                        pdfBase64,
                        customerEmail: orderDetails.customerEmail,
                        customerName: customerNameRaw,
                        purchaseDate: orderDateIso,
                        invoiceNumber: orderDetails.orderId,
                        fileName,
                        order: {
                            items: orderDetails.items,
                            subtotal: orderDetails.subtotal,
                            discountAmount: orderDetails.discountAmount,
                            deliveryFee: orderDetails.deliveryFee,
                            deliveryMethod: orderDetails.deliveryMethod,
                            fulfilment: this.fulfilmentLabel(orderDetails.fulfilment),
                            paymentMethod: this.paymentLabel(orderDetails.paymentMethod),
                            customerComment: orderDetails.customerComment,
                            petName: orderDetails.petName,
                            ringColour: this.ringColourLabel(orderDetails.ringColour),
                            tags: orderDetails.tags.map((t) => ({
                                item: t.item, number: t.number, of: t.of,
                                petName: t.pet_name, ringColour: this.ringColourLabel(t.ring_colour), front: t.front, back: t.back
                            })),
                            address: orderDetails.address,
                            total: orderDetails.total
                        }
                    })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Failed to send invoice email');
                }
            }

            // The Purchases list reloads the next time it is opened.
            this.purchasesLoaded = false;

            const problems = [];
            if (!savedCopy) problems.push('The PDF copy could not be filed.');
            if (!photosSaved) problems.push('The photo was not saved.');
            const photosAttempted = this.orderPhotos.length > 0;
            const doneInfo = {
                orderId: orderDetails.orderId,
                total: orderDetails.total,
                fulfilment: orderDetails.fulfilment,
                paymentMethod: orderDetails.paymentMethod,
                email: orderDetails.customerEmail,
                where: this.lastPurchasesSource === 'supabase' ? 'order history' : 'this device only',
                pdfFiled: savedCopy,
                photosAttempted,
                photosSaved,
                problems
            };
            this.closeCartSheet();
            this.pendingOrderId = null;
            this.pendingOrderDate = null;
            this.pendingOrderLogged = false;
            this.pendingRowId = null;
            this.pendingPhotosSaved = false;
            // Cart clears automatically without prompt as per UX review
            this.clearCart(true);
            this.showOrderDone(doneInfo);
        } catch (error) {
            console.error('Error sending email:', error);
            const where = this.lastPurchasesSource === 'supabase' ? 'order history' : 'this device';
            if (this.pendingOrderLogged) {
                ui.showToast(
                    `Order #${orderDetails.orderId} is saved to ${where}, but the invoice did not finish: `
                    + (error.message || 'unknown error')
                    + '. Press the button again to retry. It will not create a second order.',
                    'error'
                );
            } else {
                ui.showToast('Could not record this sale: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
            }
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            this.updateSendButton();
        }
    }

    // ---- Cart sheet (phones and iPad portrait). From 900px wide the cart is docked beside the products.
    openCartSheet() {
        const panel = document.getElementById('cart-panel');
        if (!panel) return;
        panel.classList.add('is-open');
        document.body.classList.add('cart-open');
        const bar = document.getElementById('cart-bar');
        if (bar) bar.setAttribute('aria-expanded', 'true');
        const closeBtn = document.getElementById('cart-close');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    closeCartSheet() {
        const panel = document.getElementById('cart-panel');
        if (panel) panel.classList.remove('is-open');
        document.body.classList.remove('cart-open');
        const bar = document.getElementById('cart-bar');
        if (bar) bar.setAttribute('aria-expanded', 'false');
    }

    setupCartSheet() {
        const on = (id, handler) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        };
        on('cart-bar', () => this.openCartSheet());
        on('cart-close', () => { this.closeCartSheet(); const bar = document.getElementById('cart-bar'); if (bar) bar.focus({ preventScroll: true }); });
        on('cart-backdrop', () => this.closeCartSheet());

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && document.body.classList.contains('cart-open')) this.closeCartSheet();
        });

        // Rotating an iPad to landscape docks the cart; make sure no sheet state is left behind.
        const docked = window.matchMedia('(min-width: 900px)');
        const onChange = () => { if (docked.matches) this.closeCartSheet(); };
        if (docked.addEventListener) docked.addEventListener('change', onChange);
        else if (docked.addListener) docked.addListener(onChange);
    }

    setupCategoryFilter() {
        const filterEl = document.getElementById('category-filter');
        if (!filterEl) return;
        filterEl.addEventListener('click', (event) => {
            const chip = event.target && event.target.closest ? event.target.closest('[data-category]') : null;
            if (!chip) return;
            this.activeCategory = chip.getAttribute('data-category') || 'all';
            this.renderProducts();
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (event) => {
            const btn = event.target && event.target.closest ? event.target.closest('.invoice-open-btn') : null;
            if (btn) this.openSavedInvoice(btn.getAttribute('data-invoice-order'), btn.getAttribute('data-invoice-date'));
        });
        const fulfilmentGroup = document.getElementById('fulfilment');
        if (fulfilmentGroup) {
            fulfilmentGroup.addEventListener('click', (event) => {
                const btn = event.target && event.target.closest ? event.target.closest('.seg-btn') : null;
                if (btn) this.setFulfilment(btn.getAttribute('data-fulfilment'), true);
            });
        }
        const paymentGroup = document.getElementById('payment-method');
        if (paymentGroup) {
            paymentGroup.addEventListener('click', (event) => {
                const btn = event.target && event.target.closest ? event.target.closest('.seg-btn') : null;
                if (btn) this.setPaymentMethod(btn.getAttribute('data-payment'));
            });
        }
        const tagHost = document.getElementById('tag-details');
        if (tagHost) {
            tagHost.addEventListener('input', (event) => { if (event.target && event.target.matches && event.target.matches('input[data-field]')) this.onTagInput(event.target); });
            tagHost.addEventListener('click', (event) => { if (event.target && event.target.closest) this.onTagClick(event.target); });
        }
        ['customer-name', 'customer-phone'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.setInlineError(id + '-error', '', id));
        });

        const photoInput = document.getElementById('order-photo-input');
        if (photoInput) {
            photoInput.addEventListener('change', async () => {
                const file = photoInput.files && photoInput.files[0];
                photoInput.value = '';
                await this.addOrderPhoto(file);
            });
        }
        const photoStrip = document.getElementById('order-photos');
        if (photoStrip) {
            photoStrip.addEventListener('click', (event) => {
                const btn = event.target && event.target.closest ? event.target.closest('.photo-remove') : null;
                if (btn) this.removeOrderPhoto(Number(btn.getAttribute('data-photo-index')));
            });
        }
        this.syncAddressField();
        this.setupCartSheet();
        this.setupCategoryFilter();
        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) discountBtn.addEventListener('click', () => this.applyDiscount());

        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) clearCartBtn.addEventListener('click', () => this.clearCart());

        const resetCartBtn = document.getElementById('reset-cart-btn');
        if (resetCartBtn) resetCartBtn.addEventListener('click', () => (this.cart.length ? this.clearCart() : this.resetCart()));

        const sendEmailBtn = document.getElementById('send-email-btn');
        if (sendEmailBtn) sendEmailBtn.addEventListener('click', () => this.sendOrderEmail());

        // Customer email local-part composer (local + gmail.com/yahoo.com style buttons).
        this.setupCustomerEmailDomainPicker();


        // Reload products when page becomes visible (in case products were added in another tab)
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                await this.refreshProducts();
            }
        });
        
        // Also reload when window gains focus (more reliable than visibility change)
        window.addEventListener('focus', async () => {
            await this.refreshProducts();
        });
        
        // Also listen for custom event that can be triggered from products.html
        window.addEventListener('productsUpdated', async () => {
            console.log('Products updated event received');
            await this.refreshProducts();
        });
        
        // Check sessionStorage for product updates (set by products.html)
        const checkForUpdates = () => {
            const lastUpdate = sessionStorage.getItem('woofcrafts_products_updated');
            if (lastUpdate) {
                const updateTime = parseInt(lastUpdate);
                const now = Date.now();
                // If update was recent (within last 5 seconds), refresh
                if (now - updateTime < 5000) {
                    console.log('Recent product update detected, refreshing...');
                    this.refreshProducts();
                }
            }
        };
        
        // Check on load and every 5 seconds (reduced from 2s to limit refresh frequency)
        checkForUpdates();
        setInterval(checkForUpdates, 5000);

        // Purchases tab wiring (no separate page)
        this.setupPurchaseTabs();
    }
}

// Global helper function to safely add to cart
function safeAddToCart(productId) {
    if (!window.posApp && !posApp) {
        ui.showToast('Please wait for the app to load, then try again.', 'error');
        return;
    }
    (window.posApp || posApp).addToCart(productId);
}

// Initialize the POS app - declared globally
var posApp;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing POS App...');
    
    try {
        posApp = new POSApp();
        window.posApp = posApp; // Also set on window for extra safety
        console.log('✅ POS App initialized successfully');
        
        // Double-check that products are rendered after a short delay
        // This helps catch any timing issues
        setTimeout(() => {
            if (posApp && posApp.products && posApp.products.length > 0) {
                const grid = document.getElementById('products-grid');
                if (grid) {
                    const hasProducts = grid.querySelector('.product-card');
                    if (!hasProducts) {
                        console.warn('⚠️ Products exist but not rendered! Forcing re-render...');
                        posApp.renderProducts();
                    } else {
                        console.log(`✅ ${posApp.products.length} products displayed successfully`);
                    }
                }
            }
        }, 500);
    } catch (error) {
        console.error('❌ Failed to initialize POS App:', error);
        ui.showToast('The app could not start. Refresh the page.', 'error');
    }
});

