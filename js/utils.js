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

/** Inline icon from the sprite at the top of each page */
function iconSvg(name) {
    return '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}

/** Placeholder image: a grey tag on a quiet background. Contains no quote characters,
 *  so it is safe inside an onerror="..." attribute. */
function placeholderSvg(size) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24">'
        + '<rect width="24" height="24" fill="#EBDFCD"/>'
        + '<g fill="none" stroke="#8B7355" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" transform="translate(6 6) scale(.5)">'
        + '<rect x="6" y="2.5" width="12" height="19" rx="6"/><circle cx="12" cy="8" r="1.5"/></g></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const PLACEHOLDER_IMAGE = placeholderSvg(150);
const PLACEHOLDER_THUMB = placeholderSvg(70);
const PLACEHOLDER_LIST = placeholderSvg(90);

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
        toast.innerHTML = iconSvg(type === 'success' ? 'check' : 'alert') + `<span>${escapeHtml(message)}</span>`;
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
