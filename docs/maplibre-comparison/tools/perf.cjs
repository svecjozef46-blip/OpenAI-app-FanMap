// node perf.cjs <label> <baseOrShareUrl> [runs]
// Cold load (fresh context = empty cache) of one match page. Counts every
// request incl. web workers (Playwright context events), bytes as
// transferred (compressed body + headers). Time = navigation start until
// "Loading the map…" is gone (the map has drawn the world).
const { chromium } = require("playwright");
const [, , label, base, runsArg] = process.argv;
const runs = Number(runsArg ?? 5);
const MATCH = "bffd1947-5f1a-4825-89db-ea47f82443ae";
function category(url, type) {
  if (/\/fonts\/v1\/|\/fonts\/.*\.pbf/.test(url)) return "map font (glyphs)";
  if (/mapbox\.com|\/data\/.*geojson/.test(url)) return "map data (style, tiles, shapes)";
  if (type === "script") return "JavaScript";
  return "other (page, CSS, web fonts, API)";
}
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: "localhost" } });
  const all = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
    const p2 = await context.newPage();
    const origin = new URL(base).origin;
    const share = new URL(base).searchParams.get("_vercel_share");
    const target = `${origin}/match/${MATCH}` + (share ? `?_vercel_share=${share}` : "");
    const bytes = {}; const pending = [];
    let counting = false;
    context.on("requestfinished", (r) => {
      if (!counting) return;
      pending.push(r.sizes().then((s) => {
        const c = category(r.url(), r.resourceType());
        bytes[c] = (bytes[c] ?? 0) + s.responseBodySize + s.responseHeadersSize;
      }).catch(() => {}));
    });
    counting = true;
    const t0 = Date.now();
    await p2.goto(target, { waitUntil: "domcontentloaded" });
    await p2.waitForFunction(() => document.querySelector("canvas") && !document.body.innerText.includes("Loading the map"), null, { timeout: 90000, polling: 50 });
    const ms = Date.now() - t0;
    await p2.waitForTimeout(5000);
    await Promise.all(pending);
    all.push({ ms, bytes });
    await context.close();
  }
  await browser.close();
  const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const cats = [...new Set(all.flatMap((r) => Object.keys(r.bytes)))].sort();
  const kb = {}; for (const c of cats) kb[c] = Math.round(med(all.map((r) => r.bytes[c] ?? 0)) / 1024);
  console.log(JSON.stringify({ label, mapReadyMs: all.map((r) => r.ms), median: med(all.map((r) => r.ms)), kb, totalKb: Object.values(kb).reduce((a, b) => a + b, 0) }));
})();
