import { createClient } from "@supabase/supabase-js";

// Prefer env vars. If they're not set (common in previews), fallback to the default VetVAX Supabase project.
const fallbackUrl = "https://nocwkogecmwwpodoqaos.supabase.co";
const fallbackAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vY3drb2dlY213d3BvZG9xYW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0MTY1NTAsImV4cCI6MjA4Nzk5MjU1MH0.KBD8LUEdiEQuhhyZXuhVvK8xzVAOn-ByLnF-CfBCteQ";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabaseUrl = envUrl && envUrl.trim() ? envUrl : fallbackUrl;
const supabaseAnonKey = envKey && envKey.trim() ? envKey : fallbackAnonKey;

if (!envUrl || !envKey || !envUrl.trim() || !envKey.trim()) {
  // eslint-disable-next-line no-console
  console.warn(
    "[VetVAX] Supabase env vars ausentes (ou vazias). Usando fallback. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para apontar para seu projeto.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});