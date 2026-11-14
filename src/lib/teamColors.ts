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
// 3. Two teams with similar colors (PSG vs Marseille: both blue). The away
//    team then uses its other color.
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

// Rough "do these look alike" check: close hue (for saturated colors) and
// similar lightness, or both near-grey.
function tooSimilar(a: string, b: string): boolean {
  const x = hexToHsl(a);
  const y = hexToHsl(b);
  const hueDiff = Math.min(Math.abs(x.h - y.h), 1 - Math.abs(x.h - y.h)) * 360;
  const xGrey = x.s < 0.2;
  const yGrey = y.s < 0.2;
  if (xGrey || yGrey) return xGrey && yGrey && Math.abs(x.l - y.l) < 0.25;
  return hueDiff < 28 && Math.abs(x.l - y.l) < 0.3;
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
  const away = tooSimilar(home, awayFirst) && !tooSimilar(home, awaySecond) ? awaySecond : awayFirst;
  return { home, away };
}
