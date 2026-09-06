export interface DailyFocusMetric {
  day: string;
  minutes: number;
  score: number;
}

export interface AnalyticsSnapshot {
  focusScore: number;
  deepWorkMinutes: number;
  sessionsCompleted: number;
  contextSwitches: number;
  weekly: readonly DailyFocusMetric[];
}

export const mockAnalytics: AnalyticsSnapshot = {
  focusScore: 82,
  deepWorkMinutes: 286,
  sessionsCompleted: 7,
  contextSwitches: 31,
  weekly: [
    { day: "mon", minutes: 35, score: 71 },
    { day: "tue", minutes: 62, score: 78 },
    { day: "wed", minutes: 48, score: 74 },
    { day: "thu", minutes: 90, score: 88 },
    { day: "fri", minutes: 72, score: 84 },
    { day: "sat", minutes: 24, score: 69 },
    { day: "sun", minutes: 55, score: 82 }
  ]
};
