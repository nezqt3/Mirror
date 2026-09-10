import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  focusSessionConfigSchema,
  toSessionCreatePayload,
  type CaptureEvent,
  type RawActivityEvent,
  type RawEventBatch,
  type SessionState
} from "@mirror/contracts";
import { toAnalysisLocale, useLanguage } from "../../../shared/i18n";
import { sessionApi } from "../api/sessionApi";

const DURATION_STORAGE_KEY = "mirror.default-duration";
const DURATIONS = [25, 45, 60, 90, 120] as const;
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 480;

const idleState: SessionState = {
  status: "idle",
  sessionId: null,
  config: null,
  startedAt: null,
  plannedEndsAt: null,
  eventCount: 0,
  error: null
};

function readStoredDuration(): number {
  const value = Number(window.localStorage.getItem(DURATION_STORAGE_KEY));
  return Number.isInteger(value) && value >= MIN_DURATION_MINUTES && value <= MAX_DURATION_MINUTES
    ? value
    : 90;
}

export interface FocusSessionController {
  session: SessionState;
  goal: string;
  durationMinutes: number;
  remainingSeconds: number;
  remainingLabel: string;
  progress: number;
  isActive: boolean;
  error: string | null;
  durations: readonly number[];
  setGoal: (goal: string) => void;
  setDurationMinutes: (minutes: number) => void;
  toggle: () => Promise<void>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function toRawEvent(
  event: CaptureEvent,
  userId: string,
  producerId: string,
  producerSequence: number
): RawActivityEvent | null {
  if (event.platform !== "macos" && event.platform !== "windows") return null;
  const payload = event.payload;
  const base = {
    schemaVersion: 1 as const,
    eventId: event.id,
    sessionId: event.sessionId,
    userId,
    producerId,
    producerSequence,
    timestamp: event.timestamp,
    monotonicMs: Math.max(0, Math.round(performance.now())),
    platform: event.platform,
    source: event.platform === "macos" ? "swift_native" as const : "csharp_native" as const
  };

  if (event.type === "application-focus") {
    const bundleId = optionalString(payload.bundleIdentifier) ?? optionalString(payload.bundleId);
    const executablePath = optionalString(payload.executablePath);
    const executableName = optionalString(payload.executableName);
    return {
      ...base,
      type: "app_focus",
      data: {
        processId: numberOrZero(payload.processId),
        appName: optionalString(payload.applicationName) ?? optionalString(payload.appName) ?? event.source,
        ...(bundleId ? { bundleId } : {}),
        ...(executablePath ? { executablePath } : {}),
        ...(executableName ? { executableName } : {})
      }
    };
  }
  if (event.type === "window-focus") {
    const windowId = optionalString(payload.windowId);
    const title = optionalString(payload.windowTitle) ?? optionalString(payload.title);
    return {
      ...base,
      type: "window_focus",
      data: {
        processId: numberOrZero(payload.processId),
        ...(windowId ? { windowId } : {}),
        ...(title ? { title } : {}),
        ...(typeof payload.isFullscreen === "boolean" ? { isFullscreen: payload.isFullscreen } : {})
      }
    };
  }
  if (event.type === "browser-navigation") {
    const tabId = optionalString(payload.tabId);
    const url = optionalString(payload.url);
    const domain = optionalString(payload.domain);
    const title = optionalString(payload.title);
    return {
      ...base,
      type: "browser_navigation",
      data: {
        browser: optionalString(payload.browser) ?? event.source,
        ...(tabId ? { tabId } : {}),
        ...(url ? { url } : {}),
        ...(domain ? { domain } : {}),
        ...(title ? { title } : {}),
        incognito: false
      }
    };
  }
  if (event.type === "user-idle") {
    return { ...base, type: "idle_start", data: { idleForMs: numberOrZero(payload.idleForMs) } };
  }
  if (event.type === "user-active") {
    return { ...base, type: "idle_end", data: { idleDurationMs: numberOrZero(payload.idleDurationMs) } };
  }
  if (event.type === "heartbeat") {
    const activeWindowId = optionalString(payload.activeWindowId);
    return {
      ...base,
      type: "heartbeat",
      data: {
        idle: payload.idle === true,
        ...(typeof payload.activeProcessId === "number"
          ? { activeProcessId: numberOrZero(payload.activeProcessId) }
          : {}),
        ...(activeWindowId ? { activeWindowId } : {})
      }
    };
  }
  if (event.type === "screenshot") {
    const screenshotId = optionalString(payload.screenshotId);
    const width = numberOrZero(payload.width);
    const height = numberOrZero(payload.height);
    if (!screenshotId || width === 0 || height === 0) return null;
    const displayId = optionalString(payload.displayId);
    const activeWindowId = optionalString(payload.activeWindowId);
    const storageKey = optionalString(payload.storageKey);
    const sha256 = optionalString(payload.sha256);
    return {
      ...base,
      type: "screenshot",
      data: {
        screenshotId,
        width,
        height,
        ...(displayId ? { displayId } : {}),
        ...(typeof payload.activeProcessId === "number"
          ? { activeProcessId: numberOrZero(payload.activeProcessId) }
          : {}),
        ...(activeWindowId ? { activeWindowId } : {}),
        ...(storageKey ? { storageKey } : {}),
        ...(sha256 ? { sha256 } : {})
      }
    };
  }
  return null;
}

export function useFocusSession(userId: string): FocusSessionController {
  const { t } = useTranslation("focus");
  const { language } = useLanguage();
  const [goal, setGoal] = useState(() => t("session.defaultGoal"));
  const [durationMinutes, setDurationMinutes] = useState(readStoredDuration);
  const [session, setSession] = useState<SessionState>(idleState);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const eventQueue = useRef<RawActivityEvent[]>([]);
  const producerId = useRef(crypto.randomUUID());
  const producerSequence = useRef(0);
  const uploadPromise = useRef<Promise<void> | null>(null);
  const finalizingSessions = useRef(new Set<string>());

  const flushEvents = useCallback(async (): Promise<void> => {
    if (uploadPromise.current) {
      await uploadPromise.current;
      return flushEvents();
    }
    const events = eventQueue.current.splice(0, 1000);
    if (!events.length) return;
    const batch: RawEventBatch = {
      schemaVersion: 1,
      sessionId: events[0]!.sessionId,
      sentAt: new Date().toISOString(),
      events
    };
    uploadPromise.current = sessionApi.sendEvents(batch.sessionId, batch)
      .then(() => undefined)
      .catch((caught) => {
        eventQueue.current.unshift(...events);
        throw caught;
      })
      .finally(() => {
        uploadPromise.current = null;
      });
    await uploadPromise.current;
    if (eventQueue.current.length) return flushEvents();
  }, []);

  const finishRemoteSession = useCallback(async (sessionId: string, endedAt: string) => {
    if (finalizingSessions.current.has(sessionId)) return;
    finalizingSessions.current.add(sessionId);
    let uploadError: unknown;
    try {
      await flushEvents();
    } catch (caught) {
      uploadError = caught;
    }
    try {
      await sessionApi.finish(sessionId, endedAt);
    } catch (caught) {
      finalizingSessions.current.delete(sessionId);
      throw caught;
    }
    eventQueue.current = eventQueue.current.filter((event) => event.sessionId !== sessionId);
    if (uploadError) throw uploadError;
  }, [flushEvents]);

  useEffect(() => {
    const api = window.mirror;
    if (!api) {
      setError(t("errors.bridgeUnavailable"));
      return undefined;
    }
    void api.getSessionState().then(setSession).catch(() => setError(t("errors.readSession")));
    const removeStateListener = api.onSessionStateChanged((next) => {
      setSession((previous) => {
        if (next.status === "idle" && previous.sessionId && ["running", "stopping"].includes(previous.status)) {
          void finishRemoteSession(previous.sessionId, new Date().toISOString())
            .catch((caught) => setError(caught instanceof Error ? caught.message : t("errors.syncSession")));
        }
        return next;
      });
    });
    const removeEventListener = api.onSessionEvent((event) => {
      const raw = toRawEvent(event, userId, producerId.current, producerSequence.current++);
      if (!raw) return;
      eventQueue.current.push(raw);
      if (eventQueue.current.length >= 25) {
        void flushEvents().catch(() => {
          // Keep the batch queued and retry it when the session stops.
        });
      }
    });
    return () => {
      removeStateListener();
      removeEventListener();
    };
  }, [finishRemoteSession, flushEvents, t, userId]);

  useEffect(() => {
    if (
      Number.isInteger(durationMinutes)
      && durationMinutes >= MIN_DURATION_MINUTES
      && durationMinutes <= MAX_DURATION_MINUTES
    ) {
      window.localStorage.setItem(DURATION_STORAGE_KEY, String(durationMinutes));
    }
  }, [durationMinutes]);

  useEffect(() => {
    if (session.status !== "running" || !session.plannedEndsAt) return undefined;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [session.status, session.plannedEndsAt]);

  const isActive = ["starting", "running", "stopping"].includes(session.status);
  const remainingSeconds = session.plannedEndsAt
    ? Math.max(0, Math.ceil((new Date(session.plannedEndsAt).getTime() - now) / 1_000))
    : durationMinutes * 60;
  const totalSeconds = (session.config?.durationMinutes ?? durationMinutes) * 60;
  const progress = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
  const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(
    remainingSeconds % 60
  ).padStart(2, "0")}`;

  const toggle = async (): Promise<void> => {
    setError(null);
    try {
      const api = window.mirror;
      if (!api) throw new Error(t("errors.bridgeUnavailable"));
      if (session.status === "running") {
        const completed = await api.stopSession();
        await finishRemoteSession(completed.sessionId, completed.endedAt);
      } else {
        const config = focusSessionConfigSchema.parse({
          goal,
          durationMinutes,
          captureScreenshots: false,
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          analysisLocale: toAnalysisLocale(language)
        });
        const rawPayload = toSessionCreatePayload(config);
        const createPayload = {
          ...rawPayload,
          analysis_locale: rawPayload.analysis_locale === "zh-CN" ? "zh-CN" as const : "en" as const
        };
        const remoteSession = await sessionApi.create(createPayload);
        try {
          await api.startSession(config, remoteSession.id);
        } catch (caught) {
          await sessionApi.finish(remoteSession.id, new Date().toISOString()).catch(() => undefined);
          throw caught;
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t("errors.updateSession");
      setError(message.includes("System Settings") ? t("errors.permissions") : message);
    }
  };

  return {
    session,
    goal,
    durationMinutes,
    remainingSeconds,
    remainingLabel,
    progress,
    isActive,
    error,
    durations: DURATIONS,
    setGoal,
    setDurationMinutes,
    toggle
  };
}
