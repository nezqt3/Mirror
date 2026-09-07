export interface FocusSessionSummary {
  id: string;
  goal: string;
  startedAt: string;
  durationMinutes: number;
  focusScore: number;
  contextSwitches: number;
  status: "completed" | "interrupted";
}

export const mockFocusSessions: readonly FocusSessionSummary[] = [
  { id: "session-1", goal: "Finish product presentation", startedAt: "2026-09-06T14:00:00+08:00", durationMinutes: 60, focusScore: 86, contextSwitches: 4, status: "completed" },
  { id: "session-2", goal: "Refactor capture pipeline", startedAt: "2026-09-05T10:30:00+08:00", durationMinutes: 90, focusScore: 78, contextSwitches: 9, status: "completed" },
  { id: "session-3", goal: "Research onboarding flow", startedAt: "2026-09-04T16:15:00+08:00", durationMinutes: 45, focusScore: 64, contextSwitches: 13, status: "interrupted" }
];
