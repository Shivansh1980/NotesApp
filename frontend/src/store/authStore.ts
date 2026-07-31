import { create } from "zustand";

import { authApi } from "../api/auth.api";
import { getStoredAccessToken, getStoredRefreshToken, setStoredTokens } from "../api/client";
import type { LoginRequest, RegisterRequest } from "../types/auth.types";
import type { User } from "../types/user.types";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  bootstrapped: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: getStoredAccessToken(),
  refreshToken: getStoredRefreshToken(),
  user: null,
  bootstrapped: false,
  async login(payload) {
    const response = await authApi.login(payload);
    setStoredTokens(response.access_token, response.refresh_token);
    set({ accessToken: response.access_token, refreshToken: response.refresh_token, user: response.user });
  },
  async register(payload) {
    const response = await authApi.register(payload);
    setStoredTokens(response.access_token, response.refresh_token);
    set({ accessToken: response.access_token, refreshToken: response.refresh_token, user: response.user });
  },
  async bootstrap() {
    if (!get().accessToken) {
      set({ bootstrapped: true });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, bootstrapped: true });
    } catch {
      const refreshToken = get().refreshToken;
      if (!refreshToken) {
        get().logout();
        set({ bootstrapped: true });
        return;
      }
      try {
        const response = await authApi.refresh(refreshToken);
        setStoredTokens(response.access_token, response.refresh_token);
        set({
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          user: response.user,
          bootstrapped: true
        });
      } catch {
        get().logout();
        set({ bootstrapped: true });
      }
    }
  },
  logout() {
    setStoredTokens(null, null);
    set({ accessToken: null, refreshToken: null, user: null });
  }
}));
