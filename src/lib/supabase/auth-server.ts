import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cookie-aware Supabase client for the admin area only (Server Components,
// Server Actions). Uses the same public anon key as everything else — the
// signed-in user's session (stored in cookies by @supabase/ssr) is what
// makes RLS treat the request as `authenticated`, and the admin policies
// then check public.is_admin() (see docs/schema.sql "ADMIN").
//
// Deliberately separate from lib/supabase/server.ts: public pages keep
// using that cookie-less client, so the public match pages never depend on
// who is signed in and stay identical for every visitor.
export async function createAuthServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.example to .env.local and fill in real values."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Server Components can't set cookies (only Server Actions and
        // Route Handlers can). That's fine: src/proxy.ts refreshes the
        // session cookie on every /admin request before rendering, so a
        // failed write here is safe to ignore.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — see comment above.
        }
      },
    },
  });
}
