// node fidelity-table.cjs <label>=<shape-fidelity.json>[+<more.json>] [<label>=… …]
// Markdown tables from shape-fidelity.cjs results, one column group per
// variant (e.g. before=a.json+a-phone.json after=b.json), for
// docs/maplibre-comparison/fidelity.md.
const fs = require("fs");

const variants = process.argv.slice(2).map((a) => {
  const [label, files] = a.split("=");
  return { label, rows: files.split("+").flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8"))) };
});
const PASS = 1; // px
const fmt = (v) => (v == null ? "–" : v.toFixed(2));
// The window's device pixel ratio (older result files only have the one the
// map drew at, lowered by MapLibre above 4096 px: 2 → 1.6 or 1.07).
const asked = (r) => r.requestedDpr ?? (r.dpr < 1.001 ? 1 : r.dpr > 2.5 ? 3 : 2);
const key = (r) => `${r.map} ${r.size} ${asked(r)}`;

// Worst country per window: the outline (main measure) and pixels vs exact.
function summary(r) {
  const on = r.results.filter((c) => c.outline && c.outline.max != null);
  const worst = on.reduce((a, c) => (c.outline.max > a.outline.max ? c : a));
  const p99 = Math.max(...on.map((c) => c.outline.p99));
  const px99 = Math.max(...on.map((c) => Math.max(c.drawnToIdeal.p99 ?? 0, c.idealToDrawn.p99 ?? 0)));
  const exact = Math.max(...r.results.map((c) => c.outlineExact.max ?? 0));
  return { worst, p99, px99, exact };
}

for (const map of ["hero", "match"]) {
  // Every window measured in any variant, in the order first seen.
  const seen = new Map();
  for (const v of variants) for (const r of v.rows) if (r.map === map && !seen.has(key(r))) seen.set(key(r), r);
  const rows = [...seen.values()];
  if (!rows.length) continue;
  console.log(`\n### ${map === "hero" ? "Home page (hero)" : "Match page"}\n`);
  const head = ["Window", "DPR", "Zoom"];
  for (const v of variants) head.push(`${v.label}: max (country)`, `${v.label}: p99`, `${v.label}`);
  console.log(`| ${head.join(" | ")} |`);
  console.log(`|${head.map(() => "---").join("|")}|`);
  for (const r of rows) {
    const cells = [r.size.replace("x", "×"), asked(r), r.zoom.toFixed(2)];
    for (const v of variants) {
      const m = v.rows.find((x) => key(x) === key(r));
      if (!m) { cells.push("–", "–", "–"); continue; }
      const s = summary(m);
      const lowered = Math.abs(m.dpr - asked(m)) > 0.01 ? ` (drawn at DPR ${+m.dpr.toFixed(2)})` : "";
      cells.push(`${fmt(s.worst.outline.max)} (${s.worst.code})${lowered}`, fmt(s.p99), s.worst.outline.max <= PASS ? "✅" : "❌");
    }
    console.log(`| ${cells.join(" | ")} |`);
  }
}

// Per-country detail for each variant at the sizes the owner looks at.
for (const v of variants) {
  for (const pick of ["hero 1680x1050 1", "hero 2560x1440 2", "match 1680x1050 2"]) {
    const r = v.rows.find((x) => key(x) === pick);
    if (!r) continue;
    console.log(`\n#### ${v.label}: ${pick.replace(/ (\d)$/, " @ DPR $1")}\n`);
    console.log("| Country | outline max | outline p99 | exact rasterization max | pixels vs exact p99 (map→exact / exact→map) | worst at (lng, lat) |");
    console.log("|---|---|---|---|---|---|");
    for (const c of r.results) {
      if (!c.outline || c.outline.max == null) {
        console.log(`| ${c.code} | (under 1 px) | | | | |`);
        continue;
      }
      console.log(
        `| ${c.code} | ${fmt(c.outline.max)} | ${fmt(c.outline.p99)} | ${fmt(c.outlineExact.max)} | ${fmt(c.drawnToIdeal.p99)} / ${fmt(c.idealToDrawn.p99)} | ${c.outline.at?.join(", ") ?? ""} |`
      );
    }
  }
}
