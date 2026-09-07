import { API_ENDPOINTS } from "./endpoints.js";

const DEFAULT_API_URL = "http://localhost:8000/api/v1";
const TOKEN_STORAGE_KEY = "mirror.auth.tokens";
export const AUTH_EXPIRED_EVENT = "mirror:auth-expired";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface ValidationIssue {
  loc?: Array<string | number>;
  msg?: string;
}

interface ApiErrorBody {
  detail?: string | ValidationIssue[];
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(
    message: string,
    options: { status?: number; code?: string; fieldErrors?: Record<string, string> } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "UNKNOWN_ERROR";
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

function getStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export const tokenStorage = {
  get(): AuthTokens | null {
    const value = getStorage()?.getItem(TOKEN_STORAGE_KEY);
    if (!value) return null;

    try {
      const tokens = JSON.parse(value) as Partial<AuthTokens>;
      return tokens.access_token && tokens.refresh_token
        ? {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type ?? "bearer"
          }
        : null;
    } catch {
      tokenStorage.clear();
      return null;
    }
  },

  set(tokens: AuthTokens): void {
    getStorage()?.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  },

  clear(): void {
    getStorage()?.removeItem(TOKEN_STORAGE_KEY);
  }
};

function errorCodeForStatus(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  return "HTTP_ERROR";
}

function notifyAuthExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

async function createResponseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // Some proxies and 5xx responses return an empty or non-JSON body.
  }

  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(body?.detail)) {
    for (const issue of body.detail) {
      const field = issue.loc?.filter((part) => part !== "body").join(".");
      if (field && issue.msg) fieldErrors[field] = issue.msg;
    }
  }

  const detail = typeof body?.detail === "string" ? body.detail : body?.message;
  return new ApiError(detail || `Request failed (${response.status})`, {
    status: response.status,
    code: errorCodeForStatus(response.status),
    fieldErrors
  });
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

export class ApiClient {
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true, retryOnUnauthorized = true, body, headers, ...init } = options;
    const requestHeaders = new Headers(headers);
    const tokens = tokenStorage.get();

    if (body !== undefined && !(body instanceof FormData)) {
      requestHeaders.set("Content-Type", "application/json");
    }
    if (auth && tokens?.access_token) {
      requestHeaders.set("Authorization", `Bearer ${tokens.access_token}`);
    }

    let response: Response;
    try {
      const requestInit: RequestInit = {
        ...init,
        headers: requestHeaders
      };
      if (body !== undefined) {
        requestInit.body = body instanceof FormData ? body : JSON.stringify(body);
      }
      response = await fetch(`${this.baseUrl}${path}`, requestInit);
    } catch (error) {
      throw new ApiError(
        error instanceof Error && error.name === "AbortError"
          ? "Request was cancelled"
          : "Unable to connect to the server",
        { code: error instanceof Error && error.name === "AbortError" ? "ABORTED" : "NETWORK_ERROR" }
      );
    }

    if (response.status === 401 && auth && retryOnUnauthorized && tokenStorage.get()?.refresh_token) {
      try {
        await this.refreshAccessToken();
      } catch {
        tokenStorage.clear();
        notifyAuthExpired();
        throw await createResponseError(response);
      }
      return this.request<T>(path, { ...options, retryOnUnauthorized: false });
    }

    if (response.status === 401 && auth) {
      tokenStorage.clear();
      notifyAuthExpired();
    }

    if (!response.ok) throw await createResponseError(response);
    if (response.status === 204) return undefined as T;

    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("application/json")
      ? ((await response.json()) as T)
      : ((await response.text()) as T);
  }

  private refreshAccessToken(): Promise<AuthTokens> {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken = tokenStorage.get()?.refresh_token;
    if (!refreshToken) {
      return Promise.reject(new ApiError("Authentication required", { status: 401, code: "UNAUTHORIZED" }));
    }

    this.refreshPromise = this.request<AuthTokens>(API_ENDPOINTS.auth.refresh, {
      method: "POST",
      body: { refresh_token: refreshToken },
      auth: false,
      retryOnUnauthorized: false
    })
      .then((tokens) => {
        tokenStorage.set(tokens);
        return tokens;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }
}

const configuredApiUrl = (import.meta as ImportMeta & {
  readonly env?: Record<string, string | undefined>;
}).env?.VITE_API_URL?.trim();
export const apiClient = new ApiClient((configuredApiUrl || DEFAULT_API_URL).replace(/\/$/, ""));
