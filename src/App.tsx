import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { BuyersPage } from "./pages/BuyersPage";
import { DataPage } from "./pages/DataPage";
import { IngredientsPage } from "./pages/IngredientsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SummaryPage } from "./pages/SummaryPage";
import { useAppStore } from "./store/useAppStore";

export default function App() {
  const load = useAppStore((s) => s.load);
  const flash = useAppStore((s) => s.flash);

  useEffect(() => {
    void load().catch((error) => {
      flash({ type: "error", message: String(error) });
    });
  }, [load, flash]);

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
