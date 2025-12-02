// WoofCrafts POS System - Main Application Logic

class POSApp {
    constructor() {
        this.cart = [];
        this.discountApplied = false;
        this.products = [];
        this.filteredProducts = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        
        this.init();
    }

    async init() {
        // Check authentication
        if (sessionStorage.getItem('woofcrafts_authenticated') !== 'true') {
            window.location.href = 'login.html';
            return;
        }
        
        await this.loadProducts();
        this.loadCart();
        this.filteredProducts = [...this.products];
        this.renderProducts();
        this.renderCart();
        this.setupEventListeners();
        
        // Periodically sync with Google Sheets (every 30 seconds)
        setInterval(async () => {
            try {
                if (typeof loadProductsFromSheets === 'function') {
                    const sheetsProducts = await loadProductsFromSheets();
                    // Only update if there are differences
                    if (JSON.stringify(sheetsProducts) !== JSON.stringify(this.products)) {
                        this.products = sheetsProducts;
                        localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
                        this.filteredProducts = [];
                        this.filterProducts();
                        console.log('Products synced from Google Sheets');
                    }
                }
            } catch (error) {
                console.error('Error syncing products:', error);
            }
        }, 30000); // Sync every 30 seconds
    }

    async loadProducts() {
        // Load from Google Sheets first, fallback to localStorage
        try {
            if (typeof loadProductsFromSheets === 'function') {
                this.products = await loadProductsFromSheets();
                // Also sync to localStorage as backup
                localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
            } else {
                // Fallback to localStorage
                const storedProducts = localStorage.getItem('woofcrafts_products');
                if (storedProducts) {
                    this.products = JSON.parse(storedProducts);
                }
            }
        } catch (error) {
            console.error('Error loading products:', error);
            // Fallback to localStorage
            const storedProducts = localStorage.getItem('woofcrafts_products');
            if (storedProducts) {
                this.products = JSON.parse(storedProducts);
            }
        }
        
        // Initialize default products if none exist
        if (this.products.length === 0) {
            this.initializeDefaultProducts();
        }
    }

    initializeDefaultProducts() {
        const defaultProducts = [
            {
                id: 'prod_charm_3for8',
                name: '3 Charms for 8 Dollars',
                price: 8.00,
                category: 'tags',
                image: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E'
            },
            {
                id: 'prod_nfc_additional',
                name: 'Additional NFC (5 SGD)',
                price: 5.00,
                category: 'tags',
                image: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E'
            },
            {
                id: 'prod_charm_takehome',
                name: 'Charm Take Home Already',
                price: 0.00,
                category: 'tags',
                image: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E'
            },
            {
                id: 'prod_charm_reserved',
                name: 'Charm Reserved',
                price: 0.00,
                category: 'tags',
                image: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E'
            }
        ];
        
        this.products = defaultProducts;
        localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
        
        // Try to save to Sheets if available
        if (typeof saveAllProductsToSheets === 'function') {
            saveAllProductsToSheets(this.products).catch(err => {
                console.error('Error saving default products to Sheets:', err);
            });
        }
    }

    loadCart() {
        const storedCart = localStorage.getItem('woofcrafts_cart');
        if (storedCart) {
            this.cart = JSON.parse(storedCart);
        }
    }

    saveCart() {
        localStorage.setItem('woofcrafts_cart', JSON.stringify(this.cart));
    }

    filterProducts() {
        let filtered = [...this.products];
        
        // Apply search filter
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(product => 
                product.name.toLowerCase().includes(query) ||
                (product.category && product.category.toLowerCase().includes(query)) ||
                (product.tags && product.tags.some(tag => tag.toLowerCase().includes(query)))
            );
        }
        
        // Apply category filter
        if (this.currentFilter !== 'all') {
            if (this.currentFilter === 'tags') {
                filtered = filtered.filter(product => 
                    product.category === 'tags' || 
                    (product.tags && product.tags.length > 0)
                );
            } else if (this.currentFilter === 'photoframes') {
                filtered = filtered.filter(product => 
                    product.category === 'photoframes' ||
                    product.name.toLowerCase().includes('frame') ||
                    product.name.toLowerCase().includes('photo')
                );
            }
        }
        
        this.filteredProducts = filtered;
        this.renderProducts();
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');
        const productsToShow = this.filteredProducts.length > 0 ? this.filteredProducts : this.products;
        
        if (productsToShow.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🐶</span>
                    <p>${this.searchQuery || this.currentFilter !== 'all' ? 'No products match your search!' : 'No products available yet!'}</p>
                    ${!this.searchQuery && this.currentFilter === 'all' ? '<a href="products.html" class="empty-link">Add your first product here 🎉</a>' : ''}
                </div>
            `;
            return;
        }

        grid.innerHTML = productsToShow.map(product => {
            const category = product.category || 'general';
            const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
            return `
                <div class="product-card" onclick="posApp.addToCart('${product.id}')">
                    ${category !== 'general' ? `<div class="product-category-badge">${categoryLabel}</div>` : ''}
                    <img src="${product.image}" alt="${product.name}" class="product-image" 
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E'">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
                    <button class="quick-add-btn" onclick="event.stopPropagation(); posApp.addToCart('${product.id}')" title="Quick Add">+</button>
                </div>
            `;
        }).join('');
    }

    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        const existingItem = this.cart.find(item => item.productId === productId);
        
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
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.productId !== productId);
        this.saveCart();
        this.renderCart();
    }

    updateQuantity(productId, change) {
        const item = this.cart.find(item => item.productId === productId);
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

        cartItems.innerHTML = this.cart.map(item => {
            const subtotal = item.price * item.quantity;
            const imageSrc = item.image || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'70\' height=\'70\'%3E%3Crect fill=\'%23FAF7F3\' width=\'70\' height=\'70\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'20\'%3E🐕%3C/text%3E%3C/svg%3E';
            return `
                <div class="cart-item">
                    <img src="${imageSrc}" alt="${item.name}" class="cart-item-thumbnail" 
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'70\' height=\'70\'%3E%3Crect fill=\'%23FAF7F3\' width=\'70\' height=\'70\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'20\'%3E🐕%3C/text%3E%3C/svg%3E'">
                    <div class="cart-item-main">
                        <div class="cart-item-details">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
                        </div>
                        <div class="cart-item-controls">
                            <button class="quantity-btn" onclick="posApp.updateQuantity('${item.productId}', -1)">-</button>
                            <span class="quantity-display">${item.quantity}</span>
                            <button class="quantity-btn" onclick="posApp.updateQuantity('${item.productId}', 1)">+</button>
                        </div>
                        <div class="cart-item-total">$${subtotal.toFixed(2)}</div>
                        <button class="remove-btn" onclick="posApp.removeFromCart('${item.productId}')" title="Remove">🗑️</button>
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
        discountBtn.disabled = true;
        discountBtn.innerHTML = '<span>✅</span> Discount Applied <span class="discount-badge">5%</span>';
    }

    clearDiscount() {
        this.discountApplied = false;
        const discountBtn = document.getElementById('discount-btn');
        discountBtn.disabled = false;
        discountBtn.innerHTML = '<span>🎁</span> Apply 5% Discount';
        this.updateTotals();
    }

    updateTotals() {
        const subtotal = this.calculateSubtotal();
        const discountPercent = this.discountApplied ? 0.05 : 0;
        const discountAmount = subtotal * discountPercent;
        const total = subtotal - discountAmount;

        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('total').textContent = `$${total.toFixed(2)}`;

        const discountAmountEl = document.getElementById('discount-amount');
        if (this.discountApplied && discountAmount > 0) {
            discountAmountEl.textContent = `-$${discountAmount.toFixed(2)}`;
            discountAmountEl.classList.remove('hidden');
        } else {
            discountAmountEl.classList.add('hidden');
        }
    }

    clearCart() {
        if (confirm('Are you sure you want to clear the cart?')) {
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
        document.getElementById('customer-email').value = '';
        document.getElementById('customer-phone').value = '';
        const commentField = document.getElementById('customer-comment');
        if (commentField) commentField.value = '';
    }

    validateCheckout() {
        const email = document.getElementById('customer-email').value.trim();
        if (!email) {
            alert('Please enter customer email address');
            return false;
        }
        if (this.cart.length === 0) {
            alert('Cart is empty. Please add items to cart.');
            return false;
        }
        return true;
    }

    async sendOrderEmail() {
        if (!this.validateCheckout()) return;

        const customerName = document.getElementById('customer-name').value.trim() || 'Customer';
        const customerEmail = document.getElementById('customer-email').value.trim();
        const customerPhone = document.getElementById('customer-phone').value.trim();
        
        const subtotal = this.calculateSubtotal();
        const discountPercent = this.discountApplied ? 0.05 : 0;
        const discountAmount = subtotal * discountPercent;
        const total = subtotal - discountAmount;

        // Generate order ID
        const orderId = 'WC-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

        const customerComment = document.getElementById('customer-comment')?.value.trim() || '';

        const orderDetails = {
            orderId: orderId,
            customerName: customerName,
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

        // Show email preview first
        this.showEmailPreview(orderDetails);

        try {
            await sendOrderConfirmationEmail(orderDetails);
            // Save to Google Sheets if configured
            try {
                await this.saveOrderToSheets(orderDetails);
            } catch (sheetsError) {
                console.error('Error saving to Sheets (non-critical):', sheetsError);
                // Don't block the flow if Sheets fails
            }
            alert('Order email sent successfully!');
            this.clearCart();
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Failed to send email: ' + (error.message || 'Please check your EmailJS configuration.'));
        }
    }

    showEmailPreview(orderDetails) {
        const emailContent = generateEmailContent(orderDetails);
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Email Preview - Order Confirmation</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                        .email-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
                        h1 { color: #4A90E2; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th { background-color: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #4A90E2; }
                        td { padding: 8px; border-bottom: 1px solid #eee; }
                        .total-section { margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee; }
                        .total-row { text-align: right; font-size: 1.2em; color: #4A90E2; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        ${emailContent}
                    </div>
                </body>
            </html>
        `);
        previewWindow.document.close();
    }

    async saveOrderToSheets(orderDetails) {
        // Save to Google Sheets if configured
        if (typeof saveOrderToSheets === 'function') {
            await saveOrderToSheets(orderDetails);
        }
    }

    setupEventListeners() {
        // Discount button
        document.getElementById('discount-btn').addEventListener('click', () => {
            this.applyDiscount();
        });

        // Clear cart button (removed from HTML, keeping for compatibility)
        const clearCartBtn = document.getElementById('clear-cart-btn');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', () => {
                this.clearCart();
            });
        }

        // Reset cart button
        document.getElementById('reset-cart-btn').addEventListener('click', () => {
            this.resetCart();
        });

        // Send email button
        document.getElementById('send-email-btn').addEventListener('click', () => {
            this.sendOrderEmail();
        });

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.filterProducts();
            });
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update filter
                this.currentFilter = e.target.dataset.filter;
                this.filterProducts();
            });
        });

        // Reload products when page becomes visible (in case products were added in another tab)
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                await this.loadProducts();
                this.filteredProducts = [];
                this.filterProducts();
            }
        });
    }
}

// Initialize the POS app
let posApp;
document.addEventListener('DOMContentLoaded', async () => {
    posApp = new POSApp();
});

