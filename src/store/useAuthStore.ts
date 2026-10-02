import { create } from "zustand";
import { fetchMe, login as apiLogin, logout as apiLogout } from "../api/auth";
import type { AuthUser } from "../types";

type AuthStatus = "loading" | "ready";

type AuthState = {
  status: AuthStatus;
  /** 服务端是否开启了登录。静态托管（设备模式）下为 false。 */
  authEnabled: boolean;
  user: AuthUser | null;
  init: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const LOCAL_USER: AuthUser = { id: "local", username: "local", role: "admin" };

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  authEnabled: false,
  user: null,

  init: async () => {
    try {
      const res = await fetchMe();
      if (!res || res.authEnabled !== true) {
        set({ status: "ready", authEnabled: false, user: LOCAL_USER });
        return;
      }
      set({ status: "ready", authEnabled: true, user: res.user ?? null });
    } catch {
      // 没有后端（静态托管 / 设备模式）时，视为本机单用户，不需要登录。
      set({ status: "ready", authEnabled: false, user: LOCAL_USER });
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
