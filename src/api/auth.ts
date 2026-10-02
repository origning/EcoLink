import type { AuthUser, UserRole } from "../types";

// 登录 / 用户管理接口。所有请求带 Cookie（同源时 fetch 默认也会带）。

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function notifyUnauthorized(status: number) {
  if (status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("ecolink:unauthorized"));
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    notifyUnauthorized(res.status);
    const error = (parsed as { error?: string } | null)?.error;
    throw new ApiError(res.status, error || text || `HTTP ${res.status}`);
  }
  if (parsed === null) {
    throw new ApiError(res.status, "invalid-json");
  }
  return parsed as T;
}

function json(body: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export type MeResponse = { authEnabled: boolean; user: AuthUser | null };
export type UserRow = { id: string; username: string; role: UserRole };

export function fetchMe() {
  return request<MeResponse>("/api/auth/me");
}

export function login(username: string, password: string) {
  return request<{ user: AuthUser }>(
    "/api/auth/login",
    { method: "POST", ...json({ username, password }) },
  );
}

export function logout() {
  return request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ ok: boolean }>(
    "/api/auth/password",
    { method: "POST", ...json({ currentPassword, newPassword }) },
  );
}

export function listUsers() {
  return request<{ users: UserRow[] }>("/api/users");
}

export function createUser(username: string, password: string, role: UserRole) {
  return request<{ user: UserRow }>(
    "/api/users",
    { method: "POST", ...json({ username, password, role }) },
  );
}

export function deleteUser(id: string) {
  return request<{ ok: boolean }>(`/api/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function resetUserPassword(id: string, password: string) {
  return request<{ ok: boolean }>(`/api/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    ...json({ password }),
  });
}
