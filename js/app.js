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
        
        this.init();
    }

    async init() {
        // Check authentication
        if (sessionStorage.getItem('woofcrafts_authenticated') !== 'true') {
            window.location.href = 'index.html';
            return;
        }
        
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
        if (this.supabaseClientPromise) return this.supabaseClientPromise;

        const config = this.getSupabaseConfig();
        const isConfigured = Boolean(config.supabaseUrl) && Boolean(config.supabaseAnonKey);
        if (!isConfigured) {
            this.supabaseClientPromise = Promise.resolve(null);
            return this.supabaseClientPromise;
        }

        this.supabaseClientPromise = (async () => {
            try {
                const supabaseModule = await import('https://esm.sh/@supabase/supabase-js@2');
                const { createClient } = supabaseModule;
                return createClient(config.supabaseUrl, config.supabaseAnonKey);
            } catch (error) {
                console.warn('Failed to create Supabase client:', error);
                return null;
            }
        })();

        return this.supabaseClientPromise;
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
            .select('id,order_id,customer_email,total,created_at,items,customer_name,customer_phone,customer_comment,subtotal,discount_amount')
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
                    <span class="empty-icon">📜</span>
                    <p>No purchases yet.</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Complete an order to see it here.</p>
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

        listEl.innerHTML = purchases.map((p) => {
            const purchaseId = String(p.id);
            const orderId = this.escapePurchaseText(p.order_id || '');
            const email = this.escapePurchaseText(p.customer_email || '');
            const total = this.formatCurrency(p.total);
            const createdAt = p.created_at ? new Date(p.created_at) : null;
            const dateText = createdAt ? createdAt.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';

            return `
                <button
                    type="button"
                    class="btn-secondary purchase-card-btn"
                    data-purchase-id="${escapeHtml(purchaseId)}"
                    aria-label="View purchase ${orderId}"
                >
                    <span class="purchase-card-left">
                        <span>🧾</span>
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
                    <div class="purchase-total-box purchase-total-box-highlight">
                        <div class="purchase-total-label">Total</div>
                        <div class="purchase-total-value purchase-total-value-highlight">${this.formatCurrency(purchase.total)}</div>
                    </div>
                </div>
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
                    ui.showToast('Failed to load purchase details. See console for details.', 'error');
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

    renderProducts() {
        const grid = document.getElementById('products-grid');
        
        if (!grid) {
            console.error('❌ Products grid element not found!');
            return;
        }
        
        // Filter out any invalid products
        const validProducts = this.products.filter(product => product && product.id && product.name);
        
        console.log(`📦 Rendering ${validProducts.length} valid products (total: ${this.products.length})`);
        
        if (!validProducts || validProducts.length === 0) {
            console.warn('⚠️ No valid products to display');
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🐶</span>
                    <p>No products available yet!</p>
                    <a href="products.html" class="empty-link">Add your first product here 🎉</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = validProducts.map(product => {
            const category = product.category || 'general';
            const categoryLabel = escapeHtml(category.charAt(0).toUpperCase() + category.slice(1));
            const productName = escapeHtml(product.name || '');
            let imageSrc = safeImageSrc(product.image) || PLACEHOLDER_IMAGE;
            if (!imageSrc) imageSrc = PLACEHOLDER_IMAGE;

            const safeId = JSON.stringify(product.id);
            return `
                <div class="product-card" onclick='safeAddToCart(${safeId})'>
                    ${category !== 'general' ? `<div class="product-category-badge">${categoryLabel}</div>` : ''}
                    <img src="${escapeHtml(imageSrc)}" alt="${productName}" class="product-image" 
                         onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE}'">
                    <div class="product-name">${productName}</div>
                    <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
                    <button class="quick-add-btn" onclick='event.stopPropagation(); safeAddToCart(${safeId})' title="Quick Add">+</button>
                </div>
            `;
        }).join('');
        
        console.log('✓ Products rendered successfully');
    }

    addToCart(productId) {
        try {
            // Normalize ID: support both numeric and string IDs from products.json vs form-added products
            const normalizedId = (typeof productId === 'string' && /^\d+$/.test(productId))
                ? parseInt(productId, 10) : productId;

            const product = this.products.find(p => p.id == normalizedId || String(p.id) === String(normalizedId));
        if (!product) {
            ui.showToast('Product not found! Please refresh the page.', 'error');
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
            const cartBadge = document.getElementById('cart-count');
            if (cartBadge) {
                cartBadge.style.animation = 'none';
                setTimeout(() => {
                    cartBadge.style.animation = 'scaleIn 0.3s';
                }, 10);
            }
        } catch (error) {
            console.error('❌ Error in addToCart:', error);
            ui.showToast('Error adding to cart: ' + error.message, 'error');
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
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <span class="empty-cart-icon">🐕</span>
                    <p>Your cart is empty</p>
                    <p class="empty-cart-hint">Start shopping by clicking on products!</p>
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
                            <button class="quantity-btn" onclick='(window.posApp || posApp).updateQuantity(${safeId(item.productId)}, -1)'>-</button>
                            <span class="quantity-display">${item.quantity}</span>
                            <button class="quantity-btn" onclick='(window.posApp || posApp).updateQuantity(${safeId(item.productId)}, 1)'>+</button>
                        </div>
                        <div class="cart-item-total">$${subtotal.toFixed(2)}</div>
                        <button class="remove-btn" onclick='(window.posApp || posApp).removeFromCart(${safeId(item.productId)})' title="Remove">🗑️</button>
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
            discountBtn.innerHTML = '<span>✅</span> Discount Applied <span class="discount-badge">5%</span>';
        }
    }

    clearDiscount() {
        this.discountApplied = false;
        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) {
            discountBtn.disabled = false;
            discountBtn.innerHTML = '<span>🎁</span> Apply 5% Discount';
        }
        this.updateTotals();
    }

    updateTotals() {
        const subtotal = this.calculateSubtotal();
        const discountPercent = this.discountApplied ? 0.05 : 0;
        const discountAmount = subtotal * discountPercent;
        const total = subtotal - discountAmount;

        const subtotalEl = document.getElementById('subtotal');
        const totalEl = document.getElementById('total');
        const discountAmountEl = document.getElementById('discount-amount');
        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
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
        if (skipConfirm || await ui.confirm('Are you sure you want to clear the cart?', 'Clear Cart')) {
            this.cart = [];
            this.discountApplied = false;
            this.saveCart();
            this.renderCart();
            this.clearDiscount();
            this.clearCustomerInfo();
        }
    }

    resetCart() {
        this.cart = [];
        this.discountApplied = false;
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
            ui.showToast('Please enter customer email address', 'error');
            return false;
        }

        // Basic format validation so bad domains like "custom" don't slip through.
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isValidEmail) {
            ui.showToast('Please enter a valid customer email address', 'error');
            return false;
        }

        if (this.cart.length === 0) {
            ui.showToast('Cart is empty. Please add items to cart.', 'error');
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
        const formattedDate = createdDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const customerName = orderDetails.customerName || 'Customer';
        const customerEmail = orderDetails.customerEmail || '';
        const customerPhone = orderDetails.customerPhone || '';
        const customerComment = orderDetails.customerComment || '';

        const subtotal = Number(orderDetails.subtotal || 0);
        const discountAmount = Number(orderDetails.discountAmount || 0);
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

        doc.setFontSize(11);
        doc.setTextColor(...palette.muted);
        doc.text('Pet boutique invoice', marginLeft + 20, 80);

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
        const summaryCardHeight = discountAmount > 0 ? 82 : 64;
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
            sendBtn.innerHTML = '<span>⏳</span> Sending...';
        }

        const customerNameRaw = document.getElementById('customer-name').value.trim();
        const customerNameForInvoice = customerNameRaw || 'Customer';
        const customerEmail = document.getElementById('customer-email').value.trim();
        const customerPhone = document.getElementById('customer-phone').value.trim();
        
        const subtotal = this.calculateSubtotal();
        const discountPercent = this.discountApplied ? 0.05 : 0;
        const discountAmount = subtotal * discountPercent;
        const total = subtotal - discountAmount;

        // Generate 4-digit order ID
        const orderId = String(Math.floor(1000 + Math.random() * 9000));
        const orderDateIso = new Date().toISOString();

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
            total: total
        };

        try {
            const pdfBase64 = await this.generateInvoicePdfBase64(orderDetails);
            const fileName = `WoofCrafts_Order_${orderDetails.orderId}.pdf`;

            const response = await fetch('/api/send-invoice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pdfBase64,
                    customerEmail: orderDetails.customerEmail,
                    customerName: customerNameRaw,
                    purchaseDate: orderDateIso,
                    invoiceNumber: orderDetails.orderId,
                    fileName,
                    orderDetails
                })
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to send invoice email');
            }

            const orderLoggedByServer = Boolean(result.orderLog && result.orderLog.saved);
            if (!orderLoggedByServer) {
                try {
                    await this.logPurchase(orderDetails);
                } catch (logError) {
                    console.warn('Purchase logging failed:', logError);
                }
            } else {
                this.lastPurchasesSource = 'supabase';
            }

            // If user is currently viewing purchases, refresh list immediately.
            const purchasesView = document.getElementById('view-purchases');
            if (purchasesView && !purchasesView.classList.contains('hidden')) {
                this.purchasesLoaded = false;
                await this.refreshPurchasesView();
            }

            if (result.orderLog && result.orderLog.attempted && !result.orderLog.saved) {
                console.warn('[Checkout] Server order logging failed:', result.orderLog.reason);
            }

            ui.showToast('🐾 Invoice email sent successfully to ' + orderDetails.customerEmail + '! 🐶', 'success');
            // Cart clears automatically without prompt as per UX review
            this.clearCart(true);
        } catch (error) {
            console.error('Error sending email:', error);
            ui.showToast('❌ Failed to send invoice email: ' + (error.message || 'Unknown error'), 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<span>📬</span> Send Email';
            }
        }
    }

    setupEventListeners() {
        const discountBtn = document.getElementById('discount-btn');
        if (discountBtn) discountBtn.addEventListener('click', () => this.applyDiscount());

        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) clearCartBtn.addEventListener('click', () => this.clearCart());

        const resetCartBtn = document.getElementById('reset-cart-btn');
        if (resetCartBtn) resetCartBtn.addEventListener('click', () => this.resetCart());

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
        ui.showToast('Failed to initialize the app. Please refresh the page.', 'error');
    }
});

