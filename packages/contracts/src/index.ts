import { z } from "zod";

export * from "./raw-activity.js";

export const platformSchema = z.enum(["macos", "windows", "linux", "mock"]);
export type Platform = z.infer<typeof platformSchema>;

export const permissionStatusSchema = z.enum([
  "unknown",
  "not-determined",
  "granted",
  "denied",
  "restricted"
]);
export type PermissionStatus = z.infer<typeof permissionStatusSchema>;

export const focusSessionConfigSchema = z.object({
  goal: z.string().trim().min(3).max(500),
  durationMinutes: z.number().int().min(5).max(480),
  captureScreenshots: z.boolean().default(false),
  clientTimezone: z.string().trim().min(1).max(100).optional(),
  analysisLocale: z.enum(["en", "zh-CN", "ru"]).default("en")
});
export type FocusSessionConfig = z.infer<typeof focusSessionConfigSchema>;
export type FocusSessionConfigInput = z.input<typeof focusSessionConfigSchema>;

export const installedApplicationSchema = z.object({
  name: z.string().trim().min(1),
  bundleIdentifier: z.string().trim().min(1).nullable()
});
export type InstalledApplication = z.infer<typeof installedApplicationSchema>;

export const sessionCreatePayloadSchema = z.object({
  goal: z.string().trim().min(3).max(500),
  planned_duration_minutes: z.number().int().min(5).max(480),
  client_timezone: z.string().trim().min(1).max(100),
  analysis_locale: z.enum(["en", "zh-CN", "ru"]).default("en")
});
export type SessionCreatePayload = z.infer<typeof sessionCreatePayloadSchema>;

export function toSessionCreatePayload(config: FocusSessionConfig): SessionCreatePayload {
  return sessionCreatePayloadSchema.parse({
    goal: config.goal,
    planned_duration_minutes: config.durationMinutes,
    client_timezone: config.clientTimezone ?? "UTC",
    analysis_locale: config.analysisLocale ?? "en"
  });
}

export const privacySettingsSchema = z.object({
  blockedApplications: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  blockedWindowTitleKeywords: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
  blockedDomains: z.array(z.string().trim().min(1).max(253)).max(100).default([]),
  captureWindowTitles: z.boolean().default(true)
});
export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  blockedApplications: [],
  blockedWindowTitleKeywords: [],
  blockedDomains: [],
  captureWindowTitles: true
};

export const captureEventTypeSchema = z.enum([
  "application-focus",
  "window-focus",
  "browser-navigation",
  "user-active",
  "user-idle",
  "screenshot",
  "heartbeat"
]);
export type CaptureEventType = z.infer<typeof captureEventTypeSchema>;

export const captureEventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: captureEventTypeSchema,
  timestamp: z.string().datetime(),
  platform: platformSchema,
  source: z.string().min(1),
  payload: z.record(z.unknown())
});
export type CaptureEvent = z.infer<typeof captureEventSchema>;

export const sessionStateSchema = z.object({
  status: z.enum(["idle", "starting", "running", "stopping", "failed"]),
  sessionId: z.string().uuid().nullable(),
  config: focusSessionConfigSchema.nullable(),
  startedAt: z.string().datetime().nullable(),
  plannedEndsAt: z.string().datetime().nullable(),
  eventCount: z.number().int().nonnegative(),
  error: z.string().nullable()
});
export type SessionState = z.infer<typeof sessionStateSchema>;

export const completedSessionSchema = z.object({
  sessionId: z.string().uuid(),
  config: focusSessionConfigSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  endReason: z.enum(["timer", "user"]),
  eventCount: z.number().int().nonnegative()
});
export type CompletedSession = z.infer<typeof completedSessionSchema>;

export const characterStatsSchema = z.object({
  focus: z.number().int().min(0).max(100),
  stamina: z.number().int().min(0).max(100),
  execution: z.number().int().min(0).max(100),
  discipline: z.number().int().min(0).max(100)
});
export type CharacterStats = z.infer<typeof characterStatsSchema>;

export const characterSnapshotSchema = z.object({
  level: z.number().int().positive(),
  xp: z.object({
    current: z.number().int().nonnegative(),
    required: z.number().int().positive()
  }),
  stats: characterStatsSchema
});
export type CharacterSnapshot = z.infer<typeof characterSnapshotSchema>;

export const mirrorCharacterSchema = characterSnapshotSchema.extend({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  archetype: z.literal("base")
});
export type MirrorCharacter = z.infer<typeof mirrorCharacterSchema>;

export const characterSessionProgressSchema = z.object({
  sessionId: z.string().uuid(),
  completedAt: z.string().datetime(),
  xpGained: z.number().int().nonnegative(),
  before: characterSnapshotSchema,
  after: characterSnapshotSchema
});
export type CharacterSessionProgress = z.infer<typeof characterSessionProgressSchema>;

export const helperCommandSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("start"),
    sessionId: z.string().uuid(),
    privacy: privacySettingsSchema
  }),
  z.object({ command: z.literal("stop") }),
  z.object({
    command: z.literal("permissions"),
    requiresScreenCapture: z.boolean().default(false)
  }),
  z.object({ command: z.literal("applications") }),
  z.object({ command: z.literal("ping") })
]);
export type HelperCommand = z.infer<typeof helperCommandSchema>;

export const helperMessageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), event: captureEventSchema }),
  z.object({
    kind: z.literal("status"),
    status: z.enum(["ready", "started", "stopped", "pong"]),
    permissions: permissionStatusSchema.optional()
  }),
  z.object({ kind: z.literal("error"), code: z.string(), message: z.string() }),
  z.object({
    kind: z.literal("applications"),
    applications: z.array(installedApplicationSchema)
  })
]);
export type HelperMessage = z.infer<typeof helperMessageSchema>;

export const IPC_CHANNELS = {
  sessionStart: "session:start",
  sessionStop: "session:stop",
  sessionGetState: "session:get-state",
  sessionStateChanged: "session:state-changed",
  sessionEvent: "session:event",
  privacyGetSettings: "privacy:get-settings",
  privacySaveSettings: "privacy:save-settings",
  applicationsList: "applications:list"
} as const;

export interface MirrorDesktopApi {
  startSession(config: FocusSessionConfigInput, sessionId?: string): Promise<SessionState>;
  stopSession(): Promise<CompletedSession>;
  getSessionState(): Promise<SessionState>;
  onSessionStateChanged(listener: (state: SessionState) => void): () => void;
  onSessionEvent(listener: (event: CaptureEvent) => void): () => void;
  getPrivacySettings(): Promise<PrivacySettings>;
  savePrivacySettings(settings: PrivacySettings): Promise<PrivacySettings>;
  listApplications(): Promise<InstalledApplication[]>;
}
