// WoofCrafts POS System - Product Management Logic

class ProductManager {
    constructor() {
        this.products = [];
        this.editingId = null;
        
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.renderProducts();
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
                        this.renderProducts();
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
    }

    async saveProducts() {
        // Save to localStorage first (for immediate UI update)
        localStorage.setItem('woofcrafts_products', JSON.stringify(this.products));
        
        // Then sync to Google Sheets
        try {
            if (typeof saveAllProductsToSheets === 'function') {
                await saveAllProductsToSheets(this.products);
            }
        } catch (error) {
            console.error('Error saving products to Google Sheets:', error);
            // Continue even if Sheets fails
        }
    }

    generateId() {
        return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const preview = document.getElementById('image-preview');
        const reader = new FileReader();

        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };

        reader.readAsDataURL(file);
    }

    async saveImageAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const name = formData.get('name').trim();
        const price = parseFloat(formData.get('price'));
        const category = formData.get('category') || 'general';
        const imageFile = formData.get('image');

        if (!name || !price || price <= 0) {
            alert('Please fill in all fields with valid values');
            return;
        }

        if (!imageFile || imageFile.size === 0) {
            alert('Please select an image');
            return;
        }

        try {
            const imageDataUrl = await this.saveImageAsDataURL(imageFile);
            const productId = this.editingId || this.generateId();

            const product = {
                id: productId,
                name: name,
                price: price,
                category: category,
                image: imageDataUrl
            };

            if (this.editingId) {
                // Update existing product
                const index = this.products.findIndex(p => p.id === this.editingId);
                if (index !== -1) {
                    this.products[index] = product;
                }
            } else {
                // Add new product
                this.products.push(product);
            }

            await this.saveProducts();
            this.renderProducts();
            this.resetForm();
            this.showMessage('Product saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product. Please try again.');
        }
    }

    editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        this.editingId = productId;
        document.getElementById('product-id').value = productId;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-category').value = product.category || 'general';
        
        // Show image preview
        // Show image preview
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `<img src="${product.image}" alt="Current image">`;
        
        // Update form button
        document.getElementById('submit-btn').innerHTML = '<span>✏️</span> Update Product';
        document.getElementById('cancel-edit-btn').style.display = 'block';
        
        // Scroll to form
        document.querySelector('.add-product-section').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        this.products = this.products.filter(p => p.id !== productId);
        
        // Delete from Google Sheets
        try {
            if (typeof deleteProductFromSheets === 'function') {
                await deleteProductFromSheets(productId);
            }
        } catch (error) {
            console.error('Error deleting product from Google Sheets:', error);
        }
        
        await this.saveProducts();
        this.renderProducts();
        this.showMessage('Product deleted successfully!', 'success');
    }

    resetForm() {
        document.getElementById('product-form').reset();
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `
            <div class="preview-placeholder">
                <span>🐕</span>
                <p>Image preview will appear here</p>
            </div>
        `;
        document.getElementById('product-id').value = '';
        this.editingId = null;
        document.getElementById('submit-btn').innerHTML = '<span>➕</span> Add Product';
        document.getElementById('cancel-edit-btn').style.display = 'none';
    }

    renderProducts() {
        const list = document.getElementById('products-list');
        
        if (this.products.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>No products yet!</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">Add your first pawsome product above! 🎉</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.products.map(product => `
            <div class="product-list-item">
                <img src="${product.image}" alt="${product.name}" class="product-list-image"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'90\' height=\'90\'%3E%3Crect fill=\'%23FAF7F3\' width=\'90\' height=\'90\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'20\'%3E🐕%3C/text%3E%3C/svg%3E'">
                <div class="product-list-info">
                    <div class="product-list-name">${product.name}</div>
                    <div class="product-list-price">$${parseFloat(product.price).toFixed(2)}</div>
                </div>
                <div class="product-list-actions">
                    <button class="btn-edit" onclick="productManager.editProduct('${product.id}')">✏️ Edit</button>
                    <button class="btn-delete" onclick="productManager.deleteProduct('${product.id}')">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    }

    showMessage(message, type) {
        // Remove existing messages
        const existing = document.querySelector('.message');
        if (existing) existing.remove();

        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        const form = document.getElementById('product-form');
        form.parentNode.insertBefore(messageEl, form);

        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    setupEventListeners() {
        document.getElementById('product-form').addEventListener('submit', (e) => {
            this.handleFormSubmit(e);
        });

        document.getElementById('product-image').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        document.getElementById('cancel-edit-btn').addEventListener('click', () => {
            this.resetForm();
        });
    }
}

// Initialize the product manager
let productManager;
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (sessionStorage.getItem('woofcrafts_authenticated') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    productManager = new ProductManager();
});

