// WoofCrafts POS System - Main Application Logic

class POSApp {
    constructor() {
        this.cart = [];
        this.discountApplied = false;
        this.products = [];
        
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
            
            // Ensure products array is always valid
            if (!Array.isArray(this.products) || this.products.length === 0) {
                console.log('No products found, initializing with fixed products...');
                this.products = this.getFixedProducts();
                localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
            }
            
            this.loadCart();
            console.log(`✓ Successfully loaded ${this.products.length} products`);
            this.renderProducts();
            this.renderCart();
            this.setupEventListeners();
        } catch (error) {
            console.error('Error initializing POS:', error);
            // Fallback to fixed products
            this.products = this.getFixedProducts();
            localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
            this.renderProducts();
            this.renderCart();
            this.setupEventListeners();
        }
    }

    async loadProducts() {
        try {
            // First, try to load from products.json
            const response = await fetch('data/products.json');
            if (response.ok) {
                const data = await response.json();
                if (data.products && Array.isArray(data.products)) {
                    this.products = data.products;
                    localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
                    console.log(`✓ Loaded ${this.products.length} products from products.json`);
                    return;
                }
            }
        } catch (error) {
            console.warn('Could not load products.json, falling back to localStorage:', error);
        }
        
        // Fallback to localStorage if products.json fails
        const storedProducts = localStorage.getItem('woofcrafts_products');
        if (storedProducts) {
            try {
                this.products = JSON.parse(storedProducts);
                console.log(`✓ Loaded ${this.products.length} products from localStorage`);
                return;
            } catch (error) {
                console.error('Error parsing stored products:', error);
            }
        }
        
        // Last resort: use fixed products
        this.products = this.getFixedProducts();
        localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
        console.log(`✓ Using ${this.products.length} default products`);
    }
    
    async refreshProducts() {
        // Force reload products and re-render
        console.log('Refreshing products...');
        await this.loadProducts();
        this.renderProducts();
        console.log(`✓ Products refreshed: ${this.products.length} total`);
    }

    // Helper function to get image path for a product name
    getProductImagePath(productName) {
        // Map product names to image filenames
        const imageMap = {
            '3 Charms': '3 Charms  $8.00.jpg',
            'Big Alphabet Tag': 'Big Alphabet Tag  $22.00.jpg',
            'Big Identification Tag': 'Big Identification Tag  $35.00.jpg',
            'Charms': 'Charms  $3.00.jpg',
            'Christmas Photo Frame': 'Christmas Photo Frame  $15.00.jpg',
            'Christmas Socks Ornament': 'Christmas Socks Ornament  $20.00.jpg',
            'Christmas Tag - Brown': 'Christmas Tag – Brown  $25.00.jpg',
            'Christmas Tag - Green': 'Christmas Tag – Green  $25.00.jpg',
            'Photo Stand': 'Photo Stand  $10.00.jpg',
            'Small Alphabet Tag': 'Small Alphabet Tag  $20.00.jpg',
            'Small Identification Tag': 'Small Identification Tag  $30.00.jpg'
        };
        
        const imageFilename = imageMap[productName];
        if (imageFilename) {
            // Encode the filename for URL
            return `/product-images/${encodeURIComponent(imageFilename)}`;
        }
        
        // Fallback to placeholder
        return 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E';
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
                image: '/assets/Dog product images/Big Identification Tag.jpg',
                description: 'Large identification tag for your furry friend'
            },
            {
                id: 2,
                name: 'Small Identification Tag',
                price: 30.00,
                category: 'tags',
                image: '/assets/Dog product images/Small Identification Tag.jpg',
                description: 'Compact identification tag for smaller pets'
            },
            {
                id: 3,
                name: 'Big Alphabet Tag',
                price: 22.00,
                category: 'tags',
                image: '/assets/Dog product images/Big Alphabet Tag.jpg',
                description: 'Large alphabet-style pet tag'
            },
            {
                id: 4,
                name: 'Small Alphabet Tag',
                price: 20.00,
                category: 'tags',
                image: '/assets/Dog product images/Small Alphabet Tag.jpg',
                description: 'Small alphabet-style pet tag'
            },
            // ADD ONS Category
            {
                id: 5,
                name: 'NFC',
                price: 5.00,
                category: 'addons',
                image: '/assets/dog-placeholder.png',
                description: 'NFC chip addon for smart pet tracking'
            },
            {
                id: 6,
                name: 'Charms',
                price: 4.00,
                category: 'addons',
                image: '/assets/Dog product images/Charms.jpg',
                description: 'Decorative charms for pet accessories'
            },
            {
                id: 7,
                name: 'Photo Stand',
                price: 10.00,
                category: 'addons',
                image: '/assets/Dog product images/Photo Stand.jpg',
                description: 'Display stand for your pet\'s photo'
            },
            // CHRISTMAS SPECIALS Category
            {
                id: 8,
                name: 'Christmas Tag',
                price: 25.00,
                category: 'christmas',
                image: '/assets/Dog product images/Christmas Tag – Brown.jpg',
                description: 'Festive Christmas-themed pet tag'
            },
            {
                id: 9,
                name: 'Christmas Socks',
                price: 20.00,
                category: 'christmas',
                image: '/assets/Dog product images/Christmas Socks Ornament.jpg',
                description: 'Holiday socks ornament for your pet'
            },
            {
                id: 10,
                name: 'Christmas Photoframe',
                price: 15.00,
                category: 'christmas',
                image: '/assets/Dog product images/Christmas Photo Frame.jpg',
                description: 'Festive photo frame for pet pictures'
            },
            // PROMOTION - 3 Charms Option
            {
                id: 11,
                name: '3 Charms',
                price: 10.00,
                category: 'promotion',
                image: '/assets/Dog product images/3 Charms.jpg',
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
            this.cart = JSON.parse(storedCart);
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
            const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
            
            // Ensure image path is valid - handle both data URLs and file paths
            let imageSrc = product.image || '';
            const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E';
            
            // If no image provided, use fallback immediately
            if (!imageSrc) {
                imageSrc = fallbackImage;
            } else if (imageSrc && !imageSrc.startsWith('data:') && !imageSrc.startsWith('http://') && !imageSrc.startsWith('https://')) {
                // For file paths, keep them as-is (they should start with /)
                console.log(`📸 Loading image for ${product.name}: ${imageSrc}`);
            }
            
            return `
                <div class="product-card" onclick="safeAddToCart(${product.id})">
                    ${category !== 'general' ? `<div class="product-category-badge">${categoryLabel}</div>` : ''}
                    <img src="${imageSrc}" alt="${product.name}" class="product-image" 
                         onerror="this.onerror=null; this.src='${fallbackImage}'; console.warn('❌ Image failed to load: ${imageSrc}')"
                         onload="console.log('✓ Image loaded: ${product.name}')">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
                    <button class="quick-add-btn" onclick="event.stopPropagation(); safeAddToCart(${product.id})" title="Quick Add">+</button>
                </div>
            `;
        }).join('');
        
        console.log('✓ Products rendered successfully');
    }

    addToCart(productId) {
        try {
            console.log('🛒 addToCart called with productId:', productId);
            
            // Convert productId to number if it's a string (from HTML onclick)
            const numericId = typeof productId === 'string' ? parseInt(productId) : productId;
            console.log('🔍 Looking for product with ID:', numericId);
            console.log('📦 Available products:', this.products.length);
            
            const product = this.products.find(p => p.id == numericId);
            if (!product) {
                console.error(`❌ Product not found: ${productId}`, 'Available IDs:', this.products.map(p => p.id));
                alert('Product not found! Please refresh the page.');
                return;
            }

            console.log('✓ Found product:', product.name);

            const existingItem = this.cart.find(item => item.productId == numericId);
            
            if (existingItem) {
                existingItem.quantity += 1;
                console.log(`✓ Updated quantity for ${product.name}: ${existingItem.quantity}`);
            } else {
                this.cart.push({
                    productId: product.id,
                    name: product.name,
                    price: parseFloat(product.price),
                    image: product.image,
                    quantity: 1
                });
                console.log(`✓ Added new item to cart: ${product.name}`);
            }

            console.log('💾 Saving cart...');
            this.saveCart();
            
            console.log('🎨 Rendering cart...');
            this.renderCart();
            
            console.log('✅ Cart updated successfully! Total items:', this.cart.length);
            
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
            alert('Error adding to cart: ' + error.message);
        }
    }

    removeFromCart(productId) {
        const numericId = typeof productId === 'string' ? parseInt(productId) : productId;
        this.cart = this.cart.filter(item => item.productId != numericId);
        this.saveCart();
        this.renderCart();
    }

    updateQuantity(productId, change) {
        const numericId = typeof productId === 'string' ? parseInt(productId) : productId;
        const item = this.cart.find(item => item.productId == numericId);
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
            const fallbackImage = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'70\' height=\'70\'%3E%3Crect fill=\'%23FAF7F3\' width=\'70\' height=\'70\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'20\'%3E🐕%3C/text%3E%3C/svg%3E';
            const imageSrc = item.image || fallbackImage;
            return `
                <div class="cart-item">
                    <img src="${imageSrc}" alt="${item.name}" class="cart-item-thumbnail" 
                         onerror="this.src='${fallbackImage}'">
                    <div class="cart-item-main">
                        <div class="cart-item-details">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
                        </div>
                        <div class="cart-item-controls">
                            <button class="quantity-btn" onclick="(window.posApp || posApp).updateQuantity(${item.productId}, -1)">-</button>
                            <span class="quantity-display">${item.quantity}</span>
                            <button class="quantity-btn" onclick="(window.posApp || posApp).updateQuantity(${item.productId}, 1)">+</button>
                        </div>
                        <div class="cart-item-total">$${subtotal.toFixed(2)}</div>
                        <button class="remove-btn" onclick="(window.posApp || posApp).removeFromCart(${item.productId})" title="Remove">🗑️</button>
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

        // Generate 4-digit order ID
        const orderId = String(Math.floor(1000 + Math.random() * 9000));

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
            // Check if EmailJS is available (for GitHub Pages deployment)
            if (typeof emailjs !== 'undefined') {
                // Using EmailJS for client-side email sending
                // Initialize EmailJS with your public key
                emailjs.init('pItLrmthOdxpZRMEw');
                
                // Format items for email as HTML table rows
                const escapeHtml = (text) => {
                    if (!text) return '';
                    const map = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#039;'
                    };
                    return String(text).replace(/[&<>"']/g, m => map[m]);
                };
                
                const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;
                
                const itemsList = orderDetails.items.map((item) => {
                    // Create structured HTML rows as compact single-line for email compatibility
                    return `<tr><td class="item-col" style="padding: 12px 14px; font-family: Arial, sans-serif; font-size: 14.5px; color:#5C4A37; font-weight: 700;">${escapeHtml(item.name)}</td><td class="qty-col" align="center" style="padding: 12px 8px; font-family: Arial, sans-serif; font-size: 14.5px; color:#5C4A37; font-weight: 700; width:70px; text-align: center;">${item.quantity}</td><td class="price-col" align="right" style="padding: 12px 10px; font-family: Arial, sans-serif; font-size: 14.5px; color:#5C4A37; font-weight: 700; width:110px; text-align: right;">${formatCurrency(item.price)}</td><td class="total-col" align="right" style="padding: 12px 14px; font-family: Arial, sans-serif; font-size: 15px; color:#D4A574; font-weight: 800; width:120px; text-align: right;">${formatCurrency(item.subtotal)}</td></tr>`;
                }).join('');
                
                const templateParams = {
                    to_email: orderDetails.customerEmail,
                    customer_name: orderDetails.customerName,
                    order_id: orderDetails.orderId,
                    order_date: new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    items_list: itemsList,
                    subtotal: `$${orderDetails.subtotal.toFixed(2)}`,
                    discount: orderDetails.discountAmount > 0 ? `$${orderDetails.discountAmount.toFixed(2)} (${orderDetails.discountPercent}%)` : 'None',
                    total: `$${orderDetails.total.toFixed(2)}`,
                    customer_note: orderDetails.customerComment || 'No special instructions',
                    contact_number: orderDetails.customerPhone || 'Not provided'
                };
                
                // Send using EmailJS
                await emailjs.send('service_t1mlwir', 'template_iqb8umq', templateParams);
                
                alert('🐾 Order email sent successfully to ' + orderDetails.customerEmail + '! 🐶\n\nOrder ID: #' + orderDetails.orderId);
                this.clearCart();
            } else {
                // Fallback: Try Node.js backend (for local development)
                const response = await fetch('/api/send-order-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        customerName: orderDetails.customerName,
                        customerEmail: orderDetails.customerEmail,
                        orderId: orderDetails.orderId,
                        orderDate: new Date().toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
                        items: orderDetails.items,
                        subtotal: orderDetails.subtotal,
                        discount: orderDetails.discountAmount,
                        total: orderDetails.total,
                        customerNote: orderDetails.customerComment,
                        contactNumber: orderDetails.customerPhone
                    })
                });

                const result = await response.json();
                
                if (result.success) {
                    alert('🐾 Order email sent successfully to ' + orderDetails.customerEmail + '! 🐶\n\nMessage ID: ' + result.messageId);
                    this.clearCart();
                } else {
                    throw new Error(result.error || 'Failed to send email');
                }
            }
        } catch (error) {
            console.error('Error sending email:', error);
            alert('❌ Failed to send email: ' + (error.message || 'Unknown error') + '\n\n💡 Please check:\n1. EmailJS configuration is correct\n2. Internet connection is stable\n3. Email address is valid');
        }
    }

    showEmailPreview(orderDetails) {
        // Generate simple table-based preview with WoofCrafts colors
        const itemsTableRows = orderDetails.items.map(item => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #E8D5B7;">${item.name}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #E8D5B7;">${item.quantity}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #E8D5B7;">$${item.price.toFixed(2)}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #E8D5B7; font-weight: 600; color: #D4A574;">$${item.subtotal.toFixed(2)}</td>
            </tr>
        `).join('');

        const previewHTML = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Order Summary - #${orderDetails.orderId}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: 'Nunito', sans-serif; 
                            padding: 20px; 
                            background: #FAF7F3; 
                        }
                        .header-bar {
                            background: linear-gradient(135deg, #D4A574 0%, #C9A961 50%, #E8D5B7 100%);
                            color: white;
                            padding: 20px 30px;
                            margin: -20px -20px 30px -20px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            box-shadow: 0 4px 15px rgba(180, 148, 95, 0.25);
                        }
                        .header-bar h1 {
                            font-family: 'Fredoka One', cursive;
                            color: white;
                            font-size: 24px;
                            margin: 0;
                        }
                        .button-group {
                            display: flex;
                            gap: 10px;
                        }
                        .btn {
                            padding: 10px 20px;
                            border: none;
                            border-radius: 50px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 700;
                            transition: all 0.3s;
                            background: white;
                            color: #D4A574;
                        }
                        .btn:hover {
                            transform: translateY(-2px);
                            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                        }
                        .container { 
                            background: white; 
                            padding: 40px; 
                            border-radius: 20px; 
                            box-shadow: 0 4px 15px rgba(180, 148, 95, 0.15); 
                            max-width: 800px; 
                            margin: 0 auto; 
                        }
                        h2 {
                            font-family: 'Fredoka One', cursive;
                            color: #D4A574;
                            font-size: 28px;
                            margin-bottom: 20px;
                            text-align: center;
                        }
                        .order-info {
                            background: #FAF7F3;
                            padding: 20px;
                            border-radius: 15px;
                            margin-bottom: 30px;
                        }
                        .order-info p {
                            margin: 8px 0;
                            color: #5C4A37;
                            font-weight: 600;
                        }
                        .order-info strong {
                            color: #D4A574;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                        }
                        th {
                            background: linear-gradient(135deg, #D4A574 0%, #C9A961 100%);
                            color: white;
                            padding: 15px 12px;
                            text-align: left;
                            font-weight: 700;
                            font-size: 16px;
                        }
                        th:last-child, td:last-child {
                            text-align: right;
                        }
                        th:nth-child(2), td:nth-child(2) {
                            text-align: center;
                        }
                        th:nth-child(3), td:nth-child(3) {
                            text-align: right;
                        }
                        td {
                            padding: 12px;
                            color: #5C4A37;
                        }
                        .total-section {
                            margin-top: 30px;
                            padding-top: 20px;
                        }
                        .total-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 12px 0;
                            font-size: 18px;
                            font-weight: 600;
                            color: #5C4A37;
                        }
                        .total-final {
                            font-size: 28px;
                            font-weight: 800;
                            color: #D4A574;
                            font-family: 'Fredoka One', cursive;
                            border-top: 3px solid #E8D5B7;
                            padding-top: 15px;
                            margin-top: 10px;
                        }
                        .comments {
                            background: #FAF7F3;
                            padding: 20px;
                            border-radius: 15px;
                            margin-top: 30px;
                        }
                        .comments h3 {
                            color: #D4A574;
                            margin-bottom: 10px;
                            font-size: 18px;
                        }
                        @media print {
                            .header-bar, .button-group { display: none; }
                            body { padding: 0; background: white; }
                            .container { box-shadow: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header-bar">
                        <h1>🐾 Order Summary - #${orderDetails.orderId}</h1>
                        <div class="button-group">
                            <button class="btn" onclick="downloadPDF()">💾 Download PDF</button>
                            <button class="btn" onclick="window.print()">🖨️ Print</button>
                        </div>
                    </div>
                    <div class="container" id="orderContent">
                        <h2>WoofCrafts Order Confirmation</h2>
                        
                        <div class="order-info">
                            <p><strong>Order ID:</strong> #${orderDetails.orderId}</p>
                            <p><strong>Customer:</strong> ${orderDetails.customerName || 'Customer'}</p>
                            <p><strong>Email:</strong> ${orderDetails.customerEmail}</p>
                            ${orderDetails.customerPhone ? `<p><strong>Phone:</strong> ${orderDetails.customerPhone}</p>` : ''}
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsTableRows}
                            </tbody>
                        </table>

                        <div class="total-section">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span>$${orderDetails.subtotal.toFixed(2)}</span>
                            </div>
                            ${orderDetails.discountAmount > 0 ? `
                            <div class="total-row" style="color: #A0B58F;">
                                <span>Discount (${orderDetails.discountPercent}%):</span>
                                <span>-$${orderDetails.discountAmount.toFixed(2)}</span>
                            </div>
                            ` : ''}
                            <div class="total-row total-final">
                                <span>Total:</span>
                                <span>$${orderDetails.total.toFixed(2)}</span>
                            </div>
                        </div>

                        ${orderDetails.customerComment ? `
                        <div class="comments">
                            <h3>💬 Customer Comments</h3>
                            <p style="color: #5C4A37; line-height: 1.6;">${orderDetails.customerComment}</p>
                        </div>
                        ` : ''}
                    </div>
                    <!-- PDF Generation Libraries -->
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
                    <script>
                        function downloadPDF() {
                            if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
                                setTimeout(downloadPDF, 100);
                                return;
                            }
                            const { jsPDF } = window.jspdf;
                            const doc = new jsPDF();
                            const content = document.getElementById('orderContent');
                            html2canvas(content, {
                                scale: 2,
                                useCORS: true,
                                logging: false,
                                backgroundColor: '#ffffff'
                            }).then(canvas => {
                                const imgData = canvas.toDataURL('image/png');
                                const imgWidth = doc.internal.pageSize.getWidth();
                                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                                doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                                doc.save('WoofCrafts_Order_${orderDetails.orderId}.pdf');
                            }).catch(err => {
                                console.error('Error generating PDF:', err);
                                alert('Error generating PDF. Please try printing instead.');
                            });
                        }
                    </script>
                </body>
            </html>
        `;
        
        const previewWindow = window.open('', '_blank', 'width=900,height=800');
        if (previewWindow) {
            previewWindow.document.write(previewHTML);
            previewWindow.document.close();
        } else {
            alert('Please allow pop-ups to view the email preview.');
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
        
        // Listen for storage events (when products are updated in another tab)
        window.addEventListener('storage', async (e) => {
            if (e.key === 'woofcrafts_products') {
                await this.refreshProducts();
            }
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
        
        // Check on load and periodically
        checkForUpdates();
        setInterval(checkForUpdates, 2000); // Check every 2 seconds
    }
}

// Global helper function to safely add to cart
function safeAddToCart(productId) {
    if (!window.posApp && !posApp) {
        console.error('❌ POS App not initialized yet!');
        alert('Please wait for the app to load, then try again.');
        return;
    }
    
    const app = window.posApp || posApp;
    console.log('🛒 safeAddToCart called for product:', productId);
    app.addToCart(productId);
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
        alert('Failed to initialize the app. Please refresh the page.');
    }
});

