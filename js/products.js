// WoofCrafts POS System - Product Management Logic
// Requires js/utils.js (escapeHtml, safeImageSrc, PLACEHOLDER_LIST)

class ProductManager {
    constructor() {
        this.products = [];
        this.editingId = null;
        this.loadError = null;
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
                    .select('id,title,description,price,category,image_url,created_at,needs_details')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                this.loadError = null;

                if (Array.isArray(data)) {
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
            } catch (error) {
                console.error('Could not load products from Supabase:', error);
                // Say so on the page: an empty list that means "failed to load"
                // looks exactly like an empty list that means "no products".
                this.loadError = error.message || 'The connection failed';
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
        return window.WoofAuth.getClient();
    }

    async upsertProduct({ productId, title, description, price, category, imageUrl, needsDetails }) {
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
            image_url: imageUrl,
            needs_details: Boolean(needsDetails)
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

    /**
     * Shrink a photo before upload: phone photos are often 5-15 MB, which the bucket
     * refuses, and a huge image makes the POS grid slow to load on mobile data.
     * Returns a JPEG blob of roughly 150-300 KB, longest side 1200px.
     */
    async prepareImageForUpload(file) {
        // Product photos are shown at thumbnail size, so 900px is already more
        // than a retina screen needs. Small files keep the POS quick on mobile data.
        const MAX_SIDE = 900;
        const TARGET_BYTES = 150 * 1024;
        const HARD_LIMIT = 1024 * 1024;

        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (error) {
            throw new Error('That photo format could not be read. Save it as JPG or PNG and try again.');
        }

        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);
        if (bitmap.close) bitmap.close();

        const toBlob = (quality) => new Promise((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process that photo. Try a different one.'))), 'image/jpeg', quality);
        });

        let blob = await toBlob(0.8);
        for (const quality of [0.7, 0.6, 0.5, 0.4]) {
            if (blob.size <= TARGET_BYTES) break;
            blob = await toBlob(quality);
        }
        if (blob.size > HARD_LIMIT) {
            // Belt and braces: nothing oversized ever reaches the product list.
            throw new Error('That photo could not be made small enough. Try a simpler photo or crop it first.');
        }
        return blob;
    }

    async uploadProductImageToSupabase(file, productId) {
        const supabaseClient = await this.getSupabaseClient();
        if (!supabaseClient) throw new Error('Supabase is not configured (missing window.SUPABASE_CONFIG)');

        const config = this.getSupabaseConfig();
        const bucketName = config.supabaseStorageBucket || 'product-images';

        const blob = await this.prepareImageForUpload(file);

        // One file per product, so replacing a photo never leaves orphans behind.
        // The timestamp keeps the URL unique, so browsers don't show the old photo.
        const storagePath = `products/${productId}/photo-${Date.now()}.jpg`;

        const { error: uploadError } = await supabaseClient.storage
            .from(bucketName)
            .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

        if (uploadError) {
            // No silent fallback: a photo stored in the database row would load on
            // every POS visit and quietly slow the whole shop down.
            throw new Error(`The photo did not upload (${uploadError.message}). Check the connection and try again.`);
        }

        const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(storagePath);
        if (!data || !data.publicUrl) {
            throw new Error('The photo uploaded but no link came back. Try saving again.');
        }

        return data.publicUrl;
    }

    async handleFormSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const name = (formData.get('name') || '').toString().trim();
        const description = (formData.get('description') || '').toString().trim();
        const price = parseFloat(formData.get('price') || 0);
        const category = ((formData.get('category') || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')) || 'general';
        const imageFile = formData.get('image');

        if (!name) {
            ui.showToast('Enter a product name.', 'error');
            return;
        }
        if (!Number.isFinite(price) || price < 0) {
            ui.showToast('Enter a price of 0 or more.', 'error');
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
        const submitBtn = document.getElementById('submit-btn');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        const busy = (label) => {
            if (!submitBtn) return;
            submitBtn.disabled = true;
            submitBtn.innerHTML = iconSvg('refresh') + ' ' + label;
        };
        const done = () => {
            if (!submitBtn) return;
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        };

        if (imageFile && imageFile.size > 0) {
            busy('Uploading photo…');
            try {
                imagePath = await this.uploadProductImageToSupabase(imageFile, productId);
            } catch (error) {
                console.error('Error uploading product photo:', error);
                done();
                ui.showToast(error.message, 'error');
                return;
            }
        } else if (this.editingId) {
            // If editing and no new image, keep the existing image
            const existingProduct = this.products.find(p => p.id == this.editingId || String(p.id) === String(this.editingId));
            if (existingProduct) {
                imagePath = existingProduct.image;
            }
        }

        if (!imagePath) {
            done();
            ui.showToast('Choose a photo for the product.', 'error');
            return;
        }

        try {
            busy('Saving…');
            await this.upsertProduct({
                productId,
                title: name,
                description: description,
                price: price,
                category: category,
                imageUrl: imagePath,
                needsDetails: Boolean(document.getElementById('product-needs-details')?.checked)
            });

            // Reload from Supabase to keep the list consistent
            await this.loadProducts();

            this.renderProducts();
            // Most stock is added in runs of the same kind, so keep the category.
            try { localStorage.setItem('woofcrafts_last_category', category); } catch (error) { /* private mode */ }
            done();
            this.resetForm();

            const action = wasEditing ? 'updated' : 'added';
            ui.showToast(`Product ${action}`, 'success');

            // Notify other pages that products were updated
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            sessionStorage.setItem('woofcrafts_products_updated', Date.now().toString());
        } catch (error) {
            console.error('Error saving product:', error);
            done();
            ui.showToast('Could not save the product. Check the connection and try again.', 'error');
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
        const needsDetailsEl = document.getElementById('product-needs-details');
        if (needsDetailsEl) needsDetailsEl.checked = Boolean(product.needsDetails);

        const descriptionEl = document.getElementById('product-description');
        if (descriptionEl) descriptionEl.value = product.description || '';
        
        const preview = document.getElementById('image-preview');
        const imgSrc = safeImageSrc(product.image);
        preview.innerHTML = imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="Current image">`
            : '<div class="preview-placeholder">' + iconSvg('image') + '<p>No photo</p></div>';
        
        // Update form button
        document.getElementById('submit-btn').innerHTML = iconSvg('check') + ' Save changes';
        document.getElementById('cancel-edit-btn').classList.remove('hidden');
        
        // Scroll to form
        document.querySelector('.add-product-section').scrollIntoView({ behavior: 'smooth' });
    }

    async deleteProduct(productId) {
        if (!await ui.confirm('This removes the product from the POS. It cannot be undone.', 'Delete product')) return;
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

            ui.showToast('Product deleted', 'success');

            // Notify other pages that products were updated
            window.dispatchEvent(new CustomEvent('productsUpdated'));
            sessionStorage.setItem('woofcrafts_products_updated', Date.now().toString());
        } catch (error) {
            console.error('Error deleting product:', error);
            ui.showToast('Could not delete the product. Check the connection and try again.', 'error');
        }
    }

    resetForm() {
        document.getElementById('product-form').reset();
        const preview = document.getElementById('image-preview');
        preview.innerHTML = `
            <div class="preview-placeholder">
                ${iconSvg('image')}
                <p>The photo preview shows here</p>
            </div>
        `;
        document.getElementById('product-id').value = '';
        this.editingId = null;
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('submit-btn').innerHTML = iconSvg('plus') + ' Add product';
        document.getElementById('cancel-edit-btn').classList.add('hidden');

        const categoryEl = document.getElementById('product-category');
        if (categoryEl) {
            let last = '';
            try { last = localStorage.getItem('woofcrafts_last_category') || ''; } catch (error) { /* private mode */ }
            categoryEl.value = last || 'general';
        }
        const needsDetailsEl = document.getElementById('product-needs-details');
        if (needsDetailsEl) needsDetailsEl.checked = /tag/i.test(last);
    }

    renderProducts() {
        const list = document.getElementById('products-list');
        if (!list) return;

        if (this.loadError) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('alert')}</span>
                    <p>The product list did not load</p>
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

        if (this.products.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">${iconSvg('box')}</span>
                    <p>No products yet</p>
                    <p class="empty-state-note">Add your first product with the form.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.products.map(product => {
            const productName = escapeHtml(product.name || '');
            let imageSrc = safeImageSrc(product.image) || PLACEHOLDER_LIST;
            if (!imageSrc) imageSrc = PLACEHOLDER_LIST;
            // A photo kept inside the product row is downloaded on every POS visit.
            const heavyPhoto = typeof product.image === 'string' && product.image.startsWith('data:');
            const noPhoto = !product.image;

            return `
            <div class="product-list-item">
                <img src="${escapeHtml(imageSrc)}" alt="${productName}" class="product-list-image" loading="lazy" decoding="async"
                     onerror="this.onerror=null; this.src='${PLACEHOLDER_LIST}'">
                <div class="product-list-info">
                    <div class="product-list-name">${productName}</div>
                    <div class="product-list-price">$${parseFloat(product.price).toFixed(2)}</div>
                    ${heavyPhoto ? `<p class="product-list-warning">${iconSvg('alert')} This photo is stored the slow way and holds up the POS. Press Edit and choose the photo again to fix it.</p>` : ''}
                    ${noPhoto ? `<p class="product-list-warning">${iconSvg('alert')} No photo yet. Press Edit and choose one.</p>` : ''}
                </div>
                <div class="product-list-actions">
                    <button class="btn-edit" onclick='productManager.editProduct(${JSON.stringify(product.id)})' title="Edit this product">${iconSvg('edit')} Edit</button>
                    <button class="btn-delete" onclick='productManager.deleteProduct(${JSON.stringify(product.id)})' title="Delete this product">${iconSvg('trash')} Delete</button>
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
    // Staff must be signed in with Supabase Auth
    const session = await window.WoofAuth.requireStaff();
    if (!session) return;
    
    productManager = new ProductManager();
});

