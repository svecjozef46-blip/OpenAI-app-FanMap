// node shots.cjs <engineLabel> <baseUrl (with ?_vercel_share=… if protected)> <outDir> [demo]
// Screenshots of the match page for each view below, desktop and phone, dark
// and light. "demo" replaces the results with the DEMO list (in the browser
// only). VIEWS=europe,malta and KEYS=desktop-dark limit what is taken.
// Zooming = double-clicks on the same spot, so both engines get the same
// views.
const { chromium } = require("playwright");
const fs = require("fs");
const [, , label, start, outDir, mode] = process.argv;
const base = new URL(start).origin;
const share = new URL(start).searchParams.get("_vercel_share");
const MATCH = "bffd1947-5f1a-4825-89db-ea47f82443ae";
const HOME = "451b3aef-ea3b-4f18-b596-5490a254ef03";
const AWAY = "68ac1ae1-97e2-480d-b325-092b91dc1e1c";
fs.mkdirSync(outDir, { recursive: true });

// Demo results (clearly synthetic) so both engines paint many countries,
// including tiny ones. [code, home, away]
const DEMO = [
  ["DE", 90, 40], ["AT", 20, 30], ["CH", 12, 9], ["SK", 7, 2], ["CZ", 4, 9], ["PL", 30, 25], ["HU", 5, 5],
  ["FR", 18, 33], ["ES", 40, 12], ["PT", 3, 8], ["IT", 22, 21], ["GB", 50, 70], ["IE", 6, 2], ["NL", 15, 15],
  ["BE", 9, 4], ["LU", 6, 1], ["MT", 1, 5], ["SG", 8, 2], ["XK", 4, 1], ["AL", 1, 3], ["RS", 2, 6], ["HR", 5, 2],
  ["SI", 2, 1], ["MC", 3, 0], ["LI", 0, 3], ["SM", 2, 2], ["AD", 4, 0], ["CY", 3, 1], ["US", 60, 45],
  ["CA", 10, 8], ["MX", 5, 9], ["BR", 30, 10], ["AR", 7, 7], ["NG", 12, 20], ["ZA", 9, 4], ["EG", 2, 6],
  ["IN", 25, 26], ["CN", 8, 3], ["JP", 11, 6], ["KR", 4, 9], ["AU", 14, 9], ["NZ", 2, 1], ["ID", 8, 12],
  ["RU", 3, 2], ["UA", 6, 4], ["TR", 13, 5], ["NO", 9, 3], ["SE", 4, 7], ["FI", 1, 1], ["DK", 6, 3],
  ["IS", 1, 0], ["GR", 3, 4], ["RE", 3, 0], ["GF", 0, 4],
];

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;

// Screen position of [lng, lat] right after fitWorld() (same maths as
// src/lib/mapSetup.ts: Web Mercator, extremes fitted into the padded box).
function projector(box, padding) {
  const X = (lng) => (lng + 180) / 360;
  const Y = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
  const ext = [[-168, 60], [190, 60], [0, 75], [-68, -55.6]];
  const xs = ext.map(([a]) => X(a)), ys = ext.map(([, b]) => Y(b));
  const w = box.width - padding.left - padding.right, h = box.height - padding.top - padding.bottom;
  // x1.023: measured against label positions on screen (the library's
  // own fitting lands slightly larger than this estimate).
  const s = 1.023 * Math.min(w / (Math.max(...xs) - Math.min(...xs)), h / (Math.max(...ys) - Math.min(...ys)));
  let cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  // renderWorldCopies: false keeps the view inside one world horizontally;
  // a world narrower than the viewport is centred.
  const half = box.width / 2 / s;
  cx = half >= 0.5 ? 0.5 : Math.min(Math.max(cx, half), 1 - half);
  return ([lng, lat]) => ({
    x: box.x + box.width / 2 + (X(lng) - cx) * s,
    y: box.y + padding.top + h / 2 + (Y(lat) - cy) * s,
  });
}

const VIEWS = [
  { name: "world", clicks: 0 },
  { name: "europe", at: [12, 50], clicks: 2 },
  { name: "asia", at: [95, 30], clicks: 1 },
  { name: "south-america", at: [-60, -20], clicks: 1 },
  { name: "slovakia", at: [19.5, 48.7], clicks: 4 },
  { name: "luxembourg", at: [6.1, 49.7], clicks: 5 },
  { name: "malta", at: [14.4, 35.95], clicks: 5 },
  { name: "kosovo", at: [20.9, 42.6], clicks: 5 },
  { name: "singapore", at: [103.82, 1.36], clicks: 5 },
];

const onlyViews = process.env.VIEWS ? process.env.VIEWS.split(",") : null;
const onlyKeys = process.env.KEYS ? process.env.KEYS.split(",") : null;
(async () => {
  const browser = await chromium.launch({ proxy });
  const timings = {};
  for (const device of ["desktop", "phone"]) {
    for (const scheme of ["dark", "light"]) {
      if (onlyKeys && !onlyKeys.includes(`${device}-${scheme}`)) continue;
      const context = await browser.newContext({
        viewport: device === "desktop" ? { width: 1440, height: 900 } : { width: 390, height: 844 },
        deviceScaleFactor: 1,
        colorScheme: scheme,
      });
      const page = await context.newPage();
      const bytes = { total: 0, byHost: {} };
      const mapboxRequests = [];
      page.on("response", async (r) => {
        try {
          const len = Number((await r.allHeaders())["content-length"] ?? 0) || (await r.body()).length;
          const host = new URL(r.url()).host;
          bytes.total += len;
          bytes.byHost[host] = (bytes.byHost[host] ?? 0) + len;
        } catch {}
      });
      page.on("request", (r) => {
        if (/mapbox\.com/.test(r.url())) mapboxRequests.push(r.url().split("?")[0]);
      });
      if (mode === "demo") {
        await page.route("**/rest/v1/match_results*", (route) =>
          route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
              DEMO.flatMap(([c, h, a]) => [
                { match_id: MATCH, team_id: HOME, country_code: c, vote_count: h },
                { match_id: MATCH, team_id: AWAY, country_code: c, vote_count: a },
              ])
            ),
          })
        );
      }
      if (share) await page.goto(`${base}/?_vercel_share=${share}`, { waitUntil: "domcontentloaded" });
      const t0 = Date.now();
      await page.goto(`${base}/match/${MATCH}`, { waitUntil: "domcontentloaded" });
      const canvas = page.locator("canvas").first();
      await canvas.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => !document.body.innerText.includes("Loading the map"), null, { timeout: 60000 });
      const tReady = Date.now() - t0;
      await page.waitForTimeout(2500);
      const box = await canvas.boundingBox();
      const wide = device === "desktop";
      const padding = wide ? { top: 84, bottom: 16, left: 16, right: 16 } : { top: 8, bottom: 8, left: 8, right: 8 };
      const project = projector(box, padding);
      const key = `${device}-${scheme}`;
      timings[key] = { mapReadyMs: tReady };

      for (const view of VIEWS.filter((v) => !onlyViews || onlyViews.includes(v.name))) {
        if (view.clicks) {
          await page.goto(`${base}/match/${MATCH}`, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => !document.body.innerText.includes("Loading the map"), null, { timeout: 60000 });
          await page.waitForTimeout(1500);
          const p = project(view.at);
          for (let i = 0; i < view.clicks; i++) {
            await page.mouse.dblclick(p.x, p.y);
            await page.waitForTimeout(700);
          }
          await page.waitForTimeout(1500);
          if (view.name === "slovakia" && wide) {
            await page.mouse.move(p.x, p.y);
            await page.waitForTimeout(600);
          }
        }
        await page.screenshot({ path: `${outDir}/${label}-${key}-${view.name}.png` });
      }
      timings[key].bytes = bytes;
      timings[key].mapboxRequests = [...new Set(mapboxRequests)].length;
      await context.close();
    }
  }
  fs.writeFileSync(`${outDir}/${label}-timings.json`, JSON.stringify(timings, null, 1));
  console.log(JSON.stringify(timings, null, 1));
  await browser.close();
})();
