import { request } from "./client";
import type { LoginRequest, RegisterRequest, TokenResponse } from "../types/auth.types";
import type { User } from "../types/user.types";

export const authApi = {
  register(payload: RegisterRequest) {
    return request<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false
    });
  },
  login(payload: LoginRequest) {
    return request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false
    });
  },
  refresh(refreshToken: string) {
    return request<TokenResponse>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
      auth: false
    });
  },
  me() {
    return request<User>("/api/auth/me");
  },
  logout() {
    return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  }
};
