import { createClient } from "@supabase/supabase-js";
// Values come from a .env file:
//   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
//   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
if (!supabaseUrl || !supabaseAnonKey) {
  // Helpful nudge during local dev instead of a cryptic fetch error.
  console.warn(
    "[MediCore] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your .env"
  );
}
export const supabase = createClient(
  supabaseUrl ?? "http://localhost:54321",
  supabaseAnonKey ?? "placeholder-anon-key",
  {
    // Default to the medicore schema so we don't have to call .schema() everywhere.
    db: { schema: "medicore" },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
