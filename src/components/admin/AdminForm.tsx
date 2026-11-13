"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin/form";

// Thin wrapper around a Server Action form: shows the action's error
// message (if any) and disables the submit button while saving. On
// success the action itself redirects, so there's no success state here.
// Inputs are uncontrolled (defaultValue), so a validation error doesn't
// wipe what the admin typed.
export function AdminForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {children}
      {state.error && (
        <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// Shared field styling, so every admin form looks the same.
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none";
