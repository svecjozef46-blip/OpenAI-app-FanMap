import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next.js 16 "Proxy" (formerly Middleware). Runs only for /admin routes
// (see `config.matcher`) and does one job: refresh the Supabase Auth
// session cookie before the page renders, because Server Components
// can't write cookies themselves (see lib/supabase/auth-server.ts). This is
// the standard @supabase/ssr setup for Next.js.
//
// It is NOT the security check. Who may see/change admin data is decided
// by requireAdmin() (lib/admin/auth.ts) in every admin page and Server
// Action, and ultimately by the database's RLS policies.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) validates the token with Supabase and
  // triggers the refresh + setAll() above when it's close to expiring.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
