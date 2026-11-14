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
        this.deliveryEnabled = true;   // staff can switch delivery off for on-the-spot sales
        this.FREE_DELIVERY_MIN = 50;   // SGD, measured after any discount
        this.DELIVERY_FEE = 2.5;       // SGD
        
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
                    .select('id,title,description,price,category,image_url,created_at')
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
                            image: row.image_url || ''
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
            items: items
        };

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
            total: Number(orderDetails.total || 0),
            items,
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

        const { data, error } = await supabaseClient
            .from('orders')
            .select('id,order_id,customer_email,total,created_at,items,customer_name,customer_phone,customer_comment,subtotal,discount_amount,delivery_fee')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            throw new Error(`[PurchaseLog] Supabase select failed: ${error.message}`);
        }

        if (!Array.isArray(data)) return [];

        return data;
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

    renderPurchasesList(purchases) {
        const listEl = document.getElementById('purchases-list');
        if (!listEl) return;

        if (!Array.isArray(purchases) || purchases.length === 0) {
            const localModeNotice = !this.isSupabaseConfigured()
                ? `<p style="font-size: 0.9rem; margin-top: 10px; color: var(--text-light); font-weight: 700;">
                        Supabase is not configured. Purchases will appear here after checkout, stored locally in this browser.
                   </p>`
                : '';

            listEl.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('receipt')}</span>
                    <p>No purchases yet</p>
                    <p class="empty-state-note">Orders show here after you send an invoice.</p>
                    ${localModeNotice}
                </div>
            `;
            return;
        }

        // Cache purchase records for quick drill-down
        this.purchaseCache.clear();
        purchases.forEach((p) => {
            if (p && p.id) this.purchaseCache.set(String(p.id), p);
        });

        let lastFolder = '';
        listEl.innerHTML = purchases.map((p) => {
            const purchaseId = String(p.id);
            const orderId = this.escapePurchaseText(p.order_id || '');
            const email = this.escapePurchaseText(p.customer_email || '');
            const total = this.formatCurrency(p.total);
            const createdAt = p.created_at ? new Date(p.created_at) : null;
            const dateText = createdAt ? createdAt.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';

            const folder = p.created_at ? this.invoiceFolderFor(p.created_at) : '';
            let heading = '';
            if (folder && folder !== lastFolder) {
                lastFolder = folder;
                const headingText = new Date(p.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                heading = `<h3 class="purchase-date-heading">${this.escapePurchaseText(headingText)}</h3>`;
            }

            return `${heading}
                <button
                    type="button"
                    class="btn-secondary purchase-card-btn"
                    data-purchase-id="${escapeHtml(purchaseId)}"
                    aria-label="View purchase ${orderId}"
                >
                    <span class="purchase-card-left">
                        ${iconSvg('receipt')}
                        <span>#${orderId}</span>
                    </span>
                    <span class="purchase-card-right">
                        ${this.escapePurchaseText(total)}<span class="purchase-card-date">${this.escapePurchaseText(dateText)}</span>
                    </span>
                </button>
            `;
        }).join('');
    }

    renderPurchaseDetails(purchase) {
        const detailsEl = document.getElementById('purchase-details');
        if (!detailsEl) return;

        if (!purchase) {
            detailsEl.style.display = 'none';
            return;
        }

        const safeOrderId = this.escapePurchaseText(purchase.order_id || '');
        const customerEmail = this.escapePurchaseText(purchase.customer_email || '');
        const customerName = this.escapePurchaseText(purchase.customer_name || '');
        const customerPhone = this.escapePurchaseText(purchase.customer_phone || '');
        const customerComment = this.escapePurchaseText(purchase.customer_comment || '');

        const createdAt = purchase.created_at ? new Date(purchase.created_at) : null;
        const dateText = createdAt ? createdAt.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

        const items = Array.isArray(purchase.items) ? purchase.items : [];

        const itemsRows = items.map((item) => {
            const itemName = this.escapePurchaseText(item.name || '');
            const qty = Number(item.quantity || 0);
            const price = this.formatCurrency(item.price);
            const subtotal = this.formatCurrency(item.subtotal || (Number(item.price || 0) * qty));

            return `
                <tr>
                    <td>${itemName}</td>
                    <td class="purchase-details-qty-cell">${qty}</td>
                    <td class="purchase-details-price-cell">${price}</td>
                    <td class="purchase-details-subtotal-cell">${subtotal}</td>
                </tr>
            `;
        }).join('');

        detailsEl.style.display = 'block';
        detailsEl.innerHTML = `
            <article class="purchase-details-card">
                <h2 class="purchase-details-title">Purchase #${safeOrderId}</h2>
                <p class="purchase-details-meta">
                    ${customerName ? `Customer: ${customerName}<br/>` : ''}
                    ${customerEmail ? `Email: ${customerEmail}<br/>` : ''}
                    ${customerPhone ? `Phone: ${customerPhone}<br/>` : ''}
                    ${dateText ? `Date: ${this.escapePurchaseText(dateText)}<br/>` : ''}
                </p>
                ${customerComment ? `<p class="purchase-details-notes">Notes: ${customerComment}</p>` : ''}

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
                        <tbody>
                            ${itemsRows}
                        </tbody>
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
                    ${Number(purchase.delivery_fee || 0) > 0 ? `
                        <div class="purchase-total-box">
                            <div class="purchase-total-label">Delivery</div>
                            <div class="purchase-total-value">${this.formatCurrency(purchase.delivery_fee)}</div>
                        </div>
                    ` : ''}
                    <div class="purchase-total-box purchase-total-box-highlight">
                        <div class="purchase-total-label">Total</div>
                        <div class="purchase-total-value purchase-total-value-highlight">${this.formatCurrency(purchase.total)}</div>
                    </div>
                </div>
                ${purchase.order_id && purchase.created_at ? `
                    <button type="button" class="btn-secondary invoice-open-btn"
                        data-invoice-order="${escapeHtml(String(purchase.order_id))}"
                        data-invoice-date="${escapeHtml(String(purchase.created_at))}">
                        ${iconSvg('receipt')} Open invoice PDF
                    </button>
                ` : ''}
            </article>
        `;
    }

    async showPurchaseDetails(purchaseId) {
        const id = String(purchaseId || '');
        if (!id) return;

        const cached = this.purchaseCache.get(id);
        if (cached) {
            this.renderPurchaseDetails(cached);
            return;
        }

        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) return;

        const { data, error } = await supabaseClient.from('orders').select('*').eq('id', id).single();
        if (error) throw new Error(`[PurchaseLog] Failed to load purchase ${id}: ${error.message}`);
        this.renderPurchaseDetails(data);
        this.purchaseCache.set(id, data);
    }

    async refreshPurchasesView() {
        const purchases = await this.loadPurchases();
        this.purchasesLoaded = true;
        this.renderPurchasesList(purchases);
        this.renderPurchaseDetails(null);
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

            posBtn.setAttribute('aria-selected', String(isPos));
            purchasesBtn.setAttribute('aria-selected', String(!isPos));
        };

        posBtn.addEventListener('click', () => setActive('pos'));
        purchasesBtn.addEventListener('click', async () => {
            setActive('purchases');
            try {
                if (!this.purchasesLoaded) {
                    await this.refreshPurchasesView();
                }
            } catch (error) {
                console.error('Error loading purchases:', error);
                const listEl = document.getElementById('purchases-list');
                if (listEl) listEl.textContent = 'Failed to load purchases. Check console.';
            }
        });

        const purchasesListEl = document.getElementById('purchases-list');
        if (purchasesListEl) {
            purchasesListEl.addEventListener('click', async (event) => {
                const target = event.target;
                const button = target && target.closest ? target.closest('[data-purchase-id]') : null;
                if (!button) return;
                const purchaseId = button.getAttribute('data-purchase-id');
                try {
                    await this.showPurchaseDetails(purchaseId);
                } catch (error) {
                    console.error('Error showing purchase details:', error);
                    ui.showToast('Could not load this purchase. Check the connection and try again.', 'error');
                }
            });
        }
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
                        <img src="${escapeHtml(imageSrc)}" alt="${productName}" class="product-image"
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
                    quantity: 1
                });
            }

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
            this.saveCart();
            this.renderCart();
        }
    }

    renderCart() {
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

    applyDiscount() {
        if (this.discountApplied || this.cart.length === 0) return;
        
        this.discountApplied = true;
        this.updateTotals();
        
        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) {
            discountBtn.disabled = true;
            discountBtn.innerHTML = iconSvg('check') + ' 5% discount applied';
        }
    }

    clearDiscount() {
        this.discountApplied = false;
        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) {
            discountBtn.disabled = false;
            discountBtn.innerHTML = iconSvg('percent') + ' Apply 5% discount';
        }
        this.updateTotals();
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
            this.deliveryEnabled = true;
            const deliveryToggle = document.getElementById('delivery-toggle');
            if (deliveryToggle) deliveryToggle.checked = true;
            this.saveCart();
            this.renderCart();
            this.clearDiscount();
            this.clearCustomerInfo();
        }
    }

    resetCart() {
        this.cart = [];
        this.discountApplied = false;
        this.deliveryEnabled = true;
        const deliveryToggle = document.getElementById('delivery-toggle');
        if (deliveryToggle) deliveryToggle.checked = true;
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
    }

    validateCheckout() {
        // Ensure hidden field is synced with the composer UI (local part + domain selection).
        this.updateCustomerEmailFromComposer();

        const emailEl = document.getElementById('customer-email');
        const email = emailEl ? (emailEl.value || '').trim() : '';
        if (!email) {
            ui.showToast('Enter the customer email address.', 'error');
            return false;
        }

        // Basic format validation so bad domains like "custom" don't slip through.
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail) {
            ui.showToast('Enter a valid email address, like name@gmail.com.', 'error');
            return false;
        }

        if (this.cart.length === 0) {
            ui.showToast('Add an item to the cart first.', 'error');
            return false;
        }
        return true;
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
            customerEmailLocalInput.addEventListener('input', () => this.updateCustomerEmailFromComposer());
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
        doc.text(`Email: ${customerEmail}`, marginLeft, yCursor);
        yCursor += 14;

        if (customerPhone) {
            doc.text(`Phone: ${customerPhone}`, marginLeft, yCursor);
            yCursor += 14;
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
        doc.text(orderDetails.deliveryMethod === 'pickup' ? 'Pickup' : (deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Free'), summaryX + summaryCardWidth - 16, summaryLineY, { align: 'right' });
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

        const sendBtn = document.getElementById('send-email-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = iconSvg('mail') + ' Sending…';
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
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.innerHTML = iconSvg('mail') + ' Send invoice';
                }
                return;
            }
        }
        const orderDateIso = this.pendingOrderDate || new Date().toISOString();
        this.pendingOrderId = orderId;
        this.pendingOrderDate = orderDateIso;

        const customerComment = document.getElementById('customer-comment')?.value.trim() || '';

        const orderDetails = {
            orderId: orderId,
            orderDate: orderDateIso,
            customerName: customerNameForInvoice,
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
            deliveryMethod: this.deliveryEnabled ? 'delivery' : 'pickup',
            total: total
        };

        try {
            // Record the sale first. The order record matters more than the invoice
            // email: a booth sale that is never written down is lost for good.
            if (!this.pendingOrderLogged) {
                await this.logPurchase(orderDetails);
                this.pendingOrderLogged = true;
            }

            const pdfBase64 = await this.generateInvoicePdfBase64(orderDetails);
            const fileName = `WoofCrafts_Order_${orderDetails.orderId}.pdf`;

            // File a copy in the invoices folder for today's date. A failure here must not stop the email.
            let savedCopy = true;
            try {
                await this.saveInvoicePdf(orderDetails.orderId, orderDateIso, pdfBase64);
            } catch (saveError) {
                savedCopy = false;
                console.error('Could not save invoice copy:', saveError);
            }

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
                        customerComment: orderDetails.customerComment,
                        total: orderDetails.total
                    }
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to send invoice email');
            }

            // If user is currently viewing purchases, refresh list immediately.
            const purchasesView = document.getElementById('view-purchases');
            if (purchasesView && !purchasesView.classList.contains('hidden')) {
                this.purchasesLoaded = false;
                await this.refreshPurchasesView();
            }

            ui.showToast('Invoice #' + orderDetails.orderId + ' sent to ' + orderDetails.customerEmail + (savedCopy ? '' : '. The PDF copy could not be filed, so download it from the email.'), savedCopy ? 'success' : 'error');
            this.closeCartSheet();
            this.pendingOrderId = null;
            this.pendingOrderDate = null;
            this.pendingOrderLogged = false;
            // Cart clears automatically without prompt as per UX review
            this.clearCart(true);
        } catch (error) {
            console.error('Error sending email:', error);
            const where = this.lastPurchasesSource === 'supabase' ? 'order history' : 'this device';
            if (this.pendingOrderLogged) {
                ui.showToast(
                    `Order #${orderDetails.orderId} is saved to ${where}, but the invoice email did not send: `
                    + (error.message || 'unknown error')
                    + '. Press Send invoice to try the email again.',
                    'error'
                );
            } else {
                ui.showToast('Could not record this sale: ' + (error.message || 'unknown error') + '. Check the connection and try again.', 'error');
            }
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = iconSvg('mail') + ' Send invoice';
            }
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
        const deliveryToggle = document.getElementById('delivery-toggle');
        if (deliveryToggle) {
            deliveryToggle.addEventListener('change', () => {
                this.deliveryEnabled = deliveryToggle.checked;
                this.updateTotals();
            });
        }
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

