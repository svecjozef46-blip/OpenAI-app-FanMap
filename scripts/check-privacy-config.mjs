#!/usr/bin/env node
// Runs before every `npm run build`. Warns (never fails the build) when a
// production build on Vercel is missing the operator details the privacy
// page (/privacy, /privacy/sk) shows: without them the page only says the
// contact details "will be published here before launch". See
// docs/privacy.md.

const REQUIRED = ["NEXT_PUBLIC_OPERATOR_NAME", "NEXT_PUBLIC_OPERATOR_ADDRESS", "NEXT_PUBLIC_CONTACT_EMAIL"];
const missing = REQUIRED.filter((name) => !process.env[name]?.trim());

if (process.env.VERCEL_ENV === "production" && missing.length > 0) {
  const line = "!".repeat(72);
  console.warn(
    [
      "",
      line,
      "  PRIVACY PAGE: operator contact details are missing on a PRODUCTION build.",
      `  Not set: ${missing.join(", ")}`,
      "  /privacy and /privacy/sk will say the details will be published before launch.",
      "  Set them in Vercel (Settings -> Environment Variables -> Production) and redeploy.",
      "  See docs/privacy.md.",
      line,
      "",
    ].join("\n")
  );
}
