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
        // Get fixed/default products first
        const fixedProducts = this.getFixedProducts();
        
        // Load from localStorage
        const storedProducts = localStorage.getItem('woofcrafts_products');
        if (storedProducts) {
            try {
                const parsed = JSON.parse(storedProducts);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge fixed products with stored products (avoid duplicates)
                    const fixedIds = fixedProducts.map(p => p.id);
                    const otherProducts = parsed.filter(p => !fixedIds.includes(p.id));
                    this.products = [...fixedProducts, ...otherProducts];
                    console.log(`Loaded ${otherProducts.length} custom products + ${fixedProducts.length} fixed products`);
                    return;
                }
            } catch (e) {
                console.error('Error parsing stored products:', e);
            }
        }
        
        // Default to fixed products only
        this.products = [...fixedProducts];
        console.log(`Loaded ${this.products.length} fixed products`);
    }
    
    async refreshProducts() {
        // Force reload products and re-render
        console.log('Refreshing products...');
        await this.loadProducts();
        this.renderProducts();
        console.log(`✓ Products refreshed: ${this.products.length} total`);
    }

    getFixedProducts() {
        // These are the fixed products that should ALWAYS be included
        return [
            {
                id: 'prod_charm_3for8',
                name: '3 Charms',
                price: 8.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_3_Charms___8.00-03abd3dc-cf65-4586-83d4-b4e8b9b878ba.png'
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
            },
            {
                id: 'prod_big_alphabet_tag',
                name: 'Big Alphabet Tag',
                price: 22.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Big_Alphabet_Tag___22.00-272916bd-5deb-4392-b0be-55646bfe8b23.png'
            },
            {
                id: 'prod_christmas_tag_brown',
                name: 'Christmas Tag - Brown',
                price: 25.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Christmas_Tag___Brown___25.00-e7e512ab-3871-4b87-b6eb-9be0fbb55773.png'
            },
            {
                id: 'prod_christmas_tag_green',
                name: 'Christmas Tag - Green',
                price: 25.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Christmas_Tag___Green___25.00-9a7f6549-b5d0-4991-aed4-88e5b03228e8.png'
            },
            {
                id: 'prod_big_identification_tag',
                name: 'Big Identification Tag',
                price: 35.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Big_Identification_Tag___35.00-ce1bf829-5714-4969-8b58-516cc15a61c7.png'
            },
            {
                id: 'prod_photo_stand',
                name: 'Photo Stand',
                price: 10.00,
                category: 'accessories',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Photo_Stand___10.00-40da5852-39f2-4e4c-a12e-117ca5adb72a.png'
            },
            {
                id: 'prod_christmas_socks_ornament',
                name: 'Christmas Socks Ornament',
                price: 20.00,
                category: 'accessories',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Christmas_Socks_Ornament___20.00-556fe47b-f209-4682-b114-d1e5bad7dd6e.png'
            },
            {
                id: 'prod_small_alphabet_tag',
                name: 'Small Alphabet Tag',
                price: 20.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Small_Alphabet_Tag___20.00-9f649218-ac68-41c7-a808-7cc69f798289.png'
            },
            {
                id: 'prod_small_identification_tag',
                name: 'Small Identification Tag',
                price: 30.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Small_Identification_Tag___30.00-f9ac5c05-0308-40f2-95bc-89b137878514.png'
            },
            {
                id: 'prod_charms',
                name: 'Charms',
                price: 3.00,
                category: 'tags',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Charms___3.00-66ca6a92-b528-4169-866a-d68a8dd2200c.png'
            },
            {
                id: 'prod_christmas_photo_frame',
                name: 'Christmas Photo Frame',
                price: 15.00,
                category: 'accessories',
                image: 'assets/c__Users_e0775081_AppData_Roaming_Cursor_User_workspaceStorage_89a4e33640f1fcbbb8cbbefca162406f_images_Christmas_Photo_Frame___15.00-539d5964-757a-4969-9930-48b5fd0c187d.png'
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
        
        console.log('✓ Products rendered successfully');
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
            // Send email using Nodemailer backend
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
        } catch (error) {
            console.error('Error sending email:', error);
            alert('❌ Failed to send email: ' + (error.message || 'Please check your email configuration.\n\nMake sure the server is running with: npm start'));
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

// Initialize the POS app
let posApp;
document.addEventListener('DOMContentLoaded', async () => {
    posApp = new POSApp();
    
    // Double-check that products are rendered after a short delay
    // This helps catch any timing issues
    setTimeout(() => {
        if (posApp && posApp.products && posApp.products.length > 0) {
            const grid = document.getElementById('products-grid');
            if (grid) {
                const hasProducts = grid.querySelector('.product-card');
                if (!hasProducts) {
                    console.warn('Products exist but not rendered! Forcing re-render...');
                    posApp.renderProducts();
                }
            }
        }
    }, 500);
});

