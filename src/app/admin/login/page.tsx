import { AdminForm, Field, inputClass } from "@/components/admin/AdminForm";
import { signIn, signOut } from "./actions";

// Reads ?error= from the URL, so it renders per request. Set on the page
// itself (not only on app/admin/layout.tsx) because redirects into this
// page come from inside /admin, where the layout's setting doesn't apply.
export const instant = false;

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-xl font-bold text-zinc-50">Global Fan Map — Admin</h1>

      {error === "not_admin" && (
        // Signed in, but not in public.admin_users. Offer a way out so the
        // admin can switch to the right account.
        <div className="flex flex-col gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <p>This account is signed in but doesn&apos;t have admin access.</p>
          <form action={signOut}>
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
      )}

      <AdminForm action={signIn} submitLabel="Sign in">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
      </AdminForm>
    </main>
  );
}
