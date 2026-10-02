import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BuyersPage } from "./pages/BuyersPage";
import { DataPage } from "./pages/DataPage";
import { IngredientsPage } from "./pages/IngredientsPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SummaryPage } from "./pages/SummaryPage";
import { useAppStore } from "./store/useAppStore";
import { useAuthStore } from "./store/useAuthStore";

export default function App() {
  const { t } = useTranslation();
  const load = useAppStore((s) => s.load);
  const flash = useAppStore((s) => s.flash);

  const authStatus = useAuthStore((s) => s.status);
  const authEnabled = useAuthStore((s) => s.authEnabled);
  const user = useAuthStore((s) => s.user);
  const initAuth = useAuthStore((s) => s.init);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  const needLogin = authStatus === "ready" && authEnabled && !user;

  useEffect(() => {
    if (authStatus === "ready" && !needLogin) {
      void load().catch((error) => {
        flash({ type: "error", message: String(error) });
      });
    }
  }, [authStatus, needLogin, load, flash]);

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-[var(--muted)]">
        {t("common.loading")}
      </div>
    );
  }

  if (needLogin) {
    return <LoginPage />;
  }

  return (
    // HashRouter works on any static host (GitHub Pages, Vercel, Netlify)
    // without needing server-side rewrite rules for deep links.
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<IngredientsPage />} />
          <Route path="/buyers" element={<BuyersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
