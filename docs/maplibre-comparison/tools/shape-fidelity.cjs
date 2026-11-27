// node shape-fidelity.cjs <app URL, e.g. http://localhost:3000> [out.json] [--maps=hero,match] [--sizes=1680x1050] [--dpr=1,2]
//
// How faithfully the MapLibre maps draw country outlines, in device pixels.
// Needs `npm run dev` (it reads the maps through window.__fanmapHeroMap and
// window.__fanmapMap, which production builds don't have).
//
// For every window size × device pixel ratio, for the home-page map and the
// match map at their world view:
//   1. The fill layer is recolored so each checked country has its own solid
//      color (everything else, labels and borders hidden). The map's own
//      pixels are read straight from its WebGL canvas.
//   2. The source shapes (public/data/countries.<hash>.topo.json, decoded
//      like the app does) are projected with the map's own projection.
//   3. Per country, in device pixels:
//        drawn → source   how far each pixel on the edge of the drawn shape is
//                         from the true outline (vector distance);
//        drawn ↔ ideal    the source shapes rasterized again, exactly, with
//                         WebGL's rule (a pixel is filled when its centre
//                         is inside): how far each edge
//                         pixel of one is from the nearest edge pixel of the
//                         other, both ways. Detail thinner than a pixel (a
//                         fjord, a strait) disappears from both, so what
//                         remains is what the map's simplification changed.
//   Reported: maximum and 99th percentile. A pixel centre may sit up to
//   ~0.7 px from the true edge even when drawn perfectly, and two exact
//   rasterizations can differ by one pixel along an edge, so the pass mark
//   is "≤ 1 px" for both.
// Plus the antimeridian countries (Russia/Chukotka, USA/Aleutians, Fiji,
// Kiribati) and how far the map extends beyond the window.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const { feature } = require("topojson-client");

const ROOT = path.resolve(__dirname, "../../..");
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--") && a.startsWith("http")) ?? "http://localhost:3000";
const outFile = args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
const opt = (name, def) => (args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def).split(",");

const MAPS = opt("maps", "hero,match");
const SIZES = opt("sizes", "1280x720,1440x900,1680x1050,1920x1080,2560x1440,3840x2160").map((s) => s.split("x").map(Number));
const DPRS = opt("dpr", "1,2").map(Number);
// --diff=CA,NO saves an image per country next to the JSON: white = both,
// red = only the map, cyan = only the exact drawing.
const DIFF = opt("diff", "").filter(Boolean);
// --exp='{"hero":{"tolerance":1.5},"match":{…},"map":{"maxCanvasSize":[4096,4096]}}':
// draw with other settings, e.g. those before a change (hero / match: the
// country sources of that map; map: options of the map itself). Read by the
// engine in development only (devOverrides in lib/mapEngineMaplibre.ts).
const EXP = (() => { const a = args.find((x) => x.startsWith("--exp=")); return a ? JSON.parse(a.slice(6)) : null; })();
const MATCH = "bffd1947-5f1a-4825-89db-ea47f82443ae";

const CHECKED = ["CA", "RU", "AU", "ID", "NO", "GB", "IT", "US", "BR", "CL", "GR", "JP", "NZ", "SK", "MT", "SG", "FJ", "KI"];
// Distinct colors; neighbours (CA/US, NO/RU…) never share one.
const PALETTE = [
  [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255],
  [255, 128, 0], [128, 0, 255], [0, 128, 255], [255, 0, 128], [128, 255, 0], [0, 255, 128],
  [255, 255, 255], [128, 128, 255], [255, 128, 128], [128, 255, 255], [200, 100, 0], [0, 100, 200],
];

// Source shapes, decoded and rounded exactly like lib/mapEngineMaplibre.ts.
const assets = fs.readFileSync(path.join(ROOT, "src/lib/mapAssets.ts"), "utf8");
const url = assets.match(/COUNTRIES_URL = "([^"]+)"/)[1];
const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "public", url), "utf8"));
const all = feature(topo, topo.objects.countries).features;
const source = {};
for (const f of all) {
  const code = f.properties.code;
  if (!CHECKED.includes(code)) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  source[code] = polys.map((p) => p.map((ring) => ring.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4])));
}

// --- In the page: recolor, read pixels, project, measure -------------------
async function measure(page, mapVar, DIFF) {
  return page.evaluate(
    async ({ mapVar, CHECKED, PALETTE, source, DIFF }) => {
      const map = window[mapVar];
      const style = map.getStyle();
      const match = ["match", ["get", "code"]];
      CHECKED.forEach((c, i) => match.push(c, `rgb(${PALETTE[i].join(",")})`));
      match.push("rgba(0,0,0,0)");
      for (const layer of style.layers) {
        if (layer.id === "country-fills") {
          map.setPaintProperty(layer.id, "fill-color", match);
          map.setPaintProperty(layer.id, "fill-opacity", ["match", ["get", "code"], CHECKED, 1, 0]);
          // The soft half-pixel outline both libraries draw around fills
          // (same on Mapbox) is left out, so a pixel is the map's shape.
          map.setPaintProperty(layer.id, "fill-antialias", false);
        } else {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      }
      await new Promise((r) => map.once("idle", r));

      const canvas = map.getCanvas();
      const dpr = canvas.width / canvas.clientWidth;
      const W = canvas.width, H = canvas.height;
      const rect = canvas.getBoundingClientRect();
      const project = (lng, lat) => {
        const p = map.project([lng, lat]);
        return [p.x * dpr, p.y * dpr];
      };

      // Projected source outline per country, and its pixel bounding box.
      const jobs = CHECKED.map((code, idx) => {
        const rings = [];
        for (const poly of source[code] ?? []) for (const ring of poly) rings.push(ring.map(([x, y]) => project(x, y)));
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        const pad = 6;
        const bx = Math.max(0, Math.floor(x0) - pad), by = Math.max(0, Math.floor(y0) - pad);
        const bw = Math.min(W, Math.ceil(x1) + pad) - bx, bh = Math.min(H, Math.ceil(y1) + pad) - by;
        return { code, idx, rings, bx, by, bw, bh };
      });

      // Read every country's box right after a frame is drawn (WebGL clears
      // the buffer afterwards).
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      const pixels = await new Promise((resolve) => {
        map.once("render", () => {
          resolve(
            jobs.map((j) => {
              if (j.bw <= 0 || j.bh <= 0) return null;
              const buf = new Uint8Array(j.bw * j.bh * 4);
              gl.readPixels(j.bx, H - j.by - j.bh, j.bw, j.bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
              return buf;
            })
          );
        });
        map.triggerRepaint();
      });

      const results = [];
      for (const j of jobs) {
        const buf = pixels[j.idx];
        if (!buf) { results.push({ code: j.code, offscreen: true }); continue; }
        const { bw, bh, bx, by } = j;
        // Drawn mask: opaque enough and closest in color to this country.
        const mask = new Uint8Array(bw * bh);
        let drawnPixels = 0;
        for (let row = 0; row < bh; row++) {
          const srcRow = bh - 1 - row; // readPixels is bottom-up
          for (let col = 0; col < bw; col++) {
            const o = (srcRow * bw + col) * 4;
            const a = buf[o + 3];
            if (a < 128) continue;
            const r = (buf[o] * 255) / a, g = (buf[o + 1] * 255) / a, b = (buf[o + 2] * 255) / a;
            let best = -1, bestD = Infinity;
            PALETTE.forEach((p, k) => {
              const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
              if (d < bestD) { bestD = d; best = k; }
            });
            if (best === j.idx) { mask[row * bw + col] = 1; drawnPixels++; }
          }
        }
        // Segments of the true outline (crop coordinates), with a grid index.
        const segs = [];
        for (const r of j.rings) for (let k = 1; k < r.length; k++) segs.push([r[k - 1][0] - bx, r[k - 1][1] - by, r[k][0] - bx, r[k][1] - by]);
        const CELL = 8;
        const gw = Math.ceil(bw / CELL) + 1, gh = Math.ceil(bh / CELL) + 1;
        const grid = Array.from({ length: gw * gh }, () => []);
        segs.forEach((s, k) => {
          // Clamped into the grid: a segment just outside the box (e.g. the
          // 180° cut, a hair left of x = 0) must still be found.
          const cx = (v) => Math.max(0, Math.min(gw - 1, Math.floor(v / CELL)));
          const cy = (v) => Math.max(0, Math.min(gh - 1, Math.floor(v / CELL)));
          const cx0 = cx(Math.min(s[0], s[2])), cx1 = cx(Math.max(s[0], s[2]));
          const cy0 = cy(Math.min(s[1], s[3])), cy1 = cy(Math.max(s[1], s[3]));
          for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) grid[cy * gw + cx].push(k);
        });
        const segDist = (px, py) => {
          const cx = Math.floor(px / CELL), cy = Math.floor(py / CELL);
          let best = Infinity;
          for (let rad = 0; rad < Math.max(gw, gh); rad++) {
            for (let yy = cy - rad; yy <= cy + rad; yy++) for (let xx = cx - rad; xx <= cx + rad; xx++) {
              if (Math.max(Math.abs(yy - cy), Math.abs(xx - cx)) !== rad || xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
              for (const k of grid[yy * gw + xx]) {
                const [x1, y1, x2, y2] = segs[k];
                const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
                const t = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
                const d = Math.hypot(x1 + t * dx - px, y1 + t * dy - py);
                if (d < best) best = d;
              }
            }
            if (best <= (rad - 1) * CELL) break;
          }
          return best;
        };
        // Edge pixels of the drawn shape (not at the canvas edge, where the
        // window cuts the shape).
        const inside = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && mask[y * bw + x] === 1;
        const edge = new Uint8Array(bw * bh);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          if (!mask[y * bw + x]) continue;
          if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
          const gx = bx + x, gy = by + y;
          if (gx === 0 || gy === 0 || gx === W - 1 || gy === H - 1) continue;
          edge[y * bw + x] = 1;
        }
        // Reference: the source shapes rasterized exactly, with the rule
        // WebGL uses for triangles: a pixel is filled when its centre is
        // inside the shape (even-odd scanline at each pixel-centre row).
        // Same vertices, no simplification, no tiles.
        const ideal = new Uint8Array(bw * bh);
        const rows = Array.from({ length: bh }, () => []);
        for (const r of j.rings) {
          for (let k = 1; k < r.length; k++) {
            const x1 = r[k - 1][0] - bx, y1 = r[k - 1][1] - by, x2 = r[k][0] - bx, y2 = r[k][1] - by;
            if (y1 === y2) continue;
            const lo = Math.max(0, Math.ceil(Math.min(y1, y2) - 0.5)), hi = Math.min(bh - 1, Math.ceil(Math.max(y1, y2) - 0.5) - 1);
            for (let row = lo; row <= hi; row++) {
              const yc = row + 0.5;
              rows[row].push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
            }
          }
        }
        let idealPixels = 0, differing = 0;
        rows.forEach((xs, row) => {
          xs.sort((p, q) => p - q);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const from = Math.max(0, Math.ceil(xs[k] - 0.5)), to = Math.min(bw - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
            for (let col = from; col <= to; col++) ideal[row * bw + col] ^= 1;
          }
        });
        for (let k = 0; k < bw * bh; k++) {
          idealPixels += ideal[k];
          if (ideal[k] !== mask[k]) differing++;
        }
        // The outline a raster draws runs between a filled pixel and an empty
        // neighbour: how far is the middle of each such pair from the true
        // outline? An exact rasterization keeps every one within 0.5 px.
        const outlineDistances = (m) => {
          const d = [];
          let worstK = -1, worstD = -1;
          for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
            const k = y * bw + x;
            if (x + 1 < bw && m[k] !== m[k + 1]) {
              const v = segDist(x + 1, y + 0.5); d.push(v);
              if (v > worstD) { worstD = v; worstK = k; }
            }
            if (y + 1 < bh && m[k] !== m[k + bw]) {
              const v = segDist(x + 0.5, y + 1); d.push(v);
              if (v > worstD) { worstD = v; worstK = k; }
            }
          }
          return { d, worstK };
        };
        const outlineDrawn = outlineDistances(mask), outlineExact = outlineDistances(ideal);
        // Edge pixels of a mask (not where the window cuts the shape).
        const edgesOf = (m) => {
          const e = new Uint8Array(bw * bh);
          const at = (x, y) => x >= 0 && y >= 0 && x < bw && y < bh && m[y * bw + x] === 1;
          for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
            if (!m[y * bw + x]) continue;
            if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) continue;
            const gx = bx + x, gy = by + y;
            if (gx === 0 || gy === 0 || gx === W - 1 || gy === H - 1) continue;
            e[y * bw + x] = 1;
          }
          return e;
        };
        // Exact Euclidean distance (px) from every pixel to the nearest edge
        // pixel (Felzenszwalb & Huttenlocher).
        const INF = 1e12;
        const n = Math.max(bw, bh);
        const f = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), dd = new Float64Array(n);
        const edt1 = (len) => {
          let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
          for (let q = 1; q < len; q++) {
            let s;
            while ((s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])) <= z[k]) k--;
            k++; v[k] = q; z[k] = s; z[k + 1] = INF;
          }
          k = 0;
          for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; dd[q] = (q - v[k]) ** 2 + f[v[k]]; }
        };
        const distanceTo = (e) => {
          const dt = new Float64Array(bw * bh);
          for (let k = 0; k < bw * bh; k++) dt[k] = e[k] ? 0 : INF;
          for (let x = 0; x < bw; x++) { for (let y = 0; y < bh; y++) f[y] = dt[y * bw + x]; edt1(bh); for (let y = 0; y < bh; y++) dt[y * bw + x] = dd[y]; }
          for (let y = 0; y < bh; y++) { for (let x = 0; x < bw; x++) f[x] = dt[y * bw + x]; edt1(bw); for (let x = 0; x < bw; x++) dt[y * bw + x] = Math.sqrt(dd[x]); }
          return dt;
        };
        // Islands under 4 px: a renderer may keep or drop each one (a pixel
        // centre inside or not). Counted, not measured as distance.
        const smallParts = (m) => {
          const label = new Int32Array(bw * bh), small = new Uint8Array(bw * bh);
          let next = 0, count = 0, unmatched = 0;
          const other = m === mask ? ideal : mask;
          for (let k = 0; k < bw * bh; k++) {
            if (!m[k] || label[k]) continue;
            const stack = [k], part = [];
            label[k] = ++next;
            while (stack.length) {
              const q = stack.pop(); part.push(q);
              const x = q % bw, y = (q - x) / bw;
              for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
                if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
                const o = yy * bw + xx;
                if (m[o] && !label[o]) { label[o] = next; stack.push(o); }
              }
            }
            if (part.length < 4) {
              count++;
              for (const q of part) small[q] = 1;
              // Is there a pixel of the other map within 1 px?
              const near = part.some((q) => {
                const x = q % bw, y = (q - x) / bw;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                  const xx = x + dx, yy = y + dy;
                  if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && other[yy * bw + xx]) return true;
                }
                return false;
              });
              if (!near) unmatched++;
            }
          }
          return { small, count, unmatched };
        };
        const smallDrawn = smallParts(mask), smallIdeal = smallParts(ideal);
        // Distances to every edge of the other map, tiny islands included;
        // measured from every edge except tiny islands.
        const edgeIdeal = edgesOf(ideal);
        const toIdeal = distanceTo(edgeIdeal), toDrawn = distanceTo(edge);
        const dA = [], dB = [];
        let worstAt = null, worst = -1;
        for (let k = 0; k < bw * bh; k++) {
          if (edge[k] && !smallDrawn.small[k] && toIdeal[k] < 1e5) { dA.push(toIdeal[k]); if (toIdeal[k] > worst) { worst = toIdeal[k]; worstAt = k; } }
          if (edgeIdeal[k] && !smallIdeal.small[k] && toDrawn[k] < 1e5) { dB.push(toDrawn[k]); if (toDrawn[k] > worst) { worst = toDrawn[k]; worstAt = k; } }
        }
        const stats = (a) => {
          if (!a.length) return { max: null, p99: null };
          const s = Float64Array.from(a).sort();
          return { max: +s[s.length - 1].toFixed(2), p99: +s[Math.floor(s.length * 0.99)].toFixed(2) };
        };
        // Where a pixel is, as longitude/latitude.
        const lngLatOf = (k) => {
          if (k === null || k < 0) return null;
          const ll = map.unproject([(bx + (k % bw) + 0.5) / dpr, (by + Math.floor(k / bw) + 0.5) / dpr]);
          return [+ll.lng.toFixed(2), +ll.lat.toFixed(2)];
        };
        const worstLngLat = lngLatOf(worstAt);
        let diffImage, around;
        if (DIFF.includes(j.code)) {
          // map/exact pixels around the worst outline point: 2 = both, 1 = map only, 3 = exact only
          const k0 = outlineDrawn.worstK, x0 = k0 % bw, y0 = Math.floor(k0 / bw);
          around = [];
          for (let y = y0 - 4; y <= y0 + 4; y++) {
            let line = "";
            for (let x = x0 - 6; x <= x0 + 6; x++) {
              if (x < 0 || y < 0 || x >= bw || y >= bh) { line += " "; continue; }
              const a = mask[y * bw + x], b = ideal[y * bw + x];
              line += a && b ? "#" : a ? "m" : b ? "e" : ".";
            }
            around.push(line);
          }
          const c = new OffscreenCanvas(bw, bh), cx = c.getContext("2d"), img = cx.createImageData(bw, bh);
          for (let k = 0; k < bw * bh; k++) {
            const a = mask[k], b = ideal[k];
            const rgb = a && b ? [255, 255, 255] : a ? [255, 40, 40] : b ? [0, 220, 255] : [0, 0, 0];
            img.data.set([...rgb, 255], k * 4);
          }
          cx.putImageData(img, 0, 0);
          const blob = await c.convertToBlob({ type: "image/png" });
          diffImage = btoa(Array.from(new Uint8Array(await blob.arrayBuffer()), (b) => String.fromCharCode(b)).join(""));
        }
        results.push({
          code: j.code,
          diffImage,
          around,
          drawnPixels,
          idealPixels,
          differingPixels: differing,
          // drawn edge → true outline (vector, sub-pixel)
          // the drawn outline vs the true one (the main measure; ≤ 0.5 = exact)
          outline: { ...stats(outlineDrawn.d), at: lngLatOf(outlineDrawn.worstK), atPixel: [outlineDrawn.worstK % bw, Math.floor(outlineDrawn.worstK / bw)] },
          // the same for the exact rasterization (checks this tool: ≤ 0.5)
          outlineExact: stats(outlineExact.d),
          // drawn edge ↔ ideal raster edge, both ways
          drawnToIdeal: stats(dA),
          idealToDrawn: stats(dB),
          worstLngLat,
          // tiny islands (< 4 px): how many, and how many the other lacks
          smallIslands: { drawn: smallDrawn.count, drawnOnly: smallDrawn.unmatched, ideal: smallIdeal.count, idealOnly: smallIdeal.unmatched },
        });
      }
      return {
        dpr,
        zoom: +map.getZoom().toFixed(3),
        canvas: [W, H],
        // What the window shows of the map: longitude/latitude at the edges
        // of the visible part, and where the far ends of the land are (CSS
        // px; outside the window = cut off).
        windowEdges: (() => {
          const tl = map.unproject([Math.max(0, -rect.left), Math.max(0, -rect.top)]);
          const br = map.unproject([Math.min(rect.width, window.innerWidth - rect.left), Math.min(rect.height, window.innerHeight - rect.top)]);
          return { west: +tl.lng.toFixed(1), north: +tl.lat.toFixed(1), east: +br.lng.toFixed(1), south: +br.lat.toFixed(1) };
        })(),
        extremes: Object.fromEntries(
          Object.entries({
            "Greenland N (Cape Morris Jesup)": [-33.0, 83.6],
            "Svalbard N": [20.0, 80.8],
            "Franz Josef Land N": [60.0, 81.8],
            "Canada N (Ellesmere)": [-70.0, 83.1],
            "Alaska W (Cape Prince of Wales)": [-168.1, 65.6],
            "Aleutians W (Attu)": [172.9, 52.9],
            "Chukotka E (Cape Dezhnev)": [-169.7, 66.1],
            "Chukotka E, east of 180°": [180, 66.1],
            "Wrangel Island": [-179.5, 71.2],
            "Fiji (Taveuni, 180°)": [-180, -16.5],
            "Kiribati W (Tarawa)": [173.0, 1.4],
            "Kiribati E (Kiritimati)": [-157.4, 1.9],
            "Tierra del Fuego S": [-67.3, -55.9],
            "New Zealand S": [168.0, -47.2],
          }).map(([name, ll]) => {
            const p = map.project(ll);
            const x = p.x + rect.left, y = p.y + rect.top;
            const visible = x >= Math.max(0, rect.left) && y >= Math.max(0, rect.top) &&
              x <= Math.min(window.innerWidth, rect.right) && y <= Math.min(window.innerHeight, rect.bottom);
            return [name, { x: Math.round(x), y: Math.round(y), visible }];
          })
        ),
        // How much of the map lies outside the window (CSS px), per side.
        beyondWindow: {
          left: Math.max(0, -rect.left), top: Math.max(0, -rect.top),
          right: Math.max(0, rect.right - window.innerWidth), bottom: Math.max(0, rect.bottom - window.innerHeight),
        },
        results,
      };
    },
    { mapVar, CHECKED, PALETTE, source, DIFF }
  );
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const mapKind of MAPS) {
    for (const [w, h] of SIZES) {
      for (const dpr of DPRS) {
        const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: "dark" });
        const mapVar = mapKind === "hero" ? "__fanmapHeroMap" : "__fanmapMap";
        if (EXP) await page.addInitScript((e) => (window.__fanmapMapOptions = e), EXP);
        await page.goto(`${base}${mapKind === "hero" ? "/" : `/match/${MATCH}`}`);
        await page.waitForFunction((v) => window[v] && window[v].loaded(), mapVar, { timeout: 120000 });
        await page.waitForTimeout(1500);
        const m = await measure(page, mapVar, DIFF);
        for (const r of m.results) {
          if (!r.diffImage) continue;
          const file = `${(outFile ?? "shape-fidelity.json").replace(/\.json$/, "")}-diff-${mapKind}-${w}x${h}@${dpr}-${r.code}.png`;
          fs.writeFileSync(file, Buffer.from(r.diffImage, "base64"));
          delete r.diffImage;
        }
        // dpr: what the map actually drew at (MapLibre lowers it for a canvas
        // over its size limit); requestedDpr: the window's.
        report.push({ map: mapKind, size: `${w}x${h}`, requestedDpr: dpr, ...m });
        const on = m.results.filter((r) => !r.offscreen);
        const worst = (key, v = "max") => Math.max(...on.map((r) => r[key][v] ?? 0)).toFixed(2);
        console.log(
          `${mapKind.padEnd(5)} ${`${w}x${h}`.padEnd(9)} dpr ${dpr}  zoom ${m.zoom}  outline max ${worst("outline")} p99 ${worst("outline", "p99")} (exact ${worst("outlineExact")})  pixels vs exact: max ${worst("drawnToIdeal")}/${worst("idealToDrawn")} p99 ${worst("drawnToIdeal", "p99")}/${worst("idealToDrawn", "p99")}`
        );
        await page.close();
      }
    }
  }
  await browser.close();
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 1));
})();
