/**
 * Raw activity contracts contain only facts observed by the OS or client.
 * Derived judgments such as productivity, distraction, relevance, or focus
 * scores belong to a separate analytics/inference layer.
 */

export type RawEventSchemaVersion = 1;

export type RawEventPlatform = "macos" | "windows";

export type RawEventSource =
  | "swift_native"
  | "csharp_native"
  | "electron"
  | "browser_extension";

export type RawEventType =
  | "session_start"
  | "session_end"
  | "app_focus"
  | "window_focus"
  | "browser_navigation"
  | "idle_start"
  | "idle_end"
  | "input_activity"
  | "screenshot"
  | "heartbeat";

export interface BaseRawEvent<
  TType extends RawEventType = RawEventType,
  TData extends object = Record<string, unknown>
> {
  schemaVersion: RawEventSchemaVersion;
  eventId: string;
  sessionId: string;
  userId: string;
  /** Stable identifier of the process/client instance that produced the event. */
  producerId: string;
  /** Monotonically increasing sequence scoped to producerId. */
  producerSequence: number;
  /** ISO 8601 wall-clock timestamp. */
  timestamp: string;
  /**
   * Monotonic clock scoped to producerId. It can be used for durations and
   * ordering from the same producer, but must not be compared across producers.
   */
  monotonicMs: number;
  platform: RawEventPlatform;
  source: RawEventSource;
  type: TType;
  data: TData;
}

export interface AppFocusData {
  processId: number;
  appName: string;
  /** macOS application identifier. */
  bundleId?: string;
  /** Windows executable path. */
  executablePath?: string;
  executableName?: string;
}

export type AppFocusEvent = BaseRawEvent<"app_focus", AppFocusData>;

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowFocusData {
  processId: number;
  windowId?: string;
  title?: string;
  bounds?: WindowBounds;
  isFullscreen?: boolean;
}

export type WindowFocusEvent = BaseRawEvent<"window_focus", WindowFocusData>;

export type BrowserNavigationTransition =
  | "typed"
  | "link"
  | "reload"
  | "redirect"
  | "unknown";

export interface BrowserNavigationData {
  browser: string;
  tabId?: string;
  url?: string;
  domain?: string;
  title?: string;
  incognito?: boolean;
  transition?: BrowserNavigationTransition;
}

export type BrowserNavigationEvent = BaseRawEvent<
  "browser_navigation",
  BrowserNavigationData
>;

export interface IdleStartData {
  idleForMs: number;
}

export type IdleStartEvent = BaseRawEvent<"idle_start", IdleStartData>;

export interface IdleEndData {
  idleDurationMs: number;
}

export type IdleEndEvent = BaseRawEvent<"idle_end", IdleEndData>;

export type IdleEvent = IdleStartEvent | IdleEndEvent;

/** Aggregated input counters only. Never contains pressed keys or entered text. */
export interface UserInputActivityData {
  intervalMs: number;
  keyboardEvents: number;
  mouseClicks: number;
  mouseMoveDistance?: number;
  scrollEvents: number;
}

export type UserInputActivityEvent = BaseRawEvent<
  "input_activity",
  UserInputActivityData
>;

export interface ScreenshotData {
  screenshotId: string;
  displayId?: string;
  width: number;
  height: number;
  activeProcessId?: number;
  activeWindowId?: string;
  /** Reference to separately stored binary data. */
  storageKey?: string;
  sha256?: string;
}

export type ScreenshotEvent = BaseRawEvent<"screenshot", ScreenshotData>;

export type SessionEndReason =
  | "completed"
  | "user_stopped"
  | "app_closed"
  | "crash";

export interface SessionStartData {
  goal?: string;
  plannedDurationSec?: number;
}

export type SessionStartEvent = BaseRawEvent<"session_start", SessionStartData>;

export interface SessionEndData {
  endReason: SessionEndReason;
}

export type SessionEndEvent = BaseRawEvent<"session_end", SessionEndData>;

export type SessionEvent = SessionStartEvent | SessionEndEvent;

export interface HeartbeatData {
  activeProcessId?: number;
  activeWindowId?: string;
  idle: boolean;
}

export type HeartbeatEvent = BaseRawEvent<"heartbeat", HeartbeatData>;

export type RawActivityEvent =
  | AppFocusEvent
  | WindowFocusEvent
  | BrowserNavigationEvent
  | IdleEvent
  | UserInputActivityEvent
  | ScreenshotEvent
  | SessionEvent
  | HeartbeatEvent;

export interface RawEventBatch {
  schemaVersion: RawEventSchemaVersion;
  sessionId: string;
  /** ISO 8601 timestamp generated when the batch is sent. */
  sentAt: string;
  events: readonly RawActivityEvent[];
}
