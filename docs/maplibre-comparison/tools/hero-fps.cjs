// node hero-fps.cjs <home page URL (with ?_vercel_share=… if protected)> [cpu slowdown, default 4]
// Frames per second of the home-page map's "light up" animation, with the
// CPU slowed down (Chrome DevTools throttling; 4× ≈ a mid-range phone), and
// what the map shows at once for visitors who prefer reduced motion.
const { chromium } = require("playwright");
const [, , start, slowdownArg] = process.argv;
const slowdown = Number(slowdownArg ?? 4);
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost" } : undefined;

async function run(browser, reducedMotion) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", reducedMotion });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: slowdown });
  // Count animation frames from the moment the map's canvas appears.
  await page.addInitScript(() => {
    window.__frames = [];
    const loop = (t) => {
      if (document.querySelector("canvas")) window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.goto(start);
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page.waitForTimeout(reducedMotion === "reduce" ? 600 : 4000);
  const shot = `hero-${reducedMotion}-${slowdown}x.png`;
  await page.screenshot({ path: shot });
  const frames = await page.evaluate(() => window.__frames);
  await context.close();
  // The animation runs ~0.7 s + 22 ms per country after the map loads;
  // measure the 2.5 s after the first frame.
  const t0 = frames[0];
  const win = frames.filter((t) => t - t0 <= 2500);
  const gaps = win.slice(1).map((t, i) => t - win[i]).sort((a, b) => a - b);
  return {
    fps: Math.round(((win.length - 1) / (win.at(-1) - t0)) * 1000),
    slowestFrameMs: Math.round(gaps.at(-1)),
    p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)]),
    screenshot: shot,
  };
}

(async () => {
  const browser = await chromium.launch({ proxy });
  console.log(JSON.stringify({ cpuSlowdown: slowdown, animation: await run(browser, "no-preference"), reducedMotion: await run(browser, "reduce") }, null, 1));
  await browser.close();
})();
