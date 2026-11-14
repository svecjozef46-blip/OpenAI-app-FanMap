import type { Theme } from "@/lib/theme";
import type { MatchWithTeams, Team } from "@/lib/types";

// The colors a match is DISPLAYED in (map, bars, legend), derived from the
// teams' official colors in the database. It solves three problems:
//
// 1. Colors that vanish against the map. Dark mode: navy or black kits on a
//    near-black map. Light mode: white or yellow kits on a near-white map.
//    Each color is nudged (same hue) until its brightness sits in a band
//    that reads well in the current mode.
// 2. Kits that ARE the background color. A black kit in dark mode (Juventus)
//    or a white one in light mode (Real Madrid) uses the team's secondary
//    color instead of becoming an anonymous grey.
// 3. Two teams whose colors look alike (PSG vs Marseille: both blue) — to
//    anyone, or to people with red-green color blindness (about 1 in 12
//    men), for whom e.g. a red and a green kit can be the same color. The
//    away team then uses its other color, and if that doesn't help either,
//    its color is made clearly lighter or darker than the home team's, so
//    the two always differ in brightness, not just in hue.
//
// Color is never the only signal anyway: cards, the header and the map
// tooltip always show the split as text.
//
// Deterministic: the same match always gets the same colors in a given
// mode, and a team's stored colors are never changed.

type Hsl = { h: number; s: number; l: number };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r = l;
  let g = l;
  let b = l;
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Perceived brightness, 0 (black) to 1 (white) — WCAG relative luminance.
// Unlike HSL lightness it knows that yellow is bright and blue is dark.
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Brightness band a display color must sit in, per mode.
const BAND: Record<Theme, { min: number; max: number }> = {
  dark: { min: 0.11, max: 0.72 },
  light: { min: 0, max: 0.34 },
};

// Moves a color's lightness (keeping hue and saturation) until its
// brightness is inside the band for this mode.
function fitToBand(hex: string, theme: Theme): string {
  const { min, max } = BAND[theme];
  const hsl = hexToHsl(hex);
  let out = hex.toLowerCase();
  for (let i = 0; i < 60; i++) {
    const lum = luminance(out);
    if (lum < min) hsl.l = Math.min(hsl.l + 0.015, 1);
    else if (lum > max) hsl.l = Math.max(hsl.l - 0.015, 0);
    else break;
    out = hslToHex(hsl);
  }
  return out;
}

// True when a kit color would be (nearly) the map's own background.
function matchesBackground(hex: string, theme: Theme): boolean {
  const lum = luminance(hex);
  return theme === "dark" ? lum < 0.03 : lum > 0.8;
}

// --- "Do these two colors look alike?" ------------------------------------
// Compared three ways: normal vision, protanopia and deuteranopia (the two
// common red-green deficiencies), using the standard simulation matrices
// from Machado, Oliveira & Fernandes (2009). The distance is CIE76 Delta E
// in Lab space, where ~2 is a just-noticeable difference; map fills need
// far more than that to be told apart at a glance.

type Rgb = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const VISION: Record<string, number[][] | null> = {
  normal: null,
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

function linearRgbToLab([r, g, b]: Rgb): Rgb {
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

// Smallest distance between two colors across the three kinds of vision.
export function colorDistance(a: string, b: string): number {
  const linear = (hex: string) => hexToRgb(hex).map(toLinear) as Rgb;
  const [ra, rb] = [linear(a), linear(b)];
  let smallest = Infinity;
  for (const matrix of Object.values(VISION)) {
    const see = (c: Rgb): Rgb =>
      matrix
        ? (matrix.map((row) => Math.min(Math.max(row[0] * c[0] + row[1] * c[1] + row[2] * c[2], 0), 1)) as Rgb)
        : c;
    const [la, lb] = [linearRgbToLab(see(ra)), linearRgbToLab(see(rb))];
    smallest = Math.min(smallest, Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]));
  }
  return smallest;
}

// Below this distance two map colors are too easy to confuse.
export const MIN_COLOR_DISTANCE = 24;

function tooSimilar(a: string, b: string): boolean {
  return colorDistance(a, b) < MIN_COLOR_DISTANCE;
}

// Last resort when both of the away team's colors look like the home
// color: keep the away hue but move its lightness away from the home color
// until they differ enough — first away from the home color's lightness,
// then the other way — staying within what is visible on the map.
const LIGHTNESS_RANGE: Record<Theme, [number, number]> = { dark: [0.32, 0.9], light: [0.14, 0.68] };

function pushApart(home: string, away: string, theme: Theme): string {
  const [min, max] = LIGHTNESS_RANGE[theme];
  const preferred = hexToHsl(home).l > (min + max) / 2 ? -1 : 1;
  let best = away;
  for (const direction of [preferred, -preferred]) {
    const hsl = hexToHsl(away);
    for (let i = 0; i < 40; i++) {
      hsl.l = Math.min(Math.max(hsl.l + direction * 0.02, min), max);
      const candidate = hslToHex(hsl);
      if (colorDistance(home, candidate) > colorDistance(home, best)) best = candidate;
      if (!tooSimilar(home, best)) return best;
    }
  }
  return best;
}

// A team's two display candidates for this mode: preferred first.
function candidates(team: Team, theme: Theme): [string, string] {
  const primary = fitToBand(team.primary_color, theme);
  const secondary = fitToBand(team.secondary_color, theme);
  return matchesBackground(team.primary_color, theme) && !matchesBackground(team.secondary_color, theme)
    ? [secondary, primary]
    : [primary, secondary];
}

export type MatchColors = { home: string; away: string };

export function getMatchColors(match: MatchWithTeams, theme: Theme): MatchColors {
  const [home] = candidates(match.home_team, theme);
  const [awayFirst, awaySecond] = candidates(match.away_team, theme);
  let away = awayFirst;
  if (tooSimilar(home, awayFirst)) {
    away = tooSimilar(home, awaySecond) ? pushApart(home, awayFirst, theme) : awaySecond;
  }
  return { home, away };
}
