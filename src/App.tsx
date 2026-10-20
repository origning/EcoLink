import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireRole } from "./components/RequireRole";
import { BuyersPage } from "./pages/BuyersPage";
import { DataPage } from "./pages/DataPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { IncomePage } from "./pages/IncomePage";
import { IngredientsPage } from "./pages/IngredientsPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { LoginPage } from "./pages/LoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PackingPage } from "./pages/PackingPage";
import { PickupPage } from "./pages/PickupPage";
import { SummaryPage } from "./pages/SummaryPage";
import { useAppStore } from "./store/useAppStore";
import { useAuthStore } from "./store/useAuthStore";
import { homeForRole } from "./utils/roles";

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
          <Route path="/" element={<RoleHome />} />
          <Route
            path="/ingredients"
            element={
              <RequireRole roles={["admin"]}>
                <IngredientsPage />
              </RequireRole>
            }
          />
          <Route
            path="/buyers"
            element={
              <RequireRole roles={["admin"]}>
                <BuyersPage />
              </RequireRole>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireRole roles={["admin", "editor"]}>
                <OrdersPage />
              </RequireRole>
            }
          />
          <Route
            path="/pickups"
            element={
              <RequireRole roles={["admin", "picker"]}>
                <PickupPage />
              </RequireRole>
            }
          />
          <Route
            path="/packing"
            element={
              <RequireRole roles={["admin", "packer"]}>
                <PackingPage />
              </RequireRole>
            }
          />
          <Route
            path="/summary"
            element={
              <RequireRole roles={["admin", "summarizer"]}>
                <SummaryPage />
              </RequireRole>
            }
          />
          <Route
            path="/invoices"
            element={
              <RequireRole roles={["admin", "summarizer"]}>
                <InvoicesPage />
              </RequireRole>
            }
          />
          <Route
            path="/income"
            element={
              <RequireRole roles={["admin"]}>
                <IncomePage />
              </RequireRole>
            }
          />
          <Route
            path="/expenses"
            element={
              <RequireRole roles={["admin"]}>
                <ExpensesPage />
              </RequireRole>
            }
          />
          <Route
            path="/data"
            element={
              <RequireRole roles={["admin"]}>
                <DataPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<RoleHome />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function RoleHome() {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={homeForRole(user?.role ?? "admin")} replace />;
}
