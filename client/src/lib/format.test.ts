import { describe, expect, it } from "vitest";
import { formatDuration, totalMinutes } from "./format";

describe("formatDuration", () => {
  // Regression: Math.round(mins / 60) rendered every sub-30-minute course as "0h".
  it.each([
    [0, "0m"],
    [1, "1m"],
    [25, "25m"],
    [59, "59m"],
    [60, "1h"],
    [90, "1h 30m"],
    [120, "2h"],
    [125, "2h 5m"],
    [599, "9h 59m"],
  ])("formats %i minutes as %s", (mins, expected) => {
    expect(formatDuration(mins)).toBe(expected);
  });

  it("never renders a zero-hour label", () => {
    for (let m = 1; m < 60; m++) expect(formatDuration(m)).not.toBe("0h");
  });

  it("handles junk input without throwing", () => {
    expect(formatDuration(-5)).toBe("0m");
    expect(formatDuration(NaN)).toBe("0m");
    expect(formatDuration(Infinity)).toBe("0m");
  });
});

describe("totalMinutes", () => {
  it("sums lesson durations", () => {
    expect(totalMinutes([{ durationMin: 10 }, { durationMin: 20 }, { durationMin: 5 }])).toBe(35);
  });

  it("is 0 for an empty course", () => {
    expect(totalMinutes([])).toBe(0);
  });

  it("tolerates missing durations", () => {
    expect(totalMinutes([{ durationMin: 10 }, { durationMin: undefined as never }])).toBe(10);
  });
});
