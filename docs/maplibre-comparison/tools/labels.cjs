// node labels.cjs [baseUrl] [width] [height]
// Lists which countries the MapLibre map labels in each view, and which
// countries it should label but doesn't. Needs the app running in
// development mode (`npm run dev`): it reads the map through
// window.__fanmapMap, which production builds don't have.
//
// Views zoom in from the fitted world view by the same steps as the
// screenshots (one double-click = one zoom level).
const { chromium } = require("playwright");
const [, , base = "http://localhost:3000", w = "1440", h = "900"] = process.argv;
const MATCH = "bffd1947-5f1a-4825-89db-ea47f82443ae";

// What must be named in each view: countries of at least this area (km²)
// whose label point lies inside the view.
const VIEWS = [
  { name: "world", center: null, zoomIn: 0, minArea: 100000 },
  { name: "europe", center: [15, 52], zoomIn: 2, minArea: 10000 },
  { name: "asia", center: [90, 30], zoomIn: 1, minArea: 50000 },
  { name: "south-america", center: [-60, -20], zoomIn: 1, minArea: 50000 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, colorScheme: "dark" });
  await page.goto(`${base}/match/${MATCH}`);
  await page.waitForFunction(() => document.querySelector('[data-map-status="ready"]') && window.__fanmapMap, null, {
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
  // Every label point the map has (whether placed or not), once each.
  const all = {
    features: await page.evaluate(() => {
      const seen = new Map();
      for (const f of window.__fanmapMap.querySourceFeatures("country-labels")) {
        seen.set(f.properties.code, { properties: f.properties, geometry: f.geometry });
      }
      return [...seen.values()];
    }),
  };
  const worldZoom = await page.evaluate(() => window.__fanmapMap.getZoom());
  const worldCenter = await page.evaluate(() => window.__fanmapMap.getCenter().toArray());
  const report = {};
  for (const v of VIEWS) {
    await page.evaluate(
      ([c, z]) => window.__fanmapMap.jumpTo({ center: c, zoom: z }),
      [v.center ?? worldCenter, worldZoom + v.zoomIn]
    );
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const map = window.__fanmapMap;
      const shown = [...new Set(map.queryRenderedFeatures({ layers: ["country-label"] }).map((f) => f.properties.code))];
      const b = map.getBounds();
      return { shown, bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() };
    });
    const [W, S, E, N] = result.bounds;
    const inView = all.features.filter(({ geometry: { coordinates: [x, y] } }) => x >= W && x <= E && y >= S && y <= N);
    const missing = inView
      .filter((f) => f.properties.area >= v.minArea && !result.shown.includes(f.properties.code))
      .map((f) => `${f.properties.name} (${Math.round(f.properties.area / 1000)}k km²)`);
    report[v.name] = {
      zoom: Math.round(result.zoom * 100) / 100,
      labelled: result.shown.length,
      [`missing (≥ ${v.minArea.toLocaleString("en-US")} km²)`]: missing,
      names: result.shown
        .map((c) => all.features.find((f) => f.properties.code === c)?.properties.name ?? c)
        .sort(),
    };
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
