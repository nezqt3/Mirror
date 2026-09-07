import { describe, expect, it } from "vitest";
import type { CaptureEvent, PrivacySettings } from "@mirror/contracts";
import { applyCapturePolicy } from "./CapturePolicy.js";

const settings: PrivacySettings = {
  blockedApplications: ["com.example.secrets"],
  blockedWindowTitleKeywords: ["banking"],
  blockedDomains: ["private.example"],
  captureWindowTitles: true
};

const event = (payload: Record<string, unknown>): CaptureEvent => ({
  id: "2d568231-211e-4ff0-b9f6-475b219abcf4",
  sessionId: "06cb3eca-a3b0-4872-a48e-0b62ef520ba2",
  type: "application-focus",
  timestamp: "2026-09-06T10:00:00.000Z",
  platform: "macos",
  source: "test",
  payload
});

describe("applyCapturePolicy", () => {
  it("drops blocked apps, sensitive windows, and domain subtrees", () => {
    expect(applyCapturePolicy(event({ bundleIdentifier: "com.example.secrets" }), settings)).toBeNull();
    expect(applyCapturePolicy(event({ windowTitle: "Personal Banking" }), settings)).toBeNull();
    expect(applyCapturePolicy(event({ domain: "mail.private.example" }), settings)).toBeNull();
  });

  it("removes window titles when title capture is disabled", () => {
    const result = applyCapturePolicy(event({ applicationName: "Notes", windowTitle: "Draft" }), {
      ...settings,
      blockedWindowTitleKeywords: [],
      captureWindowTitles: false
    });

    expect(result?.payload).toEqual({ applicationName: "Notes" });
  });
});
