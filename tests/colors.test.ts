import { test } from "node:test";
import assert from "node:assert/strict";
import { colorDistance, getMatchColors, MIN_COLOR_DISTANCE } from "../src/lib/teamColors.ts";
import { getVisibleMatches } from "./helpers.ts";

// Color-blindness guard: in every match, the two display colors must be
// clearly different for normal vision AND for red-green color blindness
// (protanopia, deuteranopia). colorDistance() already returns the smallest
// distance across the three, see src/lib/teamColors.ts.

type Match = Parameters<typeof getMatchColors>[0];

const team = (primary_color: string, secondary_color: string) => ({ primary_color, secondary_color });

const TRICKY_PAIRS: Array<[string, ReturnType<typeof team>, ReturnType<typeof team>]> = [
  ["red vs green (classic red-green confusion)", team("#DA291C", "#FFFFFF"), team("#1D9053", "#FFFFFF")],
  ["red vs dark green, no helpful second color", team("#C8102E", "#C8102E"), team("#05642C", "#05642C")],
  ["two reds", team("#EF0107", "#FFFFFF"), team("#DA291C", "#000000")],
  ["two blues", team("#004170", "#DA291C"), team("#2FAEE0", "#FFFFFF")],
  ["identical colors on both teams", team("#0057B8", "#0057B8"), team("#0057B8", "#0057B8")],
  ["white vs white", team("#FFFFFF", "#000000"), team("#FFFFFF", "#1D428A")],
  ["black vs black", team("#000000", "#FFFFFF"), team("#000000", "#FFFFFF")],
];

for (const theme of ["dark", "light"] as const) {
  for (const [name, home, away] of TRICKY_PAIRS) {
    test(`${theme} mode: ${name} stay distinguishable`, () => {
      const colors = getMatchColors({ home_team: home, away_team: away } as unknown as Match, theme);
      const distance = colorDistance(colors.home, colors.away);
      assert.ok(
        distance >= MIN_COLOR_DISTANCE,
        `${colors.home} vs ${colors.away}: distance ${distance.toFixed(1)}, need ${MIN_COLOR_DISTANCE}`
      );
    });
  }

  test(`${theme} mode: every match in the database has distinguishable colors`, async () => {
    const matches = await getVisibleMatches();
    assert.ok(matches.length > 0, "expected at least one visible match");
    const problems: string[] = [];
    for (const match of matches) {
      const colors = getMatchColors(match as unknown as Match, theme);
      const distance = colorDistance(colors.home, colors.away);
      if (distance < MIN_COLOR_DISTANCE) {
        problems.push(
          `${match.home_team.name} vs ${match.away_team.name}: ${colors.home} / ${colors.away} (${distance.toFixed(1)})`
        );
      }
    }
    assert.deepEqual(problems, []);
  });
}
