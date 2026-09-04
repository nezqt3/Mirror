import { describe, expect, it } from "vitest";
import { captureEventSchema, characterSessionProgressSchema, focusSessionConfigSchema } from "./index";

describe("shared contracts", () => {
  it("accepts a valid focus-session configuration", () => {
    expect(
      focusSessionConfigSchema.parse({
        goal: "Finish the product pitch deck",
        durationMinutes: 90,
        captureScreenshots: false
      })
    ).toEqual({
      goal: "Finish the product pitch deck",
      durationMinutes: 90,
      captureScreenshots: false
    });
  });

  it("rejects malformed native capture events", () => {
    expect(
      captureEventSchema.safeParse({
        id: "not-a-uuid",
        sessionId: "not-a-uuid",
        type: "keylogging",
        timestamp: "today"
      }).success
    ).toBe(false);
  });

  it("validates a character session progression snapshot", () => {
    const snapshot = {
      level: 7,
      xp: { current: 860, required: 1200 },
      stats: { focus: 74, stamina: 68, execution: 81, discipline: 76 }
    };

    expect(
      characterSessionProgressSchema.safeParse({
        sessionId: "8f7075d4-42c7-4cf7-b208-5236e42f9201",
        completedAt: "2026-09-02T08:00:00.000Z",
        xpGained: 180,
        before: {
          ...snapshot,
          xp: { current: 680, required: 1200 }
        },
        after: snapshot
      }).success
    ).toBe(true);
  });
});
