"use server";

import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { getString, type ActionState } from "@/lib/admin/form";

// Email + password sign-in through Supabase Auth. There is intentionally no
// sign-up form: admin accounts are created by hand in the Supabase
// dashboard and then added to public.admin_users (see README "Admin").
export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Same message for "no such user" and "wrong password", on purpose.
    return { error: "Wrong email or password." };
  }

  redirect("/admin");
}

export async function signOut() {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
