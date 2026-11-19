// Cloudflare Turnstile in the browser: provides a one-time "this is a
// human" token for each vote. The server checks the token with Cloudflare
// (lib/turnstileServer.ts) and refuses votes without a valid one.
//
// Getting a token takes Cloudflare a few seconds, so we don't wait for the
// click: one hidden widget is started as soon as a page with vote buttons
// opens and keeps a fresh token ready. A vote takes the ready token and the
// widget immediately starts fetching the next one. That keeps voting fast.
//
// Friction stays low: the widget is "interaction-only", so most fans never
// see it — it appears (bottom of the screen) only when Cloudflare wants a
// click. Used only by lib/useVote.ts. The check is started from
// components/TurnstilePreload.tsx on every public page, so the token is
// usually ready (or close) by the time someone taps a team.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// How long a vote waits for a token that isn't ready yet — long enough for
// someone to notice and click a challenge.
const WAIT_MS = 45_000;

// Why no token could be had, so the UI can say the right thing:
//  - "blocked": the Cloudflare script could not load (ad blocker, offline)
//  - "timeout": the script loaded but no token arrived within WAIT_MS
export class TurnstileError extends Error {
  constructor(
    public readonly kind: "blocked" | "timeout",
    message: string
  ) {
    super(message);
    this.name = "TurnstileError";
  }
}

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Waiter = { resolve: (token: string) => void; reject: (error: Error) => void };

let scriptPromise: Promise<TurnstileApi> | null = null;
let widgetPromise: Promise<{ api: TurnstileApi; id: string }> | null = null;
// The token waiting to be used (each works once and expires after ~5 min).
let readyToken: string | null = null;
// Votes waiting for a token that hasn't arrived yet.
let waiters: Waiter[] = [];
// Set when the widget reported an error; cleared by the next token. Used to
// restart a stuck widget when the person taps "try again".
let widgetErrored = false;

function loadScript(): Promise<TurnstileApi> {
  if (!scriptPromise) {
    scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () =>
        window.turnstile ? resolve(window.turnstile) : reject(new TurnstileError("blocked", "turnstile missing"));
      script.onerror = () => reject(new TurnstileError("blocked", "turnstile blocked"));
      document.head.appendChild(script);
    });
    // A failed load (offline, blocker) must not be remembered forever.
    scriptPromise.catch(() => {
      scriptPromise = null;
    });
  }
  return scriptPromise;
}

// Creates the one widget for this page (once) and starts the first check.
function ensureWidget(): Promise<{ api: TurnstileApi; id: string }> {
  if (!widgetPromise) {
    widgetPromise = loadScript().then((api) => {
      const container = document.createElement("div");
      // Above everything, bottom centre — visible only if a challenge appears.
      container.style.cssText =
        "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;";
      document.body.appendChild(container);

      const id = api.render(container, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
        callback: (token: string) => {
          widgetErrored = false;
          const waiter = waiters.shift();
          if (waiter) {
            // A vote was already waiting: hand the token over and fetch the
            // next one (reset() must not run inside this callback).
            waiter.resolve(token);
            setTimeout(() => api.reset(id), 0);
          } else {
            readyToken = token;
          }
        },
        // Turnstile fetches a new token by itself after expiry.
        "expired-callback": () => {
          readyToken = null;
        },
        // Turnstile retries on its own after an error, so waiting votes are
        // NOT failed here — that is what used to show the red "couldn't
        // confirm" message while a retry was seconds from succeeding. They
        // keep waiting until a token arrives or WAIT_MS runs out.
        "error-callback": () => {
          readyToken = null;
          widgetErrored = true;
          // true = "handled".
          return true;
        },
      });
      return { api, id };
    });
    widgetPromise.catch(() => {
      widgetPromise = null;
    });
  }
  return widgetPromise;
}

// Starts the human check ahead of the first vote so the vote itself is fast.
export function preloadTurnstile(): void {
  if (SITE_KEY) ensureWidget().catch(() => {});
}

// True when a vote could go out right now without waiting (no check
// configured, or a token is ready). The UI uses it to decide between a
// "Saving…" and a "Verifying you're a real fan…" state.
export function isTurnstileReady(): boolean {
  return !SITE_KEY || readyToken !== null;
}

// Resolves with a fresh token, or null when Turnstile isn't configured
// (local development without keys). Rejects with a TurnstileError when the
// check can't be completed — the caller shows a readable message.
export async function getTurnstileToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  const { api, id } = await ensureWidget();

  // "Try again" after an error: restart a widget that gave up, instead of
  // waiting on something that will never arrive.
  if (widgetErrored && !readyToken) {
    widgetErrored = false;
    api.reset(id);
  }

  if (readyToken) {
    const token = readyToken;
    readyToken = null;
    // Start fetching the token for the next vote right away.
    api.reset(id);
    return token;
  }

  return new Promise<string>((resolve, reject) => {
    const waiter: Waiter = {
      resolve: (token) => {
        clearTimeout(timer);
        resolve(token);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    };
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== waiter);
      reject(new TurnstileError("timeout", "turnstile timeout"));
    }, WAIT_MS);
    waiters.push(waiter);
  });
}
