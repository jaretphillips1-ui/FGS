import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PUBLISHABLE ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or publishable key)");

declare global {
  // eslint-disable-next-line no-var
  var __fgs_supabase__: SupabaseClient | undefined;
}

export const supabase: SupabaseClient =
  globalThis.__fgs_supabase__ ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,

      // HARD RULE:
      // Use implicit so magic links carry tokens in the URL hash.
      // This avoids PKCE "code verifier not found in storage" when the link is opened
      // in a different browser / device / profile.
      flowType: "implicit",
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__fgs_supabase__ = supabase;
}
