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

    async function getSession() {
        const client = await getClient();
        if (!client) return null;
        const { data } = await client.auth.getSession();
        return data && data.session ? data.session : null;
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
            window.location.replace('index.html');
            return null;
        }
        if (!isStaff(session)) {
            const client = await getClient();
            if (client) await client.auth.signOut();
            window.location.replace('index.html?denied=1');
            return null;
        }
        return session;
    }

    async function getAccessToken() {
        const session = await getSession();
        return session ? session.access_token : null;
    }

    async function signOut() {
        const client = await getClient();
        if (client) await client.auth.signOut();
        window.location.replace('index.html');
    }

    window.WoofAuth = { getClient, getSession, isStaff, requireStaff, getAccessToken, signOut };
})();
