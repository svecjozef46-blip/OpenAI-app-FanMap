// node fps-table.cjs <results.jsonl>
// Markdown table (medians of the runs) from lines written by a loop over
// hero-fps.cjs, each line: {"window", "cpu", "tol", "run", "result": <hero-fps output>}.
const fs = require("fs");
const rows = fs
  .readFileSync(process.argv[2], "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((r) => r && r.result && r.result.animation);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const groups = new Map();
for (const r of rows) {
  const k = `${r.window}|${r.cpu}|${r.tol}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r.result.animation);
}
console.log("| Window | CPU slowdown | Tolerance | Runs | FPS | p95 frame (ms) | Main-thread JS per frame (ms) | Map ready (ms) |");
console.log("|---|---|---|---|---|---|---|---|");
for (const [k, a] of groups) {
  const [win, cpu, tol] = k.split("|");
  console.log(
    `| ${win.replace("x", "×")} | ${cpu}× | ${tol} | ${a.length} | ${med(a.map((x) => x.fps))} | ${med(a.map((x) => x.p95FrameMs))} | ${med(a.map((x) => x.scriptMsPerFrame))} | ${med(a.map((x) => x.mapReadyMs))} |`
  );
}
