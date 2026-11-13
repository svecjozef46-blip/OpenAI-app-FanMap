// Data for the landing-page hero map (components/HeroShowcase.tsx).
//
// Real results are used as soon as a featured match has enough decided
// countries to make a good-looking map. Until then (e.g. right after
// launch) the hero shows an ILLUSTRATIVE pattern instead — and the page
// labels it as such, so nobody mistakes it for real data (dev-prompt brief:
// "Distinguish real voting data from placeholder or demonstration data").
//
// The illustration looks random but is deterministic per match (seeded by
// the match id): the same match always shows the same picture, different
// matches show different pictures, and nothing changes between renders.
//
// dev-prompt-chatgpt.md "HOME PAGE": large neighbouring countries get
// different teams (USA/Canada, Brazil/Argentina, China/Russia, India/China)
// so the map reads as a contest, not one blob. Only affects this
// illustration — team colors themselves never change.

export type HeroCountry = { code: string; side: "home" | "away"; strength: number };

// Countries that appear in illustrations, listed roughly west → east so
// the "light up" animation sweeps across the world.
const ILLUSTRATION_COUNTRIES = [
  "US", "CA", "MX", "GT", "CO", "PE", "EC", "VE", "BO", "CL", "BR", "AR", "UY", "PY",
  "IS", "IE", "PT", "MA", "GB", "ES", "SN", "DZ", "FR", "NO", "NG", "GH", "BE", "NL",
  "DE", "IT", "TN", "CH", "DK", "SE", "CZ", "AT", "PL", "HR", "HU", "CM", "AO", "ZA",
  "GR", "FI", "RO", "UA", "EG", "TR", "KE", "TZ", "SA", "RU", "IR", "AE", "KZ", "PK",
  "IN", "MN", "CN", "TH", "VN", "MY", "ID", "PH", "KR", "JP", "AU", "NZ",
];

// Big neighbours that must never share a team on the illustration. When a
// pair clashes, the SECOND country is flipped — so China is only ever the
// first of a pair, and fixing China/India can't undo China/Russia.
const MUST_DIFFER: Array<[string, string]> = [
  ["US", "CA"],
  ["BR", "AR"],
  ["CN", "RU"],
  ["CN", "IN"],
];

// Small deterministic pseudo-random generator (mulberry32) seeded from a
// string, so illustrations are stable per match.
function seededRandom(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function illustrativeHeroCountries(matchId: string): HeroCountry[] {
  const random = seededRandom(matchId);
  const sides = new Map<string, "home" | "away">();
  for (const code of ILLUSTRATION_COUNTRIES) {
    sides.set(code, random() < 0.5 ? "home" : "away");
  }
  for (const [a, b] of MUST_DIFFER) {
    if (sides.get(a) === sides.get(b)) {
      sides.set(b, sides.get(a) === "home" ? "away" : "home");
    }
  }
  return ILLUSTRATION_COUNTRIES.map((code) => ({
    code,
    side: sides.get(code)!,
    strength: 0.55 + random() * 0.4,
  }));
}

// Below this many decided countries the real map looks empty on a
// full-screen hero, so the illustration is shown instead.
export const MIN_REAL_COUNTRIES_FOR_HERO = 12;
