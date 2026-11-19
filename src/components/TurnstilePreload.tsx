"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { preloadTurnstile } from "@/lib/turnstile";

// Starts the (invisible) human check as early as possible on every public
// page — including the home page, which has no vote buttons — because the
// token takes ~20 seconds to become ready. By the time someone has picked a
// match and tapped a team, it is usually waiting. Renders nothing; the
// widget only becomes visible if Cloudflare asks for a click (see
// lib/turnstile.ts). Skipped in /admin, where nobody votes.
export function TurnstilePreload() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  useEffect(() => {
    if (!isAdmin) preloadTurnstile();
  }, [isAdmin]);
  return null;
}
