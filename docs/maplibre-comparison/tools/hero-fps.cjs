// node hero-fps.cjs <home page URL (with ?_vercel_share=… if protected)> [cpu slowdown, default 4] [window, default 1440x900]
// Frames per second of the home-page map's "light up" animation, with the
// CPU slowed down (Chrome DevTools throttling; 4× ≈ a mid-range phone), and
// what the map shows at once for visitors who prefer reduced motion.
const { chromium } = require("playwright");
const [, , start, slowdownArg, windowArg] = process.argv;
const slowdown = Number(slowdownArg ?? 4);
const [width, height] = (windowArg ?? "1440x900").split("x").map(Number);
// A phone-sized window is emulated as a phone (touch, DPR 3 like an iPhone).
const phone = width < 600 ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {};
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost" } : undefined;

async function run(browser, reducedMotion) {
  const context = await browser.newContext({ viewport: { width, height }, ...phone, colorScheme: "dark", reducedMotion });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: slowdown });
  // Count animation frames from the moment the map has loaded (HeroMap
  // marks its container; the old Mapbox version doesn't, so for it the
  // count starts when the canvas appears).
  await page.addInitScript(() => {
    window.__frames = [];
    const loop = (t) => {
      const ready = document.querySelector('[data-map-status="ready"]') ??
        (!document.querySelector("[data-map-status]") && document.querySelector(".mapboxgl-canvas"));
      if (ready) window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.goto(start);
  await page.waitForSelector("canvas", { timeout: 60000 });
  // Main-thread work (JavaScript, and all tasks) while the animation runs:
  // 2.5 s from the moment the map is ready. This is what a slow phone's CPU
  // has to keep up with; the drawing itself runs on the GPU.
  await cdp.send("Performance.enable");
  await page.waitForSelector('[data-map-status="ready"]', { timeout: 60000 }).catch(() => {});
  const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const m0 = await metric();
  await page.waitForTimeout(2500);
  const m1 = await metric();
  const mainThread = {
    scriptMs: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
    taskMs: Math.round((m1.TaskDuration - m0.TaskDuration) * 1000),
  };
  await page.waitForTimeout(reducedMotion === "reduce" ? 0 : 1500);
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
    // Time from the start of navigation until the map has drawn (CPU slowed).
    mapReadyMs: Math.round(t0),
    fps: Math.round(((win.length - 1) / (win.at(-1) - t0)) * 1000),
    // Main-thread time in the 2.5 s after the map is ready (with the CPU
    // slowdown applied), in total and per frame drawn.
    ...mainThread,
    scriptMsPerFrame: +(mainThread.scriptMs / Math.max(1, win.length - 1)).toFixed(1),
    slowestFrameMs: Math.round(gaps.at(-1)),
    p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)]),
    screenshot: shot,
  };
}

(async () => {
  const browser = await chromium.launch({ proxy });
  console.log(JSON.stringify({ cpuSlowdown: slowdown, window: `${width}x${height}`, animation: await run(browser, "no-preference"), reducedMotion: await run(browser, "reduce") }, null, 1));
  await browser.close();
})();
