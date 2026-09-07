export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout"
  },
  users: {
    register: "/users",
    me: "/users/me"
  },
  character: {
    root: "/character"
  },
  sessions: {
    root: "/sessions",
    current: "/sessions/current",
    byId: (sessionId: string) => `/sessions/${sessionId}`,
    finish: (sessionId: string) => `/sessions/${sessionId}/finish`,
    retryAnalysis: (sessionId: string) => `/sessions/${sessionId}/analysis/retry`,
    eventsBatch: (sessionId: string) => `/sessions/${sessionId}/events/batch`,
    report: (sessionId: string) => `/sessions/${sessionId}/report`
  }
} as const;
