import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../shared/api";
import { loadSessionHistory } from "../../focus-session/model/useSessionHistory";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DailyFocusMetric {
  day: Weekday;
  minutes: number;
  score: number;
}

export interface AnalyticsSnapshot {
  focusScore: number;
  deepWorkMinutes: number;
  sessionsCompleted: number;
  contextSwitches: number;
  weekly: DailyFocusMetric[];
  primaryInsight: string | null;
  nextSessionAdvice: string | null;
}

const EMPTY_ANALYTICS: AnalyticsSnapshot = {
  focusScore: 0,
  deepWorkMinutes: 0,
  sessionsCompleted: 0,
  contextSwitches: 0,
  weekly: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => ({
    day: day as Weekday,
    minutes: 0,
    score: 0
  })),
  primaryInsight: null,
  nextSessionAdvice: null
};

async function loadAnalytics(): Promise<AnalyticsSnapshot> {
  const history = await loadSessionHistory();
  const completed = history.sessions.filter((session) => session.report?.status === "completed");
  const weekly = EMPTY_ANALYTICS.weekly.map((metric) => ({ ...metric }));
  const now = new Date();
  const monday = new Date(now);
  const weekday = (now.getDay() + 6) % 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - weekday);

  for (const session of completed) {
    const started = new Date(session.startedAt);
    const dayIndex = Math.floor((started.getTime() - monday.getTime()) / 86_400_000);
    if (dayIndex >= 0 && dayIndex < 7 && session.report?.status === "completed") {
      weekly[dayIndex]!.minutes += session.report.deep_work_minutes;
      weekly[dayIndex]!.score = session.report.focus_score;
    }
  }

  const reports = completed.flatMap((session) => session.report?.status === "completed" ? [session.report] : []);
  const latest = reports[0];
  return {
    focusScore: reports.length
      ? Math.round(reports.reduce((sum, report) => sum + report.focus_score, 0) / reports.length)
      : 0,
    deepWorkMinutes: reports.reduce((sum, report) => sum + report.deep_work_minutes, 0),
    sessionsCompleted: reports.length,
    contextSwitches: reports.reduce((sum, report) => sum + report.context_switches, 0),
    weekly,
    primaryInsight: latest?.insights[0] ?? latest?.main_bottleneck ?? null,
    nextSessionAdvice: latest?.next_session_advice ?? null
  };
}

export function useAnalytics() {
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setAnalytics(await loadAnalytics());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("Unable to load analytics"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { analytics, isLoading, error, reload };
}
