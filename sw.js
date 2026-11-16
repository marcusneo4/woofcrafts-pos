/*
 * WoofCrafts POS service worker.
 *
 * Goal: after the POS has loaded once with a signal, it must open and take
 * orders with no signal at all. It keeps a copy of the app files, the invoice
 * PDF libraries, the fonts and the product photos.
 *
 * It never caches anything private: not /api/, not the Supabase database, sign-in
 * or private storage (invoices, order photos). Those always go to the network.
 */
const VERSION = 'v1';
const SHELL_CACHE = 'woofcrafts-shell-' + VERSION;
const LIBS_CACHE = 'woofcrafts-libs-' + VERSION;
const IMAGES_CACHE = 'woofcrafts-images-' + VERSION;
const ALL_CACHES = [SHELL_CACHE, LIBS_CACHE, IMAGES_CACHE];

const PRECACHE = [
    '/pos', '/products', '/',
    '/css/style.css',
    '/js/config.public.js', '/js/config.js', '/js/auth.js', '/js/utils.js',
    '/js/xlsx-lite.js', '/js/order-queue.js', '/js/app.js', '/js/products.js'
];
// Libraries and fonts from other sites. Cached on the first online visit.
const PRECACHE_LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
    'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
    'https://esm.sh/@supabase/supabase-js@2',
    'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap'
];

/**
 * Decides how a request is handled. Pure, so it can be tested without a browser.
 * Returns 'skip' | 'network-first' | 'stale-while-revalidate'.
 */
function strategyFor(urlString, method, mode, origin) {
    if (method !== 'GET') return 'skip';
    let url;
    try { url = new URL(urlString); } catch { return 'skip'; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'skip';

    if (url.origin === origin) {
        if (url.pathname.startsWith('/api/')) return 'skip';
        if (url.pathname === '/sw.js') return 'skip';
        // Pages, scripts and styles: always the newest copy when there is signal (after a short wait),
        // the saved copy when there is not. Photos change rarely, so they use the saved copy at once.
        if (mode === 'navigate' || /\.(html|js|css)$/.test(url.pathname) || url.pathname === '/pos' || url.pathname === '/products') return 'network-first';
        return 'stale-while-revalidate';
    }
    // Supabase: only public product photos are cached. Database, auth and private files are not.
    if (/\.supabase\.co$/.test(url.hostname)) {
        return url.pathname.startsWith('/storage/v1/object/public/') ? 'stale-while-revalidate' : 'skip';
    }
    if (['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) {
        return 'stale-while-revalidate';
    }
    return 'skip';
}

function cacheNameFor(urlString, origin) {
    const url = new URL(urlString);
    if (url.origin === origin) return SHELL_CACHE;
    if (/\.supabase\.co$/.test(url.hostname)) return IMAGES_CACHE;
    return LIBS_CACHE;
}

async function putIfGood(cacheName, request, response) {
    // Opaque (status 0) responses come from cross-origin script tags and are fine to keep.
    if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
    }
    return response;
}

async function networkFirst(request, origin, timeoutMs) {
    const name = cacheNameFor(request.url, origin);
    try {
        const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), timeoutMs))
        ]);
        return await putIfGood(name, request, response);
    } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // /pos opened as pos.html or the other way round.
        const alt = await caches.match(new URL('/pos', origin).href);
        if (alt && /pos(\.html)?$/.test(new URL(request.url).pathname)) return alt;
        throw error;
    }
}

async function staleWhileRevalidate(request, origin) {
    const name = cacheNameFor(request.url, origin);
    const cached = await caches.match(request);
    const refresh = fetch(request).then((response) => putIfGood(name, request, response)).catch(() => null);
    if (cached) { refresh.catch(() => {}); return cached; }
    const fresh = await refresh;
    if (fresh) return fresh;
    return Response.error();
}

if (typeof self !== 'undefined' && self.addEventListener) {
    self.addEventListener('install', (event) => {
        event.waitUntil((async () => {
            // Best effort: one missing file must not stop the worker installing.
            const shell = await caches.open(SHELL_CACHE);
            await Promise.all(PRECACHE.map((path) => shell.add(path).catch(() => {})));
            const libs = await caches.open(LIBS_CACHE);
            await Promise.all(PRECACHE_LIBS.map((href) => libs.add(href).catch(() => {})));
            await self.skipWaiting();
        })());
    });

    self.addEventListener('activate', (event) => {
        event.waitUntil((async () => {
            const names = await caches.keys();
            await Promise.all(names.filter((n) => n.startsWith('woofcrafts-') && !ALL_CACHES.includes(n)).map((n) => caches.delete(n)));
            await self.clients.claim();
        })());
    });

    self.addEventListener('fetch', (event) => {
        const request = event.request;
        const origin = self.location.origin;
        const strategy = strategyFor(request.url, request.method, request.mode, origin);
        if (strategy === 'network-first') event.respondWith(networkFirst(request, origin, 3000));
        else if (strategy === 'stale-while-revalidate') event.respondWith(staleWhileRevalidate(request, origin));
    });
}

if (typeof module !== 'undefined') module.exports = { strategyFor, cacheNameFor, PRECACHE, PRECACHE_LIBS };
