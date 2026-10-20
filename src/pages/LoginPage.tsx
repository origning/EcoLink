import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/auth";
import { BrandMark, Field, PrimaryButton, TextInput } from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const setLocale = useAppStore((s) => s.setLocale);
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-[rgba(249,115,22,0.10)] blur-3xl" />
        <div className="absolute -bottom-48 -right-24 h-[32rem] w-[32rem] rounded-full bg-[rgba(23,23,23,0.06)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-[1060px]">
        <div className="grid overflow-hidden rounded-[26px] border border-[var(--line)] bg-white shadow-[var(--shadow-lg)] lg:grid-cols-[1.02fr_0.98fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--dark)] p-9 text-white lg:flex lg:min-h-[600px]">
            <div
              aria-hidden
              className="absolute -right-40 -top-32 h-[26rem] w-[26rem] rounded-full border border-white/[0.07]"
            />
            <div
              aria-hidden
              className="absolute -right-24 -top-16 h-[18rem] w-[18rem] rounded-full border border-[rgba(249,115,22,0.16)]"
            />
            <div
              aria-hidden
              className="absolute -bottom-32 -left-24 h-[22rem] w-[22rem] rounded-full bg-[rgba(234,88,12,0.14)] blur-3xl"
            />

            <div className="relative flex items-center">
              <span className="inline-flex h-14 items-center rounded-[16px] bg-white px-3 shadow-[0_16px_32px_-18px_rgba(0,0,0,0.7)]">
                <BrandMark size={38} />
              </span>
            </div>

            <div className="relative py-10">
              <h1 className="text-[36px] font-bold leading-[1.2] tracking-[-0.04em]">
                {t("auth.heroTitleA")}
                <br />
                <span className="text-[#fb923c]">{t("auth.heroTitleB")}</span>
              </h1>
              <p className="mt-4 max-w-[330px] text-xs leading-6 text-white/50">
                {t("auth.heroHint")}
              </p>
            </div>

            <div className="relative flex flex-wrap gap-2">
              {[t("nav.orders"), t("nav.summary"), t("nav.invoices")].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-medium text-white/60"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="relative flex flex-col justify-center p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-[320px]">
              <div className="mb-8 flex items-center justify-between gap-3">
                <div className="flex items-center lg:hidden">
                  <BrandMark size={34} />
                </div>
                <div className="ml-auto flex rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-0.5">
                  {(["zh", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => void setLocale(lang)}
                      className={`min-h-7 rounded-[7px] px-2.5 py-1 text-[10.5px] font-semibold transition ${
                        locale === lang
                          ? "bg-white text-[var(--ink)] shadow-[var(--shadow-xs)]"
                          : "text-[var(--muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {lang === "zh" ? "中文" : "EN"}
                    </button>
                  ))}
                </div>
              </div>

              <h2 className="text-[22px] font-bold tracking-tight">
                {t("auth.loginTitle")}
              </h2>
              <p className="mb-6 mt-1.5 text-xs text-[var(--muted)]">
                {t("auth.loginHint")}
              </p>

              <form
                className="space-y-3.5"
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
                  <p className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <PrimaryButton
                  type="submit"
                  className="w-full py-2.5"
                  disabled={busy}
                >
                  {busy ? t("auth.loggingIn") : t("auth.login")}
                </PrimaryButton>
              </form>

              <p className="mt-6 text-center text-[10px] leading-relaxed text-[var(--muted-2)]">
                {t("auth.secureNote")}
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] font-medium tracking-[0.08em] text-[var(--muted-2)]">
          EcoLink · Procurement
        </p>
      </div>
    </div>
  );
}
