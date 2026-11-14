// Server-side check of a Cloudflare Turnstile token ("are you a human?").
// The browser gets the token from the Turnstile widget (lib/turnstile.ts)
// and sends it with the vote; only Cloudflare can say whether it is real,
// so we ask it here before a vote is recorded. Each token works once.
//
// TURNSTILE_SECRET_KEY is server-only (no NEXT_PUBLIC_ prefix).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = "ok" | "rejected" | "unavailable";

export async function verifyTurnstileToken(
  secretKey: string,
  token: string,
  ip: string | null
): Promise<TurnstileResult> {
  const form = new URLSearchParams({ secret: secretKey, response: token });
  if (ip) form.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body: form,
      // Don't let a slow Cloudflare hang the vote button forever.
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return "unavailable";
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success === true) return "ok";
    // A wrong secret key is our configuration mistake, not the voter's.
    if (result["error-codes"]?.some((code) => code.includes("input-secret"))) {
      console.error("Turnstile rejected TURNSTILE_SECRET_KEY — check the key. See README.");
      return "unavailable";
    }
    return "rejected";
  } catch {
    return "unavailable";
  }
}
