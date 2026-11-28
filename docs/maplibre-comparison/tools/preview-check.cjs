// node preview-check.cjs <deployment URL, with ?_vercel_share=… for a protected preview>
// End-to-end check of a deployment: which map engine runs, no request to
// Mapbox, hover tooltip, a vote (answered in the browser, see below),
// switching matches without recreating the map, light/dark switch, and the
// two-finger hint on a phone.
//
// The vote never reaches the server: Turnstile is replaced by a stand-in
// and POST /api/votes is answered here with "OK", so a check of a preview
// (which writes to the real database) can't add a fake vote.
const { chromium } = require("playwright");
const [, , start] = process.argv;
const origin = new URL(start).origin;
const share = new URL(start).searchParams.get("_vercel_share");
const MATCH = "bffd1947-5f1a-4825-89db-ea47f82443ae";
const HOME = "451b3aef-ea3b-4f18-b596-5490a254ef03";
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost" } : undefined;

const FAKE_TURNSTILE = `window.turnstile = {
  render(el, o) { setTimeout(() => o.callback("fake-token"), 50); return "w"; },
  reset() {}, remove() {}, execute() {}, getResponse() { return "fake-token"; }
};`;

async function setUp(context, results) {
  await context.route("https://challenges.cloudflare.com/**", (r) =>
    r.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE })
  );
  await context.route("**/api/votes", (r) =>
    r.request().method() === "POST" ? r.fulfill({ contentType: "application/json", body: '{"ok":true}' }) : r.continue()
  );
  // After the (answered) vote the page reloads results: give it some.
  await context.route("**/rest/v1/match_results*", (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify(results()) })
  );
}

(async () => {
  const browser = await chromium.launch({ proxy });
  const report = {};

  // --- Desktop -------------------------------------------------------------
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  let voted = false;
  await setUp(context, () =>
    voted ? [{ match_id: MATCH, team_id: HOME, country_code: "SK", vote_count: 5 }] : []
  );
  const page = await context.newPage();
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(`${origin}/match/${MATCH}${share ? `?_vercel_share=${share}` : ""}`);
  await page.waitForSelector('[data-map-status="ready"]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  report.engine = await page.evaluate(() => (document.querySelector(".maplibregl-map") ? "maplibre" : "mapbox"));
  const canvas = await page.evaluateHandle(() => document.querySelector("canvas"));

  // Hover over South America (world view, 1440×900, sidebar open): a few
  // points along a line, so a small change of framing doesn't miss land.
  report.hoverTooltip = null;
  for (let x = 640; x <= 760 && !report.hoverTooltip; x += 20) {
    await page.mouse.move(x, 610);
    await page.mouse.move(x + 5, 615);
    await page.waitForTimeout(400);
    report.hoverTooltip = await page.evaluate(() => document.querySelector(".fanmap-popup")?.innerText.split("\n")[0] ?? null);
  }
  await page.mouse.move(700, 20); // onto the header, off the map
  await page.waitForTimeout(400);
  report.tooltipGoneAfterLeavingMap = await page.evaluate(() => !document.querySelector(".fanmap-popup"));

  // Vote for a team (answered locally): the selected match if it's still
  // open, otherwise the first match in the list that is.
  voted = true;
  const selected = page.locator('nav[aria-label="Matches"] li', { hasText: "On the map" }).locator("button:not([disabled])");
  const voteButton = (await selected.count())
    ? selected.first()
    : page.locator('nav[aria-label="Matches"] li button[aria-pressed]:not([disabled])').first();
  await voteButton.click();
  await page.waitForTimeout(2500);
  report.voteShownAsMine = await voteButton.getAttribute("aria-pressed");

  // Switch to another match: the map must stay the same instance.
  await page.locator('nav[aria-label="Matches"]').getByText("View map ›").first().click();
  await page.waitForTimeout(1500);
  report.sameMapAfterMatchSwitch = await page.evaluate((c) => document.querySelector("canvas") === c, canvas);

  // Light mode: same map instance, repainted.
  await page.getByRole("button", { name: /Switch to light mode/ }).click().catch(() => {});
  await page.waitForTimeout(1200);
  report.sameMapAfterThemeSwitch = await page.evaluate((c) => document.querySelector("canvas") === c, canvas);
  await page.screenshot({ path: "preview-check-desktop.png" });

  report.mapboxRequests = requests.filter((u) => /mapbox\.com/.test(new URL(u).host)).length;
  report.mapLoadCounterCalls = requests.filter((u) => u.includes("/api/map-load")).length;
  report.otherHosts = [...new Set(requests.map((u) => new URL(u).host))].filter((h) => h !== new URL(origin).host);
  await context.close();

  // --- Phone: one finger drag shows the two-finger hint, page scrolls ----
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  await setUp(phone, () => []);
  const p2 = await phone.newPage();
  await p2.goto(`${origin}/match/${MATCH}${share ? `?_vercel_share=${share}` : ""}`);
  await p2.waitForSelector('[data-map-status="ready"]', { timeout: 60000 });
  await p2.waitForTimeout(1000);
  const box = await p2.locator("canvas").first().boundingBox();
  const cdp = await phone.newCDPSession(p2);
  const touch = (type, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: box.x + box.width / 2, y }],
    });
  await touch("touchStart", box.y + box.height / 2);
  for (let i = 1; i <= 5; i++) await touch("touchMove", box.y + box.height / 2 - i * 10);
  await p2.waitForTimeout(150);
  report.phoneHint = await p2.evaluate(
    () => document.querySelector(".maplibregl-cooperative-gesture-screen, .mapboxgl-touch-pan-blocker")?.innerText?.trim() ?? null
  );
  await p2.screenshot({ path: "preview-check-phone-hint.png" });
  await touch("touchEnd");
  await phone.close();

  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
