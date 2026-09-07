import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PRIVACY_SETTINGS, type CaptureEvent } from "@mirror/contracts";
import { LocalSessionRepository } from "./SessionRepository.js";
import { LocalSettingsRepository } from "./SettingsRepository.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "mirror-storage-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("local repositories", () => {
  it("round-trips privacy settings", async () => {
    const repository = new LocalSettingsRepository(await temporaryDirectory());
    const expected = { ...DEFAULT_PRIVACY_SETTINGS, blockedApplications: ["Passwords"] };

    await repository.savePrivacySettings(expected);

    expect(await repository.getPrivacySettings()).toEqual(expected);
  });

  it("persists session metadata and newline-delimited events", async () => {
    const root = await temporaryDirectory();
    const repository = new LocalSessionRepository(root);
    const sessionId = "06cb3eca-a3b0-4872-a48e-0b62ef520ba2";
    const config = {
      goal: "Persist the session",
      durationMinutes: 25,
      captureScreenshots: false,
      analysisLocale: "en" as const
    };
    const startedAt = "2026-09-06T10:00:00.000Z";
    const event: CaptureEvent = {
      id: "2d568231-211e-4ff0-b9f6-475b219abcf4",
      sessionId,
      type: "application-focus",
      timestamp: startedAt,
      platform: "macos",
      source: "test",
      payload: { applicationName: "Xcode" }
    };

    await repository.begin(sessionId, config, DEFAULT_PRIVACY_SETTINGS, startedAt);
    await repository.append(event);
    await repository.complete({
      sessionId,
      config,
      startedAt,
      endedAt: "2026-09-06T10:25:00.000Z",
      endReason: "timer",
      eventCount: 1
    });

    const directory = join(root, "sessions", sessionId);
    expect(JSON.parse(await readFile(join(directory, "session.json"), "utf8"))).toMatchObject({
      sessionId,
      status: "running",
      createPayload: {
        goal: "Persist the session",
        planned_duration_minutes: 25,
        client_timezone: "UTC",
        analysis_locale: "en"
      }
    });
    expect((await readFile(join(directory, "events.ndjson"), "utf8")).trim()).toBe(
      JSON.stringify(event)
    );
    expect(JSON.parse(await readFile(join(directory, "completed.json"), "utf8"))).toMatchObject({
      sessionId,
      endReason: "timer",
      eventCount: 1
    });
  });
});
