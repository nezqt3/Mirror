import { describe, expect, it } from "vitest";
import { characterSessionProgress } from "./mockCharacter.js";
import { didLevelUp, getStatDelta, getXpProgress } from "./characterProgress.js";

describe("mirror character progression", () => {
  it("calculates bounded XP progress", () => {
    expect(getXpProgress(characterSessionProgress.after)).toBeCloseTo(71.67, 1);
    expect(
      getXpProgress({ ...characterSessionProgress.after, xp: { current: 1400, required: 1200 } })
    ).toBe(100);
  });

  it("compares session stats", () => {
    expect(getStatDelta(characterSessionProgress, "execution")).toBe(2);
    expect(getStatDelta(characterSessionProgress, "stamina")).toBe(0);
    expect(didLevelUp(characterSessionProgress)).toBe(false);
  });
});
