import { useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrandMark } from "./ui";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { ROLE_OPTIONS, roleLabelKey } from "../utils/roles";
import type { UserRole } from "../types";

type Tab = {
  to: string;
  key: string;
  icon: (props: { active: boolean }) => ReactNode;
};

const mainTabs: Record<UserRole, Tab[]> = {
  admin: [
    { to: "/ingredients", key: "nav.ingredients", icon: BasketIcon },
    { to: "/buyers", key: "nav.buyers", icon: StoreIcon },
    { to: "/orders", key: "nav.orders", icon: OrderIcon },
    { to: "/summary", key: "nav.summary", icon: TableIcon },
    { to: "/invoices", key: "nav.invoices", icon: InvoiceIcon },
    { to: "/pickups", key: "nav.pickups", icon: PickupIcon },
    { to: "/packing", key: "nav.packing", icon: PackingIcon },
    { to: "/expenses", key: "nav.expenses", icon: ExpensesIcon },
    { to: "/data", key: "nav.data", icon: DataIcon },
  ],
  editor: [{ to: "/orders", key: "nav.orders", icon: OrderIcon }],
  picker: [{ to: "/pickups", key: "nav.pickups", icon: PickupIcon }],
  packer: [{ to: "/packing", key: "nav.packing", icon: PackingIcon }],
  summarizer: [
    { to: "/summary", key: "nav.summary", icon: TableIcon },
    { to: "/invoices", key: "nav.invoices", icon: InvoiceIcon },
  ],
};

export function AppShell() {
  const { t, i18n } = useTranslation();
  const locale = useAppStore((s) => s.settings.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const notice = useAppStore((s) => s.notice);
  const loaded = useAppStore((s) => s.loaded);
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setTestRole = useAuthStore((s) => s.setTestRole);
  const location = useLocation();

  const role = user?.role ?? "admin";
  const tabs = mainTabs[role];
  const columns = tabs.length;
  const bottomNavText =
    columns > 6
      ? "text-[8.5px] leading-none tracking-tight"
      : columns > 5
        ? "text-[9px] tracking-tight"
        : "text-[10px] sm:text-xs";
  const bottomNavPadding = columns > 6 ? "px-0" : columns > 5 ? "px-0.5" : "px-1";
  const testRoleEnabled = import.meta.env.DEV && !authEnabled;
  const initials = (user?.username ?? "EC").slice(0, 2).toUpperCase();

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [role, location.pathname]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,white_86%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[60px] w-full max-w-[1400px] items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:px-8 xl:gap-5">
          <Link
            to="/"
            aria-label={t("appName")}
            className="flex min-w-0 shrink-0 items-center"
          >
            <BrandMark size={40} alt="" />
          </Link>

          <nav className="hidden min-w-0 items-center gap-0.5 lg:flex">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `inline-flex h-9 items-center gap-1.5 rounded-[9px] px-2 text-[12.5px] font-medium transition xl:px-3 xl:text-[13px] ${
                    isActive
                      ? "bg-[var(--ink)] text-white shadow-[0_8px_16px_-10px_rgba(23,23,23,0.7)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="hidden xl:inline-flex">
                      <tab.icon active={isActive} />
                    </span>
                    <span className="truncate">{t(tab.key)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="flex rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-0.5">
              <LangButton
                active={locale === "zh"}
                onClick={() => void setLocale("zh")}
              >
                中文
              </LangButton>
              <LangButton
                active={locale === "en"}
                onClick={() => void setLocale("en")}
              >
                EN
              </LangButton>
            </div>

            {authEnabled && user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                title={`${user.username} · ${t("auth.logout")}`}
                aria-label={t("auth.logout")}
                className="grid h-9 w-9 place-items-center rounded-[9px] border border-[var(--line)] bg-white text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
              >
                <LogoutIcon />
              </button>
            ) : null}

            {user ? (
              <>
                <span className="hidden h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#fb923c] to-[#ea580c] text-[10px] font-bold text-white xl:grid 2xl:hidden">
                  {initials}
                </span>
                <div className="hidden items-center gap-2 pl-1 2xl:flex">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#fb923c] to-[#ea580c] text-[10px] font-bold text-white">
                    {initials}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block max-w-[120px] truncate text-[11.5px] font-semibold">
                      {user.username}
                    </span>
                    <span className="block text-[9.5px] text-[var(--muted-2)]">
                      {t(roleLabelKey(user.role))}
                    </span>
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {testRoleEnabled ? (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-2 px-[max(1rem,env(safe-area-inset-left))] py-2 pr-[max(1rem,env(safe-area-inset-right))] text-xs text-amber-900 lg:px-8">
              <span className="font-semibold">{t("testRole.label")}</span>
              <select
                value={role}
                onChange={(event) => setTestRole(event.target.value as UserRole)}
                className="min-h-8 rounded-[8px] border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900"
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {t(roleLabelKey(item))}
                  </option>
                ))}
              </select>
              <span className="text-amber-700">{t("testRole.hint")}</span>
            </div>
          </div>
        ) : null}
      </header>

      {notice ? (
        <div
          role="status"
          className={`toast-in pointer-events-none fixed inset-x-0 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-[0_16px_32px_-14px_rgba(23,23,23,0.6)] ring-1 ring-black/5 lg:bottom-8 ${
            notice.type === "ok" ? "bg-[var(--ink)]" : "bg-[var(--danger)]"
          }`}
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
            {notice.type === "ok" ? <CheckIcon /> : <span className="text-xs">!</span>}
          </span>
          {notice.message}
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-[max(1rem,env(safe-area-inset-left))] pb-[calc(6.2rem+env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 lg:px-8 lg:pb-10 lg:pt-6">
        {loaded ? (
          <div key={location.pathname} className="page-in">
            <Outlet />
          </div>
        ) : (
          <div className="flex min-h-[40vh] items-center justify-center">
            <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl px-[max(0.5rem,env(safe-area-inset-left))] pb-[calc(0.6rem+env(safe-area-inset-bottom))] pr-[max(0.5rem,env(safe-area-inset-right))] lg:hidden">
        <div
          className="grid rounded-[22px] border border-[var(--line)] bg-[color-mix(in_srgb,white_94%,transparent)] p-1.5 shadow-[0_18px_40px_-18px_rgba(23,23,23,0.35)] backdrop-blur-xl"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[16px] ${bottomNavPadding} py-1.5 transition ${bottomNavText} ${
                  isActive
                    ? "bg-[var(--ink)] font-semibold text-white"
                    : "font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon active={isActive} />
                  <span className="max-w-full truncate">{t(tab.key)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function LangButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-7 rounded-[7px] px-2.5 py-1 text-[10.5px] font-semibold transition ${
        active
          ? "bg-white text-[var(--ink)] shadow-[var(--shadow-xs)]"
          : "text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9h16l-1.2 10.2A2 2 0 0 1 16.82 21H7.18a2 2 0 0 1-1.98-1.8L4 9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 9V7a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10 6 5h12l2 5v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20v-5h6v5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function OrderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-6-2.5L6 20V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 9h6M9 13h4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 10h16M10 5v14"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExpensesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4 16h15M8 8h7M8 11h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DataIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 4v12M8 12l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PickupIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h16l-1 11a2 2 0 0 1-2 1.8H7A2 2 0 0 1 5 19L4 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m9 14 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PackingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 6.2 16 11" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
