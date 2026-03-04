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
