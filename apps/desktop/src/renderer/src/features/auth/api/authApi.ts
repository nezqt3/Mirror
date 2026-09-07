import { API_ENDPOINTS, apiClient, tokenStorage, type AuthTokens } from "../../../shared/api";

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  display_name: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<User> {
    const tokens = await apiClient.request<AuthTokens>(API_ENDPOINTS.auth.login, {
      method: "POST",
      body: payload,
      auth: false
    });
    tokenStorage.set(tokens);

    try {
      return await this.me();
    } catch (error) {
      tokenStorage.clear();
      throw error;
    }
  },

  async register(payload: RegisterPayload): Promise<User> {
    await apiClient.request<User>(API_ENDPOINTS.users.register, {
      method: "POST",
      body: payload,
      auth: false
    });
    return this.login({ email: payload.email, password: payload.password });
  },

  me(): Promise<User> {
    return apiClient.request<User>(API_ENDPOINTS.users.me);
  },

  async logout(): Promise<void> {
    const refreshToken = tokenStorage.get()?.refresh_token;
    try {
      if (refreshToken) {
        await apiClient.request<void>(API_ENDPOINTS.auth.logout, {
          method: "POST",
          body: { refresh_token: refreshToken },
          auth: false,
          retryOnUnauthorized: false
        });
      }
    } finally {
      tokenStorage.clear();
    }
  }
};
