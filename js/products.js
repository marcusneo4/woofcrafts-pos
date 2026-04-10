// WoofCrafts POS System - Product Management Logic
// Requires js/utils.js (escapeHtml, safeImageSrc, PLACEHOLDER_LIST)

class ProductManager {
    constructor() {
        this.products = [];
        this.editingId = null;
        this.supabaseClientPromise = null;
        
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.renderProducts();
        this.setupEventListeners();
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

                if (Array.isArray(data)) {
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
            } catch (error) {
                console.error('Could not load products from Supabase:', error);
                this.products = [];
                return;
            }
        }

        // Product management is shared-mode only; require Supabase config.
        console.warn('Supabase is not configured. Product management is disabled.');
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

    generateUuidV4() {
        if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);

            // UUID v4 version + variant bits
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;

            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        }

        // Last resort for older browsers
        return this.generateId();
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

    async upsertProduct({ productId, title, description, price, category, imageUrl }) {
        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) throw new Error('Supabase is not configured (missing window.SUPABASE_CONFIG)');

        const config = this.getSupabaseConfig();
        const tableName = config.supabaseProductsTable || 'products';

        const payload = {
            id: productId,
            title: title,
            description: description && description.trim().length > 0 ? description.trim() : null,
            price: price,
            category: category,
            image_url: imageUrl
        };

        const { error } = await supabaseClient.from(tableName).upsert(payload, { onConflict: 'id' });
        if (error) {
            throw new Error(`Supabase upsert failed: ${error.message}`);
        }
    }

    async deleteProductFromSupabase(productId) {
        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) throw new Error('Supabase is not configured (missing window.SUPABASE_CONFIG)');

        const config = this.getSupabaseConfig();
        const tableName = config.supabaseProductsTable || 'products';

        const { error } = await supabaseClient.from(tableName).delete().eq('id', productId);
        if (error) {
            throw new Error(`Supabase delete failed: ${error.message}`);
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

    async uploadProductImageToSupabase(file, productId) {
        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) throw new Error('Supabase is not configured (missing window.SUPABASE_CONFIG)');

        const config = this.getSupabaseConfig();
        const bucketName = config.supabaseStorageBucket || 'product-images';

        const originalName = file.name || 'product-image';
        const sanitizedFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');

        // Deterministic path: stable per product id + original filename
        const storagePath = `products/${productId}/${sanitizedFilename}`;

        try {
            const { error: uploadError } = await supabaseClient.storage
                .from(bucketName)
                .upload(storagePath, file, {
                    contentType: file.type || 'application/octet-stream',
                    upsert: true
                });

            if (uploadError) {
                throw new Error(`Supabase storage upload failed: ${uploadError.message}`);
            }

            const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(storagePath);
            if (!data || !data.publicUrl) {
                throw new Error('Supabase storage did not return a publicUrl');
            }

            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading image to Supabase Storage:', error);
            console.warn('Falling back to data URL storage');
            return await this.saveImageAsDataURL(file);
        }
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const name = (formData.get('name') || '').toString().trim();
        const description = (formData.get('description') || '').toString().trim();
        const price = parseFloat(formData.get('price') || 0);
        const category = (formData.get('category') || 'general').toLowerCase();
        const imageFile = formData.get('image');

        if (!name || !price || price <= 0) {
            ui.showToast('Please fill in all fields with valid values', 'error');
            return;
        }

        // For new products, image is required. For editing, image is optional (keep existing)
        let imagePath = null;

        const supabaseClient = await this.getSupabaseClient();
        const isSupabaseConfigured = Boolean(supabaseClient);
        if (!isSupabaseConfigured) {
            ui.showToast('Supabase is not configured. Product changes cannot be saved.', 'error');
            return;
        }

        const wasEditing = Boolean(this.editingId);
        const productId = this.editingId || this.generateUuidV4();
        if (imageFile && imageFile.size > 0) {
            // Upload image to Supabase Storage
            imagePath = await this.uploadProductImageToSupabase(imageFile, productId);
        } else if (this.editingId) {
            // If editing and no new image, keep the existing image
            const existingProduct = this.products.find(p => p.id == this.editingId || String(p.id) === String(this.editingId));
            if (existingProduct) {
                imagePath = existingProduct.image;
            }
        }

        if (!imagePath) {
            ui.showToast('Please select an image', 'error');
            return;
        }

        try {
            await this.upsertProduct({
                productId,
                title: name,
                description: description,
                price: price,
                category: category,
                imageUrl: imagePath
            });

            // Reload from Supabase to keep the list consistent
            await this.loadProducts();

            this.renderProducts();
            this.resetForm();

            const action = wasEditing ? 'updated' : 'added';
            ui.showToast(`Product ${action} successfully!`, 'success');

            // Notify other pages that products were updated
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            sessionStorage.setItem('woofcrafts_products_updated', Date.now().toString());
        } catch (error) {
            console.error('Error saving product:', error);
            ui.showToast('Error saving product. Please try again.', 'error');
        }
    }

    editProduct(productId) {
        const product = this.products.find(p => p.id == productId || String(p.id) === String(productId));
        if (!product) return;

        this.editingId = productId;
        document.getElementById('product-id').value = productId;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-category').value = (product.category || 'general').toLowerCase();

        const descriptionEl = document.getElementById('product-description');
        if (descriptionEl) descriptionEl.value = product.description || '';
        
        const preview = document.getElementById('image-preview');
        const imgSrc = safeImageSrc(product.image);
        preview.innerHTML = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="Current image">`
            : '<div class="preview-placeholder"><span>🐕</span><p>No image</p></div>';
        
        // Update form button
        document.getElementById('submit-btn').innerHTML = '<span>✏️</span> Update Product';
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        
        // Scroll to form
        document.querySelector('.add-product-section').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteProduct(productId) {
        if (!await ui.confirm('Are you sure you want to delete this product?', 'Delete Product')) return;
        try {
            const supabaseClient = await this.getSupabaseClient();
            const isSupabaseConfigured = Boolean(supabaseClient);
            if (!isSupabaseConfigured) {
                ui.showToast('Supabase is not configured. Product deletion is disabled.', 'error');
                return;
            }

            await this.deleteProductFromSupabase(productId);
            await this.loadProducts();
            this.renderProducts();

            ui.showToast('Product deleted successfully!', 'success');

            // Notify other pages that products were updated
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            sessionStorage.setItem('woofcrafts_products_updated', Date.now().toString());
        } catch (error) {
            console.error('Error deleting product:', error);
            ui.showToast('Error deleting product. Please try again.', 'error');
        }
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
        document.getElementById('cancel-edit-btn').classList.add('hidden');
    }

    renderProducts() {
        const list = document.getElementById('products-list');
        if (!list) return;

        if (this.products.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📦</span>
                    <p>No products yet!</p>
                    <p class="empty-state-note">Add your first pawsome product above! 🎉</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.products.map(product => {
            const productName = escapeHtml(product.name || '');
            let imageSrc = safeImageSrc(product.image) || PLACEHOLDER_LIST;
            if (!imageSrc) imageSrc = PLACEHOLDER_LIST;

            return `
            <div class="product-list-item">
                <img src="${escapeHtml(imageSrc)}" alt="${productName}" class="product-list-image"
                     onerror="this.onerror=null; this.src='${PLACEHOLDER_LIST}'">
                <div class="product-list-info">
                    <div class="product-list-name">${productName}</div>
                    <div class="product-list-price">$${parseFloat(product.price).toFixed(2)}</div>
                </div>
                <div class="product-list-actions">
                    <button class="btn-edit" onclick='productManager.editProduct(${JSON.stringify(product.id)})' title="Edit product details and image">✏️ Edit</button>
                    <button class="btn-delete" onclick='productManager.deleteProduct(${JSON.stringify(product.id)})' title="Delete this product">🗑️ Delete</button>
                </div>
            </div>
        `;
        }).join('');
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
        window.location.href = 'index.html';
        return;
    }
    
    productManager = new ProductManager();
});

