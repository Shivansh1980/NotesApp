export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const TOKEN_KEY = "notes.accessToken";
const REFRESH_KEY = "notes.refreshToken";

type RequestOptions = RequestInit & {
  auth?: boolean;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
  }
}

export function setStoredTokens(accessToken: string | null, refreshToken: string | null): void {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  else localStorage.removeItem(TOKEN_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function resolveApiUrl(value: string, baseUrl = API_BASE): string {
  if (!value || /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    return value;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = getStoredAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers
  });

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("Content-Type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "detail" in payload ? String(payload.detail) : "Request failed";
    throw new ApiError(message, response.status, payload);
  }
  return payload as T;
}
