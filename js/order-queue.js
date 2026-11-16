/*
 * Offline order queue.
 *
 * When a sale is taken with no usable connection, the whole order (including
 * any photos) is kept in this phone's IndexedDB and uploaded later. Nothing in
 * here talks to the network; app.js decides when to send.
 *
 * Each record: { queueId, queuedAt, details, photos: [Blob], progress, attempts, lastError }
 *   details  - the order as built at the counter (orderId is null until upload)
 *   progress - what has already reached the server, so a retry never repeats a step:
 *              { orderId, logged, photosSaved, pdfSaved, emailed }
 */
(function () {
    const DB_NAME = 'woofcrafts-pos';
    const STORE = 'order-queue';
    const FALLBACK_KEY = 'woofcrafts_order_queue';

    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB is not available')); return; }
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'queueId' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open the offline store'));
        });
        // A failed open should be retried next time, not remembered.
        dbPromise.catch(() => { dbPromise = null; });
        return dbPromise;
    }

    function run(mode, work) {
        return openDb().then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const store = tx.objectStore(STORE);
            let result;
            const request = work(store);
            if (request) request.onsuccess = () => { result = request.result; };
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error || new Error('Offline store error'));
            tx.onabort = () => reject(tx.error || new Error('Offline store was blocked'));
        }));
    }

    // Used only when IndexedDB is missing (very old browsers, some private modes).
    // Photos cannot be kept this way; the order still can.
    function readFallback() {
        try {
            const list = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
            return Array.isArray(list) ? list : [];
        } catch { return []; }
    }
    function writeFallback(list) {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(list));
    }

    async function usingFallback() {
        try { await openDb(); return false; } catch { return true; }
    }

    const WoofQueue = {
        newRecord(details, photos) {
            const id = details.rowId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'q' + Date.now() + Math.random().toString(16).slice(2));
            return {
                queueId: id,
                queuedAt: new Date().toISOString(),
                details,
                photos: Array.isArray(photos) ? photos : [],
                progress: { orderId: null, logged: false, photosSaved: false, pdfSaved: false, emailed: false },
                attempts: 0,
                lastError: ''
            };
        },

        async add(record) {
            if (await usingFallback()) {
                const list = readFallback().filter((r) => r.queueId !== record.queueId);
                list.push({ ...record, photos: [] });
                writeFallback(list);
                return record;
            }
            await run('readwrite', (store) => store.put(record));
            return record;
        },

        async put(record) { return this.add(record); },

        async all() {
            let list;
            if (await usingFallback()) list = readFallback();
            else list = (await run('readonly', (store) => store.getAll())) || [];
            return list.sort((a, b) => String(a.queuedAt).localeCompare(String(b.queuedAt)));
        },

        async remove(queueId) {
            if (await usingFallback()) {
                writeFallback(readFallback().filter((r) => r.queueId !== queueId));
                return;
            }
            await run('readwrite', (store) => store.delete(queueId));
        },

        async count() {
            return (await this.all()).length;
        }
    };

    window.WoofQueue = WoofQueue;
})();
