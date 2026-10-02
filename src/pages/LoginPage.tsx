import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/auth";
import { Card, Field, PrimaryButton, TextInput } from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locale = i18n.language?.startsWith("en") ? "en" : "zh";

  async function submit() {
    if (busy) return;
    if (!username.trim()) {
      setError(t("auth.needUsername"));
      return;
    }
    if (!password) {
      setError(t("auth.needPassword"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      const message =
        err instanceof ApiError && err.message === "bad-credentials"
          ? t("auth.badCredentials")
          : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="mb-4 flex w-full max-w-sm justify-end">
        <div className="flex rounded-full bg-white p-1 shadow-sm ring-1 ring-[var(--line)]">
          {(["zh", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => void i18n.changeLanguage(lang)}
              className={`min-h-8 rounded-full px-3 py-1 text-xs font-semibold ${
                locale === lang
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              {lang === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-xl font-semibold">
          {t("auth.loginTitle")}
        </h1>
        <p className="mb-5 text-center text-sm text-[var(--muted)]">
          {t("auth.loginHint")}
        </p>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label={t("auth.username")}>
            <TextInput
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>

          <Field label={t("auth.password")}>
            <TextInput
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {error ? (
            <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <PrimaryButton type="submit" className="w-full py-3" disabled={busy}>
            {busy ? t("auth.loggingIn") : t("auth.login")}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
