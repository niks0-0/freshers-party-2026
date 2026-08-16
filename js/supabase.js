/* ========================================================
   FRESHERS PARTY 2026 — SUPABASE CLIENT INITIALIZER
   ======================================================== */

let supabaseClient = null;

function initSupabase() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.SUPABASE_CONFIG;

  if (typeof supabase === 'undefined') {
    console.error("Supabase SDK is not loaded. Make sure the CDN script is included.");
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return supabaseClient;
}

// Global accessor
window.getSupabase = function() {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});
