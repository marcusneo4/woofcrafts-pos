// WoofCrafts POS - Public runtime config (safe for Vercel + browser)
// Keep only public values here. Do NOT put server secrets in this file.

window.POS_CONFIG = window.POS_CONFIG || {
  loginPassword: 'hyper'
};

window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  // Replace with your real Supabase project values.
  // These are public browser-safe values (anon key + URL).
  supabaseUrl: 'https://fsbehijyxypruzfdhxxo.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmVoaWp5eHlwcnV6ZmRoeHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MzA4NjUsImV4cCI6MjA5MTIwNjg2NX0.SUotgl5buPEbAulWx0Yx4oqVWWMuKUfJOgDZ_fyIXFg',
  supabaseStorageBucket: 'product-images',
  supabaseProductsTable: 'products'
};
