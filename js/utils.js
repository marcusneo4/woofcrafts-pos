/**
 * WoofCrafts POS - Shared utilities
 */

/** Escape HTML to prevent XSS when inserting user content into innerHTML */
function escapeHtml(text) {
    if (text == null || text === '') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/** Validate image src - reject javascript: and other dangerous protocols */
function safeImageSrc(src) {
    if (!src || typeof src !== 'string') return '';
    const s = src.trim().toLowerCase();
    if (s.startsWith('javascript:') || s.startsWith('vbscript:')) return '';
    if (s.startsWith('data:') && !s.startsWith('data:image/')) return '';
    return src;
}

/** Placeholder SVG for product images (150x150) */
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23FAF7F3\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'16\' font-weight=\'bold\'%3E🐕%3C/text%3E%3C/svg%3E';

/** Placeholder SVG for cart thumbnails (70x70) */
const PLACEHOLDER_THUMB = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'70\' height=\'70\'%3E%3Crect fill=\'%23FAF7F3\' width=\'70\' height=\'70\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'20\'%3E🐕%3C/text%3E%3C/svg%3E';

/** Placeholder SVG for product list (90x90) */
const PLACEHOLDER_LIST = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'90\' height=\'90\'%3E%3Crect fill=\'%23FAF7F3\' width=\'90\' height=\'90\'/%3E%3Ctext fill=\'%23D4A574\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dy=\'.3em\' font-size=\'20\'%3E🐕%3C/text%3E%3C/svg%3E';

/** UI Helper for Modern Toasts and Modals */
window.ui = {
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) {
            alert(message);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span> <span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    confirm: (message, title = 'Confirm Action') => {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-modal');
            if (!modal) {
                resolve(window.confirm(message));
                return;
            }
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-message').textContent = message;
            
            const btnCancel = document.getElementById('modal-cancel');
            const btnConfirm = document.getElementById('modal-confirm');
            
            const cleanup = () => {
                btnCancel.onclick = null;
                btnConfirm.onclick = null;
                modal.close();
            };
            
            btnCancel.onclick = () => { cleanup(); resolve(false); };
            btnConfirm.onclick = () => { cleanup(); resolve(true); };
            
            modal.showModal();
        });
    }
};
