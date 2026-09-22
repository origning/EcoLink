import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { i18nReady } from "./i18n";
import "./index.css";

function registerServiceWorker() {
  const capacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.(),
  );
  if (!import.meta.env.PROD || capacitor || !("serviceWorker" in navigator)) {
    return;
  }
  // Base-aware path so the worker also registers when hosted under a sub-path.
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

void i18nReady.then(() => {
  registerServiceWorker();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
