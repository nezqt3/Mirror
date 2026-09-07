import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SessionState } from "@mirror/contracts";
import { toAnalysisLocale, useLanguage } from "../../../shared/i18n";

const DURATION_STORAGE_KEY = "mirror.default-duration";
const DURATIONS = [25, 45, 60, 90, 120] as const;

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
  return DURATIONS.includes(value as (typeof DURATIONS)[number]) ? value : 90;
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

export function useFocusSession(): FocusSessionController {
  const { t } = useTranslation("focus");
  const { language } = useLanguage();
  const [goal, setGoal] = useState(() => t("session.defaultGoal"));
  const [durationMinutes, setDurationMinutes] = useState(readStoredDuration);
  const [session, setSession] = useState<SessionState>(idleState);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const api = window.mirror;
    if (!api) {
      setError(t("errors.bridgeUnavailable"));
      return undefined;
    }
    void api.getSessionState().then(setSession).catch(() => setError(t("errors.readSession")));
    return api.onSessionStateChanged(setSession);
  }, [t]);

  useEffect(() => {
    window.localStorage.setItem(DURATION_STORAGE_KEY, String(durationMinutes));
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
        await api.stopSession();
      } else {
        await api.startSession({
          goal,
          durationMinutes,
          captureScreenshots: false,
          clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          analysisLocale: toAnalysisLocale(language)
        });
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
