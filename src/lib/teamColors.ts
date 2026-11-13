import type { MatchWithTeams, Team } from "@/lib/types";

// The colors a match is DISPLAYED in (map, bar, legend, header), derived
// from the teams' official colors in the database. Two problems this solves:
//
// 1. Dark team colors (e.g. PSG navy #004170) are nearly invisible on the
//    dark map. They're lifted to a minimum lightness, keeping their hue —
//    still recognisably "the team's color", just readable.
// 2. Two teams with similar colors (PSG vs Marseille: both blue) would be
//    indistinguishable. Then the away team uses its secondary color instead.
//
// Deterministic: the same match always gets the same colors, and a team's
// stored colors are never changed.

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
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

const MIN_LIGHTNESS = 0.5;
// Pure white fills look harsh on the dark map; cap at a soft light grey.
const MAX_LIGHTNESS = 0.84;

// Keep colors in a range that reads well on the dark map: lift too-dark
// ones, soften too-bright ones (white kits).
function visible(hex: string): string {
  const hsl = hexToHsl(hex);
  if (hsl.l < MIN_LIGHTNESS) return hslToHex({ ...hsl, l: MIN_LIGHTNESS });
  if (hsl.l > MAX_LIGHTNESS) return hslToHex({ ...hsl, l: MAX_LIGHTNESS });
  return hex.toLowerCase();
}

// Rough "do these look alike" check: close hue (for saturated colors) and
// similar lightness, or both near-grey.
function tooSimilar(a: string, b: string): boolean {
  const x = hexToHsl(a);
  const y = hexToHsl(b);
  const hueDiff = Math.min(Math.abs(x.h - y.h), 1 - Math.abs(x.h - y.h)) * 360;
  const bothGreyish = x.s < 0.2 && y.s < 0.2;
  if (bothGreyish) return Math.abs(x.l - y.l) < 0.25;
  return hueDiff < 28 && Math.abs(x.l - y.l) < 0.3;
}

export type MatchColors = { home: string; away: string };

export function teamDisplayColor(team: Team): string {
  return visible(team.primary_color);
}

export function getMatchColors(match: MatchWithTeams): MatchColors {
  const home = visible(match.home_team.primary_color);
  let away = visible(match.away_team.primary_color);
  if (tooSimilar(home, away)) {
    const alternative = visible(match.away_team.secondary_color);
    if (!tooSimilar(home, alternative)) away = alternative;
  }
  return { home, away };
}
