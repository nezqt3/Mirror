import { describe, expect, it } from "vitest";
import { captureEventSchema, focusSessionConfigSchema } from "./index";

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
});
