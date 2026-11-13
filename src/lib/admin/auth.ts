import "server-only";
import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

// The single admin gate. Call it at the top of every admin page AND every
// admin Server Action — Server Actions are public HTTP endpoints, so a page
// being protected does not protect the actions it renders (see Next.js
// docs, "Authentication > Server Actions").
//
// Being signed in is not enough: the user must also be listed in
// public.admin_users (checked through the is_admin() DB function). The
// database enforces the same rule via RLS, so even if this check were
// skipped by mistake, writes would still be rejected.
export async function requireAdmin() {
  const supabase = await createAuthServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/admin/login");
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) {
    redirect("/admin/login?error=not_admin");
  }

  return { supabase, user };
}
