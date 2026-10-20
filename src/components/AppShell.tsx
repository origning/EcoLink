import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sheet } from "./ui";
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
  ],
  editor: [{ to: "/orders", key: "nav.orders", icon: OrderIcon }],
  picker: [{ to: "/pickups", key: "nav.pickups", icon: PickupIcon }],
  packer: [{ to: "/packing", key: "nav.packing", icon: PackingIcon }],
  summarizer: [
    { to: "/summary", key: "nav.summary", icon: TableIcon },
    { to: "/invoices", key: "nav.invoices", icon: InvoiceIcon },
  ],
};

const moreItems: Tab[] = [
  { to: "/pickups", key: "nav.pickups", icon: PickupIcon },
  { to: "/packing", key: "nav.packing", icon: PackingIcon },
  { to: "/data", key: "nav.data", icon: DataIcon },
];

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
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const role = user?.role ?? "admin";
  const tabs = mainTabs[role];
  const showMore = role === "admin";
  const moreActive = moreItems.some((item) => location.pathname === item.to);
  const columns = tabs.length + (showMore ? 1 : 0);
  const bottomNavText = columns > 5 ? "text-[10px]" : "text-[11px] sm:text-xs";
  const testRoleEnabled = import.meta.env.DEV && !authEnabled;
  // 桌面端把「更多」里的页面也直接放进侧边导航。
  const desktopItems = showMore ? [...tabs, ...moreItems] : tabs;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  useEffect(() => {
    setMoreOpen(false);
  }, [role]);

  return (
    <div className="min-h-dvh bg-[var(--bg)] lg:flex">
      <aside className="hidden shrink-0 lg:block lg:w-60">
        <div className="sticky top-0 flex h-dvh flex-col border-r border-[var(--line)] bg-white px-3 py-5">
          <div className="mb-6 px-3">
            <p className="text-lg font-semibold">{t("appName")}</p>
            {user ? (
              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {user.username} · {t(roleLabelKey(user.role))}
              </p>
            ) : null}
          </div>
          <nav className="space-y-1">
            {desktopItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                      : "text-[var(--muted)] hover:bg-[var(--bg)]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon active={isActive} />
                    <span className="truncate">{t(item.key)}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-[var(--bg)] lg:mx-0 lg:min-w-0 lg:max-w-none lg:flex-1">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,white)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] lg:max-w-[1440px] lg:px-8 lg:py-3">
        <h1 className="truncate text-base font-semibold leading-tight sm:text-lg lg:hidden">
          {t("appName")}
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {authEnabled && user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              title={`${user.username} · ${t("auth.logout")}`}
              aria-label={t("auth.logout")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--muted)] shadow-sm ring-1 ring-[var(--line)]"
            >
              <LogoutIcon />
            </button>
          ) : null}
          <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-[var(--line)]">
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
        </div>
        </div>
      </header>

      {testRoleEnabled ? (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-[max(1rem,env(safe-area-inset-left))] py-2 pr-[max(1rem,env(safe-area-inset-right))] text-xs text-amber-900 lg:max-w-[1440px] lg:px-8">
            <span className="font-semibold">{t("testRole.label")}</span>
            <select
              value={role}
              onChange={(event) => setTestRole(event.target.value as UserRole)}
              className="min-h-8 rounded-full border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900"
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

      {notice && (
        <div
          role="status"
          className={`pointer-events-none fixed inset-x-0 bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-2xl px-4 py-2 text-center text-sm shadow-lg ring-1 ring-black/5 lg:bottom-8 ${
            notice.type === "ok"
              ? "bg-[var(--brand)] text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notice.message}
        </div>
      )}

      <main className="mx-auto w-full max-w-3xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 lg:max-w-[1440px] lg:px-8 lg:pb-10 lg:pt-6">
        {loaded ? <Outlet /> : <p className="pt-10 text-center text-[var(--muted)]">{t("common.loading")}</p>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-3xl border-t border-[var(--line)] bg-white/95 px-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 ${bottomNavText} ${
                  isActive ? "text-[var(--brand)]" : "text-[var(--muted)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon active={isActive} />
                  <span className="max-w-full truncate font-medium">{t(tab.key)}</span>
                </>
              )}
            </NavLink>
          ))}
          {showMore ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 ${bottomNavText} ${
                moreActive ? "text-[var(--brand)]" : "text-[var(--muted)]"
              }`}
            >
              <MoreIcon active={moreActive} />
              <span className="max-w-full truncate font-medium">{t("nav.more")}</span>
            </button>
          ) : null}
        </div>
      </nav>

      {moreOpen ? (
        <Sheet title={t("nav.more")} onClose={() => setMoreOpen(false)}>
          <div className="space-y-2">
            {moreItems.map((item) => (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.to);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${
                  location.pathname === item.to
                    ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "bg-[var(--bg)] text-[var(--ink)]"
                }`}
              >
                <item.icon active={location.pathname === item.to} />
                <span className="font-medium">{t(item.key)}</span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      </div>
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
      className={`min-h-8 rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function BasketIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9h16l-1.2 10.2A2 2 0 0 1 16.82 21H7.18a2 2 0 0 1-1.98-1.8L4 9Z"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
      <path
        d="M8 9V7a4 4 0 0 1 8 0v2"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10 6 5h12l2 5v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
      <path d="M9 20v-5h6v5" stroke={active ? "#1b7a4e" : "#5d6f64"} strokeWidth="1.8" />
    </svg>
  );
}

function OrderIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-6-2.5L6 20V6a2 2 0 0 1 2-2Z"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
      <path d="M9 9h6M9 13h4" stroke={active ? "#1b7a4e" : "#5d6f64"} strokeWidth="1.8" />
    </svg>
  );
}

function TableIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
      <path
        d="M4 10h16M10 5v14"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function InvoiceIcon({ active }: { active: boolean }) {
  const color = active ? "#1b7a4e" : "#5d6f64";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h3"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DataIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
      <path
        d="M12 4v12M8 12l4 4 4-4"
        stroke={active ? "#1b7a4e" : "#5d6f64"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PickupIcon({ active }: { active: boolean }) {
  const color = active ? "#1b7a4e" : "#5d6f64";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h16l-1 11a2 2 0 0 1-2 1.8H7A2 2 0 0 1 5 19L4 8Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" stroke={color} strokeWidth="1.8" />
      <path d="m9 14 2 2 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PackingIcon({ active }: { active: boolean }) {
  const color = active ? "#1b7a4e" : "#5d6f64";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" stroke={color} strokeWidth="1.8" />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" stroke={color} strokeWidth="1.8" />
      <path d="M8 6.2 16 11" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  const color = active ? "#1b7a4e" : "#5d6f64";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="1.8" fill={color} />
      <circle cx="12" cy="12" r="1.8" fill={color} />
      <circle cx="19" cy="12" r="1.8" fill={color} />
    </svg>
  );
}
