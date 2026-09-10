import type { RawEventBatch } from "@mirror/contracts";
import { API_ENDPOINTS, apiClient } from "../../../shared/api";

export type BackendSessionStatus = "active" | "processing" | "completed" | "failed";

export interface SessionResponse {
  id: string;
  goal: string;
  planned_duration_minutes: number;
  analysis_locale: "en" | "zh-CN";
  status: BackendSessionStatus;
  client_timezone: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface CreateSessionPayload {
  goal: string;
  planned_duration_minutes: number;
  client_timezone: string;
  analysis_locale: "en" | "zh-CN";
}

export interface CompletedReport {
  session_id: string;
  status: "completed";
  goal_completion: number | null;
  focus_score: number;
  deep_work_minutes: number;
  context_switches: number;
  main_bottleneck: string | null;
  distractions: string[];
  insights: string[];
  next_session_advice: string | null;
  rewards: {
    xp: number;
    focus: number;
    stamina: number;
    execution: number;
    discipline: number;
  };
  created_at: string;
}

export interface PendingReport {
  session_id: string;
  status: "processing";
  retry_after_ms: number;
}

export interface FailedReport {
  session_id: string;
  status: "failed";
  error_code: string;
  can_retry: boolean;
}

export type SessionReportResponse = CompletedReport | PendingReport | FailedReport;

export interface EventBatchAccepted {
  accepted: number;
  duplicates: number;
}

export const sessionApi = {
  create(payload: CreateSessionPayload): Promise<SessionResponse> {
    return apiClient.request(API_ENDPOINTS.sessions.root, { method: "POST", body: payload });
  },

  list(limit = 50, offset = 0): Promise<SessionResponse[]> {
    return apiClient.request(`${API_ENDPOINTS.sessions.root}?limit=${limit}&offset=${offset}`);
  },

  current(): Promise<SessionResponse> {
    return apiClient.request(API_ENDPOINTS.sessions.current);
  },

  get(sessionId: string): Promise<SessionResponse> {
    return apiClient.request(API_ENDPOINTS.sessions.byId(sessionId));
  },

  finish(sessionId: string, endedAt = new Date().toISOString()): Promise<SessionResponse> {
    return apiClient.request(API_ENDPOINTS.sessions.finish(sessionId), {
      method: "POST",
      body: { ended_at: endedAt }
    });
  },

  retryAnalysis(sessionId: string): Promise<SessionResponse> {
    return apiClient.request(API_ENDPOINTS.sessions.retryAnalysis(sessionId), { method: "POST" });
  },

  sendEvents(sessionId: string, batch: RawEventBatch): Promise<EventBatchAccepted> {
    return apiClient.request(API_ENDPOINTS.sessions.eventsBatch(sessionId), {
      method: "POST",
      body: batch
    });
  },

  report(sessionId: string): Promise<SessionReportResponse> {
    return apiClient.request(API_ENDPOINTS.sessions.report(sessionId));
  }
};
