import { afterEach, describe, expect, it, vi } from "vitest";
import { MockCaptureAdapter } from "../capture/MockCaptureAdapter.js";
import { MemorySessionRepository } from "../storage/SessionRepository.js";
import { SessionManager } from "./SessionManager.js";

describe("SessionManager", () => {
  const adapter = new MockCaptureAdapter();

  afterEach(async () => {
    await adapter.stop();
    vi.useRealTimers();
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
    expect(completed.endReason).toBe("user");
    expect(manager.getState().status).toBe("idle");
  });

  it("finishes automatically when the countdown reaches zero", async () => {
    vi.useFakeTimers();
    const repository = new MemorySessionRepository();
    const manager = new SessionManager(adapter, repository);
    const running = await manager.start({
      goal: "Work until the timer finishes",
      durationMinutes: 5,
      captureScreenshots: false
    });

    expect(running.plannedEndsAt).not.toBeNull();
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(manager.getState().status).toBe("idle");
    expect(repository.completed?.endReason).toBe("timer");
  });

  it("does not start capture until system permissions are granted", async () => {
    class DeniedCaptureAdapter extends MockCaptureAdapter {
      override async requestPermissions(): Promise<"denied"> {
        return "denied";
      }

      override async start(): Promise<void> {
        throw new Error("Capture must not start");
      }
    }

    const manager = new SessionManager(new DeniedCaptureAdapter());

    await expect(manager.start({
      goal: "Protected session",
      durationMinutes: 25,
      captureScreenshots: false
    })).rejects.toThrow("System Settings");
    expect(manager.getState().status).toBe("idle");
  });
});
