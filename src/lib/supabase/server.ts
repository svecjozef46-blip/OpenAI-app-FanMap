import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for the PUBLIC pages and the vote Route
// Handler (never imported from a "use client" file). Cookie-less on
// purpose: public pages must look the same for everyone, signed in or not.
// The admin area uses the cookie-aware client in
// lib/supabase/auth-server.ts instead.
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
