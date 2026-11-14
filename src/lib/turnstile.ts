// Cloudflare Turnstile in the browser: gets a one-time "this is a human"
// token right before a vote is sent. The server checks the token with
// Cloudflare (lib/turnstileServer.ts) and refuses votes without a valid one.
//
// Friction stays low: the widget is "interaction-only", so most fans never
// see it — it appears (bottom of the screen) only when Cloudflare wants a
// click. Used only by lib/useVote.ts.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// Long enough for someone to notice and click a challenge.
const TIMEOUT_MS = 60_000;

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
      script.onerror = () => reject(new Error("turnstile blocked"));
      document.head.appendChild(script);
    });
    // A failed load (offline, blocker) must not be remembered forever.
    scriptPromise.catch(() => {
      scriptPromise = null;
    });
  }
  return scriptPromise;
}

// Fetches the script ahead of the first vote so the vote itself feels instant.
export function preloadTurnstile(): void {
  if (SITE_KEY) loadTurnstile().catch(() => {});
}

// Resolves with a fresh token, or null when Turnstile isn't configured
// (local development without keys). Rejects when the check can't be
// completed — the caller shows a readable message.
export async function getTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  const turnstile = await loadTurnstile();

  const container = document.createElement("div");
  // Above everything, bottom centre — visible only if a challenge appears.
  container.style.cssText =
    "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;";
  document.body.appendChild(container);

  return new Promise<string>((resolve, reject) => {
    // Filled in once the widget exists; the callbacks below read it later.
    const widget: { id?: string } = {};
    const finish = (action: () => void) => {
      clearTimeout(timer);
      try {
        if (widget.id) turnstile.remove(widget.id);
      } catch {
        // Already gone — nothing to clean up.
      }
      container.remove();
      action();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("turnstile timeout"))), TIMEOUT_MS);

    widget.id = turnstile.render(container, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
      callback: (token: string) => finish(() => resolve(token)),
      "error-callback": (code: unknown) => {
        finish(() => reject(new Error(`turnstile error ${String(code)}`)));
        // true = "handled", so Turnstile doesn't also log to the console.
        return true;
      },
    });
  });
}
