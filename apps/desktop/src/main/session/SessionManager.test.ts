import { afterEach, describe, expect, it } from "vitest";
import { MockCaptureAdapter } from "../capture/MockCaptureAdapter.js";
import { SessionManager } from "./SessionManager.js";

describe("SessionManager", () => {
  const adapter = new MockCaptureAdapter();

  afterEach(async () => {
    await adapter.stop();
  });

  it("starts, captures an event, and completes a session", async () => {
    const manager = new SessionManager(adapter);
    const running = await manager.start({
      goal: "Prepare the product demo",
      durationMinutes: 30,
      captureScreenshots: false
    });

    expect(running.status).toBe("running");
    expect(running.eventCount).toBe(1);

    const completed = await manager.stop();
    expect(completed.eventCount).toBe(1);
    expect(manager.getState().status).toBe("idle");
  });
});
