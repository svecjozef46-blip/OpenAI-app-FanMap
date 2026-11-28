// node hero-shots.cjs <out dir> <before URL> <after URL> <dev URL for framing> [--sizes=1680x1050@1,2560x1440@2] [--themes=dark,light]
// Before/after pictures of the home-page map: the whole window, and
// close-ups (cropped from the same screenshot, at the device's own pixels)
// of the coastlines that showed the problem — Canada's Arctic islands,
// Australia, Indonesia, Norway. URLs may carry ?_vercel_share=… for a
// protected preview. Reduced motion, so each page shows its finished
// colors at once.
//
// The crop boxes come from the map's own projection on a dev server
// (`npm run dev`, window.__fanmapHeroMap) at the same window size: the
// layout is the same on every deployment.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const [outDir, before, after, dev] = args.filter((a) => !a.startsWith("--"));
const opt = (name, def) => (args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def).split(",");
const SIZES = opt("sizes", "1680x1050@1,2560x1440@2,390x844@3").map((s) => {
  const [wh, dpr] = s.split("@");
  const [w, h] = wh.split("x").map(Number);
  return { w, h, dpr: Number(dpr ?? 1) };
});
const THEMES = opt("themes", "dark,light");
const REGIONS = {
  canada: [[-125, 83.2], [-60, 66]],
  australia: [[112, -9], [155, -44.5]],
  indonesia: [[94, 7], [142, -11.5]],
  norway: [[3, 72], [33, 57]],
};
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost" } : undefined;

async function shoot(browser, url, { w, h, dpr }, theme, file) {
  const phone = w < 600 ? { isMobile: true, hasTouch: true } : {};
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, ...phone, colorScheme: theme, reducedMotion: "reduce" });
  // The site keeps the visitor's light/dark choice; start from the system one.
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector('[data-map-status="ready"]', { timeout: 90000 });
  await page.waitForTimeout(2500); // tiles drawn, colors set
  await page.screenshot({ path: file });
  await context.close();
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ proxy });
  const crops = {};
  for (const size of SIZES) {
    const key = `${size.w}x${size.h}@${size.dpr}`;
    // Framing from the dev server.
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(dev);
    await page.waitForFunction(() => window.__fanmapHeroMap && window.__fanmapHeroMap.loaded(), null, { timeout: 120000 });
    crops[key] = await page.evaluate((regions) => {
      const map = window.__fanmapHeroMap;
      const rect = map.getCanvas().getBoundingClientRect();
      const out = {};
      for (const [name, [nw, se]] of Object.entries(regions)) {
        const a = map.project(nw), b = map.project(se);
        out[name] = [a.x + rect.left, a.y + rect.top, b.x + rect.left, b.y + rect.top].map(Math.round);
      }
      return out;
    }, REGIONS);
    await context.close();
    for (const theme of THEMES) {
      for (const [label, url] of [["before", before], ["after", after]]) {
        const file = path.join(outDir, `hero-${key}-${theme}-${label}.png`);
        await shoot(browser, url, size, theme, file);
        console.log(file);
      }
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "crops.json"), JSON.stringify(crops, null, 1));
})();
