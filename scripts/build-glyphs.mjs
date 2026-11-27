#!/usr/bin/env node
// Builds the label font for the MapLibre map: signed-distance-field glyphs
// (.pbf, the format MapLibre and Mapbox read) from a TrueType file, in plain
// Node, no browser and no native tools.
//
//   node scripts/build-glyphs.mjs [output-dir] [font name]
//
// Without arguments it builds every font in FONTS into
// public/fonts/<hash>/<font name>/<range>.pbf (see scripts/build-countries.mjs,
// which calls it, for the hash). The TTFs come from Google Fonts' GitHub
// repository at a pinned commit and are cached in scripts/.cache/fonts.
//
// The output matches the glyphs Mapbox's own tool (fontnik) makes: 24 px em,
// a 3 px border, distance radius 8 px, edge at value 191, `top` measured
// from 26 px above the baseline. Distances are computed exactly from the
// glyph outline, not from a rasterised image.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "scripts/.cache/fonts");
const GOOGLE_FONTS = "https://raw.githubusercontent.com/google/fonts/5026800714d07231937d92eb4cceabf06e05d74e";

// Fonts that can be built. License files are copied next to the glyphs.
export const FONTS = {
  "Barlow Semi Condensed Medium": {
    ttf: "ofl/barlowsemicondensed/BarlowSemiCondensed-Medium.ttf",
    license: "ofl/barlowsemicondensed/OFL.txt",
  },
  "Barlow Semi Condensed SemiBold": {
    ttf: "ofl/barlowsemicondensed/BarlowSemiCondensed-SemiBold.ttf",
    license: "ofl/barlowsemicondensed/OFL.txt",
  },
  "Barlow Condensed Medium": {
    ttf: "ofl/barlowcondensed/BarlowCondensed-Medium.ttf",
    license: "ofl/barlowcondensed/OFL.txt",
  },
};

const SIZE = 24; // px per em
const BUFFER = 3; // px of distance field around each glyph
const RADIUS = 8; // px over which the distance fades out
const CUTOFF = 0.25; // share of the range used for the inside
const TOP_OFFSET = 26; // `top` convention of fontnik glyphs

async function fetchCached(rel) {
  const file = path.join(CACHE, rel.replace(/\//g, "_"));
  if (!existsSync(file)) {
    const response = await fetch(`${GOOGLE_FONTS}/${rel}`);
    if (!response.ok) throw new Error(`${rel}: HTTP ${response.status}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  return readFile(file);
}

// --- Outline → line segments (y up, px, baseline at 0) ----------------------

function segmentsOf(glyph) {
  const segs = [];
  const commands = glyph.getPath(0, 0, SIZE).commands; // y down
  let start = null;
  let cur = null;
  const lineTo = (p) => {
    segs.push([cur[0], -cur[1], p[0], -p[1]]);
    cur = p;
  };
  const STEPS = 8; // straight pieces per curve: plenty at 24 px
  for (const c of commands) {
    if (c.type === "M") {
      start = cur = [c.x, c.y];
    } else if (c.type === "L") {
      lineTo([c.x, c.y]);
    } else if (c.type === "Q") {
      const p0 = cur;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t;
        lineTo([u * u * p0[0] + 2 * u * t * c.x1 + t * t * c.x, u * u * p0[1] + 2 * u * t * c.y1 + t * t * c.y]);
      }
    } else if (c.type === "C") {
      const p0 = cur;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t;
        lineTo([
          u * u * u * p0[0] + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * p0[1] + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
    } else if (c.type === "Z") {
      if (cur && start && (cur[0] !== start[0] || cur[1] !== start[1])) lineTo(start);
      cur = start;
    }
  }
  return segs;
}

function distanceToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = x1 + t * dx - px, ey = y1 + t * dy - py;
  return Math.sqrt(ex * ex + ey * ey);
}

// Non-zero winding: TrueType outlines are drawn so that filled areas have a
// winding number other than 0.
function inside(px, py, segs) {
  let winding = 0;
  for (const [x1, y1, x2, y2] of segs) {
    if (y1 <= py) {
      if (y2 > py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0) winding++;
    } else if (y2 <= py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0) winding--;
  }
  return winding !== 0;
}

function renderGlyph(font, codePoint) {
  const glyph = font.charToGlyph(String.fromCodePoint(codePoint));
  if (!glyph || glyph.index === 0) return null; // the font doesn't have it
  const advance = Math.round((glyph.advanceWidth * SIZE) / font.unitsPerEm);
  const segs = segmentsOf(glyph);
  if (!segs.length) return { id: codePoint, width: 0, height: 0, left: 0, top: -TOP_OFFSET, advance, bitmap: null };

  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const [x1, y1, x2, y2] of segs) {
    xMin = Math.min(xMin, x1, x2); xMax = Math.max(xMax, x1, x2);
    yMin = Math.min(yMin, y1, y2); yMax = Math.max(yMax, y1, y2);
  }
  const left = Math.floor(xMin), right = Math.ceil(xMax);
  const bottom = Math.floor(yMin), top = Math.ceil(yMax);
  const width = right - left, height = top - bottom;
  const w = width + 2 * BUFFER, h = height + 2 * BUFFER;
  const bitmap = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const py = top + BUFFER - j - 0.5;
    for (let i = 0; i < w; i++) {
      const px = left - BUFFER + i + 0.5;
      let d = Infinity;
      for (const s of segs) d = Math.min(d, distanceToSegment(px, py, s));
      if (inside(px, py, segs)) d = -d;
      bitmap[j * w + i] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / RADIUS + CUTOFF))));
    }
  }
  return { id: codePoint, width, height, left, top: top - TOP_OFFSET, advance, bitmap };
}

// --- Protocol buffers (glyphs.proto: stacks → glyphs) -----------------------

function varint(n, out) {
  while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); }
  out.push(n);
}
const zigzag = (n) => (n << 1) ^ (n >> 31);
function field(num, type, out) { varint(num * 8 + type, out); }
function bytesField(num, bytes, out) { field(num, 2, out); varint(bytes.length, out); for (const b of bytes) out.push(b); }

function encodeRange(name, range, glyphs) {
  const stack = [];
  bytesField(1, Buffer.from(name), stack);
  bytesField(2, Buffer.from(range), stack);
  for (const g of glyphs) {
    const msg = [];
    field(1, 0, msg); varint(g.id, msg);
    if (g.bitmap) bytesField(2, g.bitmap, msg);
    field(3, 0, msg); varint(g.width, msg);
    field(4, 0, msg); varint(g.height, msg);
    field(5, 0, msg); varint(zigzag(g.left) >>> 0, msg);
    field(6, 0, msg); varint(zigzag(g.top) >>> 0, msg);
    field(7, 0, msg); varint(g.advance, msg);
    bytesField(3, msg, stack);
  }
  const out = [];
  bytesField(1, stack, out);
  return Buffer.from(out);
}

// Builds the given 256-codepoint ranges (e.g. [0, 256]) of one font into
// <outDir>/<name>/. Returns the files written.
export async function buildGlyphs(name, rangeStarts, outDir) {
  const spec = FONTS[name];
  if (!spec) throw new Error(`Unknown font "${name}"`);
  const font = opentype.parse((await fetchCached(spec.ttf)).buffer.slice(0));
  const dir = path.join(outDir, name);
  await mkdir(dir, { recursive: true });
  const files = [];
  for (const start of rangeStarts) {
    const glyphs = [];
    for (let cp = start; cp < start + 256; cp++) {
      const g = renderGlyph(font, cp);
      if (g) glyphs.push(g);
    }
    const range = `${start}-${start + 255}`;
    const file = path.join(dir, `${range}.pbf`);
    await writeFile(file, encodeRange(name, range, glyphs));
    files.push(file);
  }
  await writeFile(path.join(dir, "LICENSE.txt"), await fetchCached(spec.license));
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] ?? path.join(ROOT, "scripts/.cache/glyph-preview");
  const names = process.argv[3] ? [process.argv[3]] : Object.keys(FONTS);
  for (const name of names) {
    const files = await buildGlyphs(name, [0], outDir);
    console.log(`${name}: ${files.map((f) => path.relative(ROOT, f)).join(", ")}`);
  }
}
