// node overlaps.cjs [baseUrl]
// At world view, on several screen sizes: which country labels sit under
// something floating over the map (zoom buttons, legend, share bar, match
// header, attribution). Needs `npm run dev` (reads window.__fanmapMap).
const { chromium } = require("playwright");
const [, , base = "http://localhost:3000"] = process.argv;
const MATCH = "bffd1947-5f1a-4825-89db-ea47f82443ae";
const SIZES = [
  [1280, 720],
  [1366, 768],
  [1536, 864],
  [1600, 900],
  [2560, 1440],
  [1440, 900],
  [1920, 1080],
  [1024, 768],
  [768, 1024],
  [390, 844],
];

(async () => {
  const browser = await chromium.launch();
  for (const [width, height] of SIZES) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: "dark" });
    await page.goto(`${base}/match/${MATCH}`);
    await page.waitForFunction(() => document.querySelector('[data-map-status="ready"]') && window.__fanmapMap, null, {
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    const hits = await page.evaluate(() => {
      const map = window.__fanmapMap;
      const canvas = map.getCanvas().getBoundingClientRect();
      const mapBox = map.getContainer().getBoundingClientRect();
      // Everything drawn on top of the map: its own controls, and the app's
      // panels positioned over the map area.
      const overlays = [...document.querySelectorAll(".maplibregl-ctrl, .mapboxgl-ctrl, [data-map-overlay]")]
        .map((el) => ({ name: el.getAttribute("data-map-overlay") || el.className.split(" ")[0], r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0);
      const out = [];
      for (const f of map.queryRenderedFeatures({ layers: ["country-label"] })) {
        const p = map.project(f.geometry.coordinates);
        const x = canvas.left + p.x, y = canvas.top + p.y;
        // Rough label box: text width ~ 5.5 px per letter at world zoom.
        const half = (f.properties.name.length * 5.5) / 2;
        for (const o of overlays) {
          if (x + half > o.r.left && x - half < o.r.right && y + 7 > o.r.top && y - 7 < o.r.bottom) {
            out.push(`${f.properties.name} under ${o.name}`);
          }
        }
      }
      return { out, map: [Math.round(mapBox.width), Math.round(mapBox.height)], overlays: overlays.map((o) => o.name) };
    });
    console.log(`${width}×${height} (map ${hits.map.join("×")}): ${hits.out.length ? hits.out.join("; ") : "no label covered"}`);
    await page.close();
  }
  await browser.close();
})();
