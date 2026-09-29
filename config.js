// Fine Print CA — runtime config
// Leave SUPABASE_URL empty to run entirely off data/measures.json (no backend needed).
// Once your Supabase project exists, paste the project URL and the *anon* key here
// (the anon key is safe to ship in a public site; RLS in schema.sql limits what it can do).
window.FP_CONFIG = {
  SUPABASE_URL: "https://rtfnkebuiyibnzvsyuua.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0Zm5rZWJ1aXlpYm56dnN5dXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTUwNzIsImV4cCI6MjEwNjIzMTA3Mn0.0b7HGri1JI9gkmWS4SyiS6pf_z-mrdGox_dGxFjynYY",
  SITE_NAME: "Fine Print CA",
  // Fallback for the "I saw an ad" form when Supabase is not configured:
  REPORT_EMAIL: "greenofrls@gmail.com",
};
