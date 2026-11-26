import { createHash } from "crypto";
import type { NextRequest } from "next/server";

// Server-only helpers shared by the API routes (votes, map-load).

export function getClientIp(request: NextRequest): string {
  // Vercel (and most proxies) set x-forwarded-for; it can be a comma list
  // if there are multiple hops, so the client's address is the first one.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  // Local `next dev` has no proxy in front of it, so there's no header.
  // Falling back to a constant is fine there since every local vote would
  // collide anyway (same machine) — this path never runs in production.
  return "local-dev";
}

// The address is stored for rate limiting only as a fingerprint mixed with
// the server secret, so the table never holds a raw IP address and the
// fingerprint can't be reversed by trying all addresses. `scope` keeps
// separate limits apart (votes and map loads must not share one budget).
export function computeIpHash(ip: string, serverSecret: string, scope = ""): string {
  return createHash("sha256").update(`${scope}${serverSecret}:${ip}`).digest("hex");
}
