import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../shared/api";
import {
  sessionApi,
  type CompletedReport,
  type SessionReportResponse,
  type SessionResponse
} from "../api/sessionApi";

export interface FocusSessionSummary {
  id: string;
  goal: string;
  startedAt: string;
  durationMinutes: number;
  focusScore: number | null;
  contextSwitches: number | null;
  status: SessionResponse["status"];
  report: SessionReportResponse | null;
}

export interface SessionHistorySnapshot {
  sessions: FocusSessionSummary[];
  reports: CompletedReport[];
}

function durationMinutes(session: SessionResponse): number {
  if (!session.ended_at) return session.planned_duration_minutes;
  return Math.max(
    0,
    Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60_000)
  );
}

export async function loadSessionHistory(): Promise<SessionHistorySnapshot> {
  const sessions = await sessionApi.list(100);
  const reports = await Promise.all(
    sessions.map(async (session) => {
      if (session.status === "active") return null;
      try {
        return await sessionApi.report(session.id);
      } catch {
        return null;
      }
    })
  );

  const summaries = sessions.map((session, index): FocusSessionSummary => {
    const report = reports[index] ?? null;
    return {
      id: session.id,
      goal: session.goal,
      startedAt: session.started_at,
      durationMinutes: durationMinutes(session),
      focusScore: report?.status === "completed" ? report.focus_score : null,
      contextSwitches: report?.status === "completed" ? report.context_switches : null,
      status: session.status,
      report
    };
  });

  return {
    sessions: summaries,
    reports: reports.filter((report): report is CompletedReport => report?.status === "completed")
  };
}

export function useSessionHistory() {
  const [snapshot, setSnapshot] = useState<SessionHistorySnapshot>({ sessions: [], reports: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSnapshot(await loadSessionHistory());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError("Unable to load sessions"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retryAnalysis = useCallback(async (sessionId: string) => {
    await sessionApi.retryAnalysis(sessionId);
    await load();
  }, [load]);

  return { ...snapshot, isLoading, error, reload: load, retryAnalysis };
}
