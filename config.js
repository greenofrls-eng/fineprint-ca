// Fine Print CA — runtime config
// Leave SUPABASE_URL empty to run entirely off data/measures.json (no backend needed).
// Once your Supabase project exists, paste the project URL and the *anon* key here
// (the anon key is safe to ship in a public site; RLS in schema.sql limits what it can do).
window.FP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SITE_NAME: "Fine Print CA",
  // Fallback for the "I saw an ad" form when Supabase is not configured:
  REPORT_EMAIL: "greenofrls@gmail.com",
};
