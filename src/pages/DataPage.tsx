import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { fetchBackup, putBackup } from "../api/db";
import {
  ApiError,
  changePassword,
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  type UserRow,
} from "../api/auth";
import {
  Card,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Sheet,
  TextInput,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { FONT_OPTIONS, FONT_SIZE_OPTIONS } from "../storage/defaultDb";
import { todayIso } from "../utils/format";
import type { BackupFile, UserRole } from "../types";

function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== "object") return false;
  const backup = value as BackupFile;
  return (
    backup.format === "ecolink-backup" &&
    backup.version === 1 &&
    !!backup.db &&
    !!backup.db.settings &&
    Array.isArray(backup.db.groups) &&
    Array.isArray(backup.db.ingredients) &&
    Array.isArray(backup.db.buyers) &&
    Array.isArray(backup.db.orders) &&
    !!backup.images &&
    typeof backup.images === "object"
  );
}

export function DataPage() {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.settings.locale);
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const buyers = useAppStore((s) => s.buyers);
  const orders = useAppStore((s) => s.orders);
  const storageKind = useAppStore((s) => s.storageKind);
  const load = useAppStore((s) => s.load);
  const flash = useAppStore((s) => s.flash);
  const fontFamily = useAppStore((s) => s.settings.fontFamily);
  const setFontFamily = useAppStore((s) => s.setFontFamily);
  const fontSize = useAppStore((s) => s.settings.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);

  const authEnabled = useAuthStore((s) => s.authEnabled);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);

  const counts = [
    { label: t("data.groups"), value: groups.length },
    { label: t("nav.ingredients"), value: ingredients.length },
    { label: t("nav.buyers"), value: buyers.length },
    { label: t("nav.orders"), value: orders.length },
  ];

  return (
    <div>
      <PageTitle title={t("data.title")} />

      {authEnabled && user ? (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {t("auth.signedInAs", { name: user.username })}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {user.role === "admin" ? t("auth.roleAdmin") : t("auth.roleEditor")}
              </p>
            </div>
            <GhostButton onClick={() => void signOut()}>
              {t("auth.logout")}
            </GhostButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <GhostButton onClick={() => setPwdOpen(true)}>
              {t("auth.changePassword")}
            </GhostButton>
            {user.role === "admin" ? (
              <GhostButton onClick={() => setUsersOpen(true)}>
                {t("auth.users")}
              </GhostButton>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card className="mb-4">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {storageKind === "device"
            ? t("data.storageDevice")
            : authEnabled
              ? t("data.storageCloud")
              : t("data.storageFiles")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {t("data.hint")}
        </p>
        {storageKind === "device" ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {t("data.addToHome")}
          </p>
        ) : !authEnabled ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {t("data.phoneHint")}
          </p>
        ) : null}
      </Card>

      <Card className="mb-4">
        <p className="mb-3 text-sm font-medium text-[var(--muted)]">
          {t("data.counts")}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {counts.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-[var(--bg)] px-3 py-3 text-center"
            >
              <p className="text-xl font-semibold">{item.value}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <p className="mb-3 text-sm font-medium text-[var(--muted)]">
          {t("data.exportSettings")}
        </p>
        <Field label={t("data.fontFamily")} hint={t("data.fontHint")}>
          <select
            value={fontFamily}
            onChange={(e) => {
              void setFontFamily(e.target.value)
                .then(() => flash({ type: "ok", message: t("common.saved") }))
                .catch((error) =>
                  flash({ type: "error", message: String(error) }),
                );
            }}
            className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("data.fontSize")} hint={t("data.fontSizeHint")}>
          <select
            value={fontSize}
            onChange={(e) => {
              void setFontSize(Number(e.target.value))
                .then(() => flash({ type: "ok", message: t("common.saved") }))
                .catch((error) =>
                  flash({ type: "error", message: String(error) }),
                );
            }}
            className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <PrimaryButton
          className="w-full py-3"
          disabled={exporting || importing}
          onClick={() => {
            setExporting(true);
            void fetchBackup()
              .then((backup) => {
                const blob = new Blob([JSON.stringify(backup, null, 2)], {
                  type: "application/json",
                });
                const name =
                  locale === "zh"
                    ? `EcoLink备份-${todayIso()}.json`
                    : `ecolink-backup-${todayIso()}.json`;
                saveAs(blob, name);
                flash({ type: "ok", message: t("data.exported") });
              })
              .catch((error) =>
                flash({ type: "error", message: String(error) }),
              )
              .finally(() => setExporting(false));
          }}
        >
          {exporting ? t("data.exporting") : t("data.export")}
        </PrimaryButton>

        <div>
          <PrimaryButton
            className="w-full py-3"
            disabled={exporting || importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? t("data.importing") : t("data.import")}
          </PrimaryButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={t("data.pickFile")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!window.confirm(t("data.importConfirm"))) return;
              setImporting(true);
              void file
                .text()
                .then((text) => {
                  let parsed: unknown;
                  try {
                    parsed = JSON.parse(text);
                  } catch {
                    throw new Error("invalid-backup");
                  }
                  if (!isBackupFile(parsed)) {
                    throw new Error("invalid-backup");
                  }
                  return putBackup(parsed);
                })
                .then(() => load())
                .then(() => flash({ type: "ok", message: t("data.imported") }))
                .catch((error: Error) => {
                  const message =
                    error.message === "invalid-backup"
                      ? t("data.invalid")
                      : error.message === "Backup too large"
                        ? t("data.tooLarge")
                        : String(error);
                  flash({ type: "error", message });
                })
                .finally(() => setImporting(false));
            }}
          />
        </div>
      </div>

      {pwdOpen ? (
        <PasswordSheet
          onClose={() => setPwdOpen(false)}
          onSaved={() => {
            setPwdOpen(false);
            flash({ type: "ok", message: t("auth.passwordChanged") });
          }}
        />
      ) : null}

      {usersOpen ? <UsersSheet onClose={() => setUsersOpen(false)} /> : null}
    </div>
  );
}

function mapAuthError(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    switch (error.message) {
      case "username-taken":
        return t("auth.usernameTaken");
      case "password-too-short":
        return t("auth.passwordTooShort");
      case "last-admin":
        return t("auth.lastAdmin");
      case "cannot-delete-self":
        return t("auth.cannotDeleteSelf");
      case "bad-current-password":
        return t("auth.badCurrentPassword");
      default:
        return error.message;
    }
  }
  return String(error);
}

function PasswordSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    if (!current) {
      setError(t("auth.needPassword"));
      return;
    }
    if (next.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      onSaved();
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={t("auth.changePassword")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label={t("auth.currentPassword")}>
          <TextInput
            type="password"
            value={current}
            autoComplete="current-password"
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>
        <Field label={t("auth.newPassword")} hint={t("auth.passwordRule")}>
          <TextInput
            type="password"
            value={next}
            autoComplete="new-password"
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>
        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </PrimaryButton>
        </div>
      </form>
    </Sheet>
  );
}

function UsersSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers();
      setUsers(res.users);
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function add() {
    if (busy) return;
    setError(null);
    if (!username.trim()) {
      setError(t("auth.needUsername"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    setBusy(true);
    try {
      await createUser(username.trim(), password, role);
      setUsername("");
      setPassword("");
      setRole("editor");
      await reload();
    } catch (err) {
      setError(mapAuthError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove(user: UserRow) {
    if (!window.confirm(t("auth.deleteUserConfirm", { name: user.username }))) return;
    setError(null);
    try {
      await deleteUser(user.id);
      await reload();
    } catch (err) {
      setError(mapAuthError(err, t));
    }
  }

  async function resetPassword(user: UserRow) {
    const next = window.prompt(t("auth.resetPasswordPrompt", { name: user.username }));
    if (!next) return;
    setError(null);
    try {
      await resetUserPassword(user.id, next);
    } catch (err) {
      setError(mapAuthError(err, t));
    }
  }

  return (
    <Sheet title={t("auth.users")} onClose={onClose}>
      <p className="mb-3 text-sm text-[var(--muted)]">
        {t("auth.userCount", { count: users.length })}
      </p>

      <div className="space-y-2">
        {loading ? (
          <p className="py-2 text-sm text-[var(--muted)]">{t("common.loading")}</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.username}</p>
                <p className="text-xs text-[var(--muted)]">
                  {user.role === "admin" ? t("auth.roleAdmin") : t("auth.roleEditor")}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <GhostButton onClick={() => void resetPassword(user)}>
                  {t("auth.resetPassword")}
                </GhostButton>
                {user.id === me?.id ? null : (
                  <GhostButton danger onClick={() => void remove(user)}>
                    {t("common.delete")}
                  </GhostButton>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-[var(--line)] pt-4">
        <p className="mb-2 text-sm font-medium text-[var(--muted)]">
          {t("auth.addUser")}
        </p>
        <div className="space-y-3">
          <TextInput
            value={username}
            placeholder={t("auth.username")}
            autoComplete="off"
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextInput
            type="password"
            value={password}
            placeholder={t("auth.password")}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="min-h-11 flex-1 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              <option value="editor">{t("auth.roleEditor")}</option>
              <option value="admin">{t("auth.roleAdmin")}</option>
            </select>
            <PrimaryButton disabled={busy} onClick={() => void add()}>
              {t("common.add")}
            </PrimaryButton>
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}
