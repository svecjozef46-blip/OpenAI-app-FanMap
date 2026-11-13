import { redirect } from "next/navigation";

// Per-request (reads the admin session) — see app/admin/layout.tsx.
export const instant = false;

// Matches are what gets edited day to day, so /admin opens straight there.
export default function AdminHomePage() {
  redirect("/admin/matches");
}
