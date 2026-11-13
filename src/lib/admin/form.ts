// Small helpers shared by the admin Server Actions. Kept deliberately
// plain (no validation library) — the forms are few and simple, and the
// database constraints (docs/schema.sql) are the final safety net anyway.

export type ActionState = { error: string | null };

export function getString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Unchecked checkboxes aren't sent at all, so "present" means true.
export function getBoolean(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Premier League" -> "premier-league". Used when the admin leaves the
// league slug empty.
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Turns a Postgres/PostgREST error into a message an admin can act on.
export function describeDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Something with this value already exists (e.g. the slug).";
  if (error.code === "23514") return "A value isn't allowed (e.g. home and away team are the same).";
  if (error.code === "42501") return "Your account isn't allowed to do this (not an admin).";
  return `Database error: ${error.message}`;
}

// Kickoff times are entered and shown in UTC on purpose: a datetime-local
// input has no time zone, and the server (Vercel) runs in UTC, so
// converting to "local" time would silently shift matches by 1–2 hours
// depending on where the code happens to run. The form labels this.
export function isoToUtcInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
}

export function utcInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
