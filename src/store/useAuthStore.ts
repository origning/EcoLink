import { create } from "zustand";
import { fetchMe, login as apiLogin, logout as apiLogout } from "../api/auth";
import type { AuthUser, UserRole } from "../types";

type AuthStatus = "loading" | "ready";

type AuthState = {
  status: AuthStatus;
  /** 服务端是否开启了登录。静态托管（设备模式）下为 false。 */
  authEnabled: boolean;
  user: AuthUser | null;
  /** 仅本地开发使用的角色预览；生产构建不会启用。 */
  testRole: UserRole | null;
  init: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setTestRole: (role: UserRole | null) => void;
};

const LOCAL_USER: AuthUser = { id: "local", username: "local", role: "admin" };
const TEST_ROLE_KEY = "ecolink:test-role";
const ROLES: UserRole[] = ["admin", "editor", "picker", "packer", "summarizer"];

function readTestRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(TEST_ROLE_KEY);
  return ROLES.includes(stored as UserRole) ? (stored as UserRole) : null;
}

function withTestRole(user: AuthUser, role: UserRole | null): AuthUser {
  return role ? { ...user, role } : user;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  authEnabled: false,
  user: null,
  testRole: null,

  init: async () => {
    try {
      const res = await fetchMe();
      if (!res || res.authEnabled !== true) {
        // 只有本地开发（npm run dev / npm start）才启用角色预览。
        const testRole = import.meta.env.DEV ? readTestRole() : null;
        set({
          status: "ready",
          authEnabled: false,
          testRole,
          user: withTestRole(LOCAL_USER, testRole),
        });
        return;
      }
      set({
        status: "ready",
        authEnabled: true,
        testRole: null,
        user: res.user ?? null,
      });
    } catch {
      // 没有后端（静态托管 / 设备模式）时，视为本机单用户，不需要登录。
      const testRole = import.meta.env.DEV ? readTestRole() : null;
      set({
        status: "ready",
        authEnabled: false,
        testRole,
        user: withTestRole(LOCAL_USER, testRole),
      });
    }
  },

  signIn: async (username, password) => {
    const res = await apiLogin(username, password);
    set({ user: res.user });
  },

  signOut: async () => {
    try {
      await apiLogout();
    } catch {
      // 忽略登出请求失败，本地状态照样清掉
    }
    set({ user: null });
  },

  setTestRole: (role) => {
    if (typeof window !== "undefined") {
      if (role) window.localStorage.setItem(TEST_ROLE_KEY, role);
      else window.localStorage.removeItem(TEST_ROLE_KEY);
    }
    set((state) => ({
      testRole: role,
      user:
        state.user && !state.authEnabled
          ? withTestRole({ ...state.user, role: "admin" }, role)
          : state.user,
    }));
  },
}));

// 任何接口返回 401（例如会话过期）时，退回登录页。
if (typeof window !== "undefined") {
  window.addEventListener("ecolink:unauthorized", () => {
    const state = useAuthStore.getState();
    if (state.authEnabled && state.user) {
      useAuthStore.setState({ user: null });
    }
  });
}
