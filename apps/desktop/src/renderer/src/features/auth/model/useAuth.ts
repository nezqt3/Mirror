import { useCallback, useEffect, useState } from "react";
import { authApi, type LoginPayload, type RegisterPayload, type User } from "../api/authApi";
import { AUTH_EXPIRED_EVENT, tokenStorage } from "../../../shared/api";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!tokenStorage.get()) {
      setIsLoading(false);
      return;
    }

    authApi.me()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => tokenStorage.clear())
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const currentUser = await authApi.login(payload);
    setUser(currentUser);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const currentUser = await authApi.register(payload);
    setUser(currentUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Local sign-out must succeed even when the server is unavailable.
    } finally {
      setUser(null);
    }
  }, []);

  return { user, isLoading, login, register, logout };
}
