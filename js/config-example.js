// WoofCrafts POS - Configuration Example
// Copy this file to config.js and update the values. config.js is gitignored.
// NEVER commit config.js with real credentials.

window.POS_CONFIG = {
    // Login password for POS access (change before production!)
    loginPassword: 'hyper'
};

window.SUPABASE_CONFIG = {
    // Supabase project URL (from your Supabase dashboard)
    supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',

    // Supabase anon key (safe to expose in the browser)
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',

    // Supabase Storage bucket that stores product images
    supabaseStorageBucket: 'product-images',

    // Supabase table that stores product rows
    supabaseProductsTable: 'products'
};
