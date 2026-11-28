// node load-faults.cjs <app URL> : cold loads of the home and a match page with one map request failed once or delayed 5 s; reports whether and when the map is drawn
const { chromium } = require("playwright");
const base = process.argv[2];
const cases = [
  ["normal", null, null],
  ["countries data fails once", /\/data\/countries\./, "abort"],
  ["labels fail once (match)", /\/data\/country-labels\./, "abort"],
  ["MapLibre chunk fails once", "maplibre", "abort"],
  ["countries data 5 s slow", /\/data\/countries\./, "delay"],
];
(async () => {
  const b = await chromium.launch();
  // Which JS chunk holds MapLibre: the biggest script requested after load.
  for (const page of ["/", "/match/bffd1947-5f1a-4825-89db-ea47f82443ae"]) {
    let mlChunk = null;
    { const c = await b.newContext(); const p = await c.newPage(); const sizes = [];
      p.on("response", async (r) => { if (r.request().resourceType() === "script") { try { sizes.push([r.url(), (await r.body()).length]); } catch {} } });
      await p.goto(base + page); await p.waitForSelector('[data-map-status="ready"]', { timeout: 60000 });
      for (const [u] of sizes.sort((a, b) => b[1] - a[1])) { mlChunk = u; break; } await c.close(); }
    for (const [name, pattern, kind] of cases) {
      const c = await b.newContext(); const p = await c.newPage(); let hit = 0; const errs = [];
      p.on("pageerror", (e) => errs.push(e.message.slice(0, 100)));
      p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 100)));
      if (pattern) {
        await c.route("**/*", async (route) => {
          const u = route.request().url();
          const match = pattern === "maplibre" ? u === mlChunk : pattern.test(u);
          if (match && hit++ === 0) {
            if (kind === "abort") return route.abort("failed");
            await new Promise((r) => setTimeout(r, 5000));
          }
          return route.continue();
        });
      }
      const t0 = Date.now(); await p.goto(base + page);
      let state = "never ready in 20 s";
      try { await p.waitForSelector('[data-map-status="ready"]', { timeout: 20000 }); state = `ready after ${((Date.now() - t0) / 1000).toFixed(1)} s`; }
      catch { state += `; status=${await p.evaluate(() => document.querySelector("[data-map-status]")?.dataset.mapStatus ?? "(no attribute)")}; text="${await p.evaluate(() => (document.body.innerText.match(/Loading the map…|couldn.t load the map[^\n]*|Map unavailable[^\n]*/i) || [""])[0])}"`; }
      console.log(`${page === "/" ? "home " : "match"} | ${name.padEnd(28)} | ${state}${errs.length ? " | " + errs[0] : ""}`);
      await c.close();
    }
  }
  await b.close();
})();
