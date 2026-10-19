import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for use inside Route Handlers and Server
// Components only (never imported from a "use client" file). Kept as a
// separate module from lib/supabase/client.ts — even though both currently
// use the same public anon key — because this is where admin
// authentication (Phase 7, see docs/dev-prompt-chatgpt.md) will eventually
// plug in via request cookies. Keeping that seam now avoids a bigger
// refactor later.
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in real values."
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
