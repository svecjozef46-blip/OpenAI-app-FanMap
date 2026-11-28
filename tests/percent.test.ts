import { test } from "node:test";
import assert from "node:assert/strict";
import { percentDecimals, splitPercent } from "../src/lib/percent.ts";

// The percent split shown next to every match. Whole percents for small
// totals; more decimals as the total grows so a close race stays visible.
// See src/lib/format.ts.

test("no votes: neutral 50/50 placeholder", () => {
  const r = splitPercent(0, 0);
  assert.equal(r.isEmpty, true);
  assert.equal(r.homeText, "50");
  assert.equal(r.awayText, "50");
});

test("below 10,000 votes the percentages are whole numbers", () => {
  assert.equal(percentDecimals(9_999), 0);
  const r = splitPercent(5_030, 4_969);
  assert.equal(r.homeText, "50");
  assert.equal(r.awayText, "50");
});

test("from 10,000 votes one decimal, from 10,000,000 two decimals", () => {
  assert.equal(percentDecimals(10_000), 1);
  assert.equal(percentDecimals(9_999_999), 1);
  assert.equal(percentDecimals(10_000_000), 2);
  assert.equal(splitPercent(5_030, 4_970).homeText, "50.3");
  assert.equal(splitPercent(5_030, 4_970).awayText, "49.7");
  assert.equal(splitPercent(5_030_000, 4_970_000).homeText, "50.30"); // exactly 10,000,000 votes: two decimals
  assert.equal(splitPercent(5_031_234, 4_968_766).homeText, "50.31");
  assert.equal(splitPercent(5_031_234, 4_968_766).awayText, "49.69");
});

test("both sides always add up to exactly 100", () => {
  for (const [h, a] of [
    [1, 2],
    [12_345, 67_891],
    [1_234_567, 7_654_321],
    [33_333_333, 66_666_667],
    [99_999_999, 1],
    [1, 99_999_999],
    [0, 20_000],
  ]) {
    const r = splitPercent(h, a);
    assert.equal(Math.round((r.homePct + r.awayPct) * 100) / 100, 100, `${h} vs ${a}`);
  }
});

test("no floating-point noise in the text", () => {
  for (const [h, a] of [
    [5_030, 4_970],
    [123_457, 876_543],
    [7_000_001, 2_999_999],
  ]) {
    const r = splitPercent(h, a);
    assert.match(r.homeText, /^\d{1,3}(\.\d{1,2})?$/);
    assert.match(r.awayText, /^\d{1,3}(\.\d{1,2})?$/);
  }
});

test("a huge lead still shows both sides without rounding to 100/0 too early", () => {
  const r = splitPercent(99_999_999, 1);
  assert.equal(r.homeText, "100.00");
  assert.equal(r.awayText, "0.00");
  // 1 vote in 20,000 is 0.005%: one decimal shows 0.0, not a made-up 0.1.
  assert.equal(splitPercent(19_999, 1).awayText, "0.0");
});
