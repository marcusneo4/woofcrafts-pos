// WoofCrafts POS - shared Supabase client and staff sign-in helpers.
// Loaded after config.public.js on every page. One client is shared so the
// signed-in session is used by products, purchases and uploads alike.
(function () {
    const config = window.SUPABASE_CONFIG || {};
    let clientPromise = null;

    function getClient() {
        if (clientPromise) return clientPromise;

        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            clientPromise = Promise.resolve(null);
            return clientPromise;
        }

        clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
            .then(({ createClient }) => createClient(config.supabaseUrl, config.supabaseAnonKey))
            .catch((error) => {
                console.warn('Failed to create Supabase client:', error);
                return null;
            });

        return clientPromise;
    }

    const STAFF_SEEN_KEY = 'woofcrafts_staff_seen';
    let lastSessionNetworkError = false;

    async function getSession() {
        lastSessionNetworkError = false;
        const client = await getClient();
        if (!client) { lastSessionNetworkError = true; return null; }
        const { data, error } = await client.auth.getSession();
        if (!(data && data.session) && error && /fetch|network|load failed|timeout/i.test(String(error.message || error))) {
            // The saved sign-in could not be refreshed because there is no signal. That is not a sign-out.
            lastSessionNetworkError = true;
        }
        return data && data.session ? data.session : null;
    }

    function seenStaffBefore() {
        try { return localStorage.getItem(STAFF_SEEN_KEY) === '1'; } catch { return false; }
    }

    // True only for accounts marked as POS staff in app_metadata, which users
    // cannot edit themselves. An account that merely signed up is not staff.
    function isStaff(session) {
        const meta = session && session.user && session.user.app_metadata;
        return Boolean(meta && meta.role === 'pos_staff');
    }

    // Sends anyone who is not signed-in staff back to the login page.
    async function requireStaff() {
        const session = await getSession();
        if (!session) {
            // Weak or no signal at the stall: keep the POS open so orders can still be taken
            // and queued. The server still checks the real sign-in before anything is saved.
            const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || lastSessionNetworkError;
            if (offline && seenStaffBefore()) return { offline: true };
            window.location.replace('index.html');
            return null;
        }
        if (!isStaff(session)) {
            try { localStorage.removeItem(STAFF_SEEN_KEY); } catch { /* ignore */ }
            const client = await getClient();
            if (client) await client.auth.signOut();
            window.location.replace('index.html?denied=1');
            return null;
        }
        try { localStorage.setItem(STAFF_SEEN_KEY, '1'); } catch { /* ignore */ }
        return session;
    }

    async function getAccessToken() {
        const session = await getSession();
        return session ? session.access_token : null;
    }

    async function signOut() {
        try { localStorage.removeItem(STAFF_SEEN_KEY); } catch { /* ignore */ }
        const client = await getClient();
        if (client) await client.auth.signOut();
        window.location.replace('index.html');
    }

    window.WoofAuth = { getClient, getSession, isStaff, requireStaff, getAccessToken, signOut };
})();
