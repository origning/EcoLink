import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";

const tabs = [
  { to: "/", key: "nav.ingredients", icon: BasketIcon },
  { to: "/buyers", key: "nav.buyers", icon: StoreIcon },
  { to: "/orders", key: "nav.orders", icon: OrderIcon },
  { to: "/summary", key: "nav.summary", icon: TableIcon },
  { to: "/data", key: "nav.data", icon: DataIcon },
] as const;

export function AppShell() {
  const { t, i18n } = useTranslation();
  const locale = useAppStore((s) => s.settings.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const notice = useAppStore((s) => s.notice);
  const loaded = useAppStore((s) => s.loaded);

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [i18n, locale]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,white)] px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">
          {t("appName")}
        </h1>
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
      </header>

      {notice && (
        <div
          className={`mx-4 mt-3 rounded-2xl px-3 py-2 text-sm ${
            notice.type === "ok"
              ? "bg-[var(--brand-soft)] text-[var(--brand)]"
              : "bg-red-50 text-[var(--danger)]"
          }`}
        >
          {notice.message}
        </div>
      )}

      <main className="flex-1 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4">
        {loaded ? <Outlet /> : <p className="pt-10 text-center text-[var(--muted)]">{t("common.loading")}</p>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-3xl border-t border-[var(--line)] bg-white/95 px-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pt-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] sm:text-xs ${
                  isActive
                    ? "text-[var(--brand)]"
                    : "text-[var(--muted)]"
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
      className={`min-h-8 rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]"
      }`}
    >
      {children}
    </button>
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
