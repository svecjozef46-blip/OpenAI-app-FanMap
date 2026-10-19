import { createClient } from "@supabase/supabase-js";

// Single browser-side Supabase client, using only the public anon key.
// This project never ships a service-role key to the app at all — voting
// goes through the public.submit_vote() Postgres function (SECURITY
// DEFINER, granted to anon/authenticated) instead of a privileged backend
// client. See docs/decisions-log.md 2026-10-19 and
// src/app/api/votes/route.ts for the reasoning.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill in real values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
