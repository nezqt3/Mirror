import { z } from "zod";

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
  captureScreenshots: z.boolean().default(false)
});
export type FocusSessionConfig = z.infer<typeof focusSessionConfigSchema>;

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
  eventCount: z.number().int().nonnegative(),
  error: z.string().nullable()
});
export type SessionState = z.infer<typeof sessionStateSchema>;

export const completedSessionSchema = z.object({
  sessionId: z.string().uuid(),
  config: focusSessionConfigSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  eventCount: z.number().int().nonnegative()
});
export type CompletedSession = z.infer<typeof completedSessionSchema>;

export const helperCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("start"), sessionId: z.string().uuid() }),
  z.object({ command: z.literal("stop") }),
  z.object({ command: z.literal("permissions") }),
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
  z.object({ kind: z.literal("error"), code: z.string(), message: z.string() })
]);
export type HelperMessage = z.infer<typeof helperMessageSchema>;

export const IPC_CHANNELS = {
  sessionStart: "session:start",
  sessionStop: "session:stop",
  sessionGetState: "session:get-state",
  sessionStateChanged: "session:state-changed"
} as const;

export interface MirrorDesktopApi {
  startSession(config: FocusSessionConfig): Promise<SessionState>;
  stopSession(): Promise<CompletedSession>;
  getSessionState(): Promise<SessionState>;
  onSessionStateChanged(listener: (state: SessionState) => void): () => void;
}
