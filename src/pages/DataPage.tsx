import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import {
  fetchBackup,
  fetchStorageStats,
  previewPurge,
  putBackup,
} from "../api/db";
import {
  ApiError,
  changePassword,
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  updateUserRole,
  type UserRow,
} from "../api/auth";
import {
  Card,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Sheet,
  TextArea,
  TextInput,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { FONT_OPTIONS, FONT_SIZE_OPTIONS } from "../storage/defaultDb";
import { monthStartIso, todayIso } from "../utils/format";
import { exportArchiveZip, exportReadableExcel } from "../utils/exportArchive";
import { ROLE_OPTIONS, roleLabelKey } from "../utils/roles";
import type {
  BackupFile,
  InvoiceSettings,
  PurgePreview,
  StorageStats,
  UserRole,
} from "../types";

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
  const pickupRecords = useAppStore((s) => s.pickupRecords);
  const packRecords = useAppStore((s) => s.packRecords);
  const invoiceRecords = useAppStore((s) => s.invoiceRecords);
  const storageKind = useAppStore((s) => s.storageKind);
  const load = useAppStore((s) => s.load);
  const purgeData = useAppStore((s) => s.purgeData);
  const flash = useAppStore((s) => s.flash);
  const fontFamily = useAppStore((s) => s.settings.fontFamily);
  const setFontFamily = useAppStore((s) => s.setFontFamily);
  const fontSize = useAppStore((s) => s.settings.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);
  const invoice = useAppStore((s) => s.settings.invoice);
  const setInvoiceSettings = useAppStore((s) => s.setInvoiceSettings);

  const authEnabled = useAuthStore((s) => s.authEnabled);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [archiveFrom, setArchiveFrom] = useState(monthStartIso());
  const [archiveTo, setArchiveTo] = useState(todayIso());
  const [archiveBusy, setArchiveBusy] = useState<"excel" | "zip" | null>(null);
  const [cleanupFrom, setCleanupFrom] = useState(monthStartIso());
  const [cleanupTo, setCleanupTo] = useState(todayIso());
  const [includeInvoices, setIncludeInvoices] = useState(false);
  const [purgePreview, setPurgePreview] = useState<PurgePreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);

  useEffect(() => {
    void fetchStorageStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, [orders.length, pickupRecords.length, packRecords.length, invoiceRecords.length]);

  const counts = [
    { label: t("data.groups"), value: groups.length },
    { label: t("nav.ingredients"), value: ingredients.length },
    { label: t("nav.buyers"), value: buyers.length },
    { label: t("nav.orders"), value: orders.length },
    { label: t("nav.pickups"), value: pickupRecords.length },
    { label: t("nav.packing"), value: packRecords.length },
    { label: t("data.invoiceRecords"), value: invoiceRecords.length },
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
                {t(roleLabelKey(user.role))}
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

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <div className="space-y-4">
      <Card className="mb-4 lg:mb-0">
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

      <Card className="mb-4 lg:mb-0">
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

      <Card className="mb-4 lg:mb-0">
        <p className="text-sm font-medium text-[var(--muted)]">
          {t("data.archiveTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          {t("data.archiveHint")}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("summary.from")}>
            <TextInput
              type="date"
              value={archiveFrom}
              onChange={(event) => setArchiveFrom(event.target.value)}
            />
          </Field>
          <Field label={t("summary.to")}>
            <TextInput
              type="date"
              value={archiveTo}
              onChange={(event) => setArchiveTo(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <PrimaryButton
            disabled={archiveBusy !== null}
            onClick={() => {
              const start = archiveFrom <= archiveTo ? archiveFrom : archiveTo;
              const end = archiveFrom <= archiveTo ? archiveTo : archiveFrom;
              setArchiveBusy("excel");
              void exportReadableExcel(useAppStore.getState(), start, end, locale)
                .then(() =>
                  flash({ type: "ok", message: t("data.archiveExported") }),
                )
                .catch((error) =>
                  flash({ type: "error", message: String(error) }),
                )
                .finally(() => setArchiveBusy(null));
            }}
          >
            {archiveBusy === "excel"
              ? t("data.exporting")
              : t("data.exportReadable")}
          </PrimaryButton>
          <GhostButton
            disabled={archiveBusy !== null}
            onClick={() => {
              const start = archiveFrom <= archiveTo ? archiveFrom : archiveTo;
              const end = archiveFrom <= archiveTo ? archiveTo : archiveFrom;
              setArchiveBusy("zip");
              void exportArchiveZip(useAppStore.getState(), start, end, locale)
                .then(() =>
                  flash({ type: "ok", message: t("data.archiveExported") }),
                )
                .catch((error) =>
                  flash({ type: "error", message: String(error) }),
                )
                .finally(() => setArchiveBusy(null));
            }}
          >
            {archiveBusy === "zip"
              ? t("data.exporting")
              : t("data.exportArchiveZip")}
          </GhostButton>
        </div>
      </Card>
        </div>

        <div className="space-y-4">
      <Card className="mb-4 lg:mb-0">
        <p className="text-sm font-medium text-[var(--muted)]">
          {t("data.cleanupTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          {t("data.cleanupHint")}
        </p>
        {stats ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {t("data.storageStats", {
              db: formatBytes(stats.dbBytes),
              images: formatBytes(stats.imageBytes),
              count: stats.imageCount,
            })}
          </p>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("summary.from")}>
            <TextInput
              type="date"
              value={cleanupFrom}
              onChange={(event) => {
                setCleanupFrom(event.target.value);
                setPurgePreview(null);
              }}
            />
          </Field>
          <Field label={t("summary.to")}>
            <TextInput
              type="date"
              value={cleanupTo}
              onChange={(event) => {
                setCleanupTo(event.target.value);
                setPurgePreview(null);
              }}
            />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={includeInvoices}
            onChange={(event) => {
              setIncludeInvoices(event.target.checked);
              setPurgePreview(null);
            }}
          />
          {t("data.cleanupIncludeInvoices")}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <GhostButton
            disabled={previewBusy}
            onClick={() => {
              const start = cleanupFrom <= cleanupTo ? cleanupFrom : cleanupTo;
              const end = cleanupFrom <= cleanupTo ? cleanupTo : cleanupFrom;
              setPreviewBusy(true);
              void previewPurge(start, end, includeInvoices)
                .then(setPurgePreview)
                .catch((error) =>
                  flash({ type: "error", message: String(error) }),
                )
                .finally(() => setPreviewBusy(false));
            }}
          >
            {previewBusy ? t("common.loading") : t("data.cleanupPreview")}
          </GhostButton>
          {purgePreview ? (
            <GhostButton danger onClick={() => setCleanupOpen(true)}>
              {t("data.cleanupStart")}
            </GhostButton>
          ) : null}
        </div>
        {purgePreview ? (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--bg)] p-3 text-xs text-[var(--muted)] sm:grid-cols-3">
            <span>{t("data.cleanupOrders", { count: purgePreview.orders })}</span>
            <span>{t("data.cleanupPickups", { count: purgePreview.pickups })}</span>
            <span>{t("data.cleanupPacks", { count: purgePreview.packs })}</span>
            <span>{t("data.cleanupInvoices", { count: purgePreview.invoices })}</span>
            <span>{t("data.cleanupPhotos", { count: purgePreview.photos })}</span>
            <span>
              {t("data.cleanupBytes", { size: formatBytes(purgePreview.bytes) })}
            </span>
          </div>
        ) : null}
      </Card>

      <Card className="mb-4 lg:mb-0">
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
            className="min-h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
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
            className="min-h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
          >
            {FONT_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="mb-4 lg:mb-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--muted)]">
              {t("invoice.settings")}
            </p>
            <p className="mt-1 truncate text-sm">{invoice.companyName}</p>
          </div>
          <GhostButton onClick={() => setInvoiceOpen(true)}>
            {t("invoice.editSettings")}
          </GhostButton>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          {t("invoice.hint")}
        </p>
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
      </div>
      </div>

      {cleanupOpen && purgePreview ? (
        <PurgeSheet
          preview={purgePreview}
          onClose={() => setCleanupOpen(false)}
          onConfirm={async () => {
            await purgeData({
              from: purgePreview.from,
              to: purgePreview.to,
              includeInvoices,
              confirm: "DELETE",
            });
            setCleanupOpen(false);
            setPurgePreview(null);
            flash({ type: "ok", message: t("data.cleanupDone") });
            setStats(await fetchStorageStats().catch(() => null));
          }}
        />
      ) : null}

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

      {invoiceOpen ? (
        <InvoiceSettingsSheet
          initial={invoice}
          onClose={() => setInvoiceOpen(false)}
          onSave={async (next) => {
            await setInvoiceSettings(next);
            flash({ type: "ok", message: t("common.saved") });
            setInvoiceOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PurgeSheet({
  preview,
  onClose,
  onConfirm,
}: {
  preview: PurgePreview;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canConfirm = checked && word.trim().toUpperCase() === "DELETE";

  return (
    <Sheet title={t("data.cleanupConfirmTitle")} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-600">
          {t("data.cleanupWarning")}
        </p>
        <ul className="space-y-1 rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm text-[var(--muted)]">
          <li>{t("data.cleanupOrders", { count: preview.orders })}</li>
          <li>{t("data.cleanupPickups", { count: preview.pickups })}</li>
          <li>{t("data.cleanupPacks", { count: preview.packs })}</li>
          <li>{t("data.cleanupInvoices", { count: preview.invoices })}</li>
          <li>{t("data.cleanupPhotos", { count: preview.photos })}</li>
          <li>{t("data.cleanupBytes", { size: formatBytes(preview.bytes) })}</li>
        </ul>
        <label className="flex items-start gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>{t("data.cleanupExported")}</span>
        </label>
        <Field label={t("data.cleanupTypeDelete")}>
          <TextInput
            value={word}
            autoComplete="off"
            placeholder="DELETE"
            onChange={(event) => setWord(event.target.value)}
          />
        </Field>
        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton
            disabled={!canConfirm || busy}
            onClick={() => {
              setError(null);
              setBusy(true);
              void onConfirm()
                .catch((err) => setError(String(err)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? t("data.cleanupBusy") : t("data.cleanupConfirm")}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}

function InvoiceSettingsSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: InvoiceSettings;
  onClose: () => void;
  onSave: (invoice: InvoiceSettings) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<InvoiceSettings>({ ...initial });
  const [busy, setBusy] = useState(false);

  const update = (patch: Partial<InvoiceSettings>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const updateNumber = (
    key: "taxAmount" | "dueDays" | "nextInvoiceNumber",
    value: string,
  ) => {
    const parsed = Number(value);
    setForm((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

  return (
    <Sheet title={t("invoice.settings")} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          void onSave(form).finally(() => setBusy(false));
        }}
      >
        <Field label={t("invoice.companyName")}>
          <TextInput
            value={form.companyName}
            onChange={(e) => update({ companyName: e.target.value })}
          />
        </Field>
        <Field label={t("invoice.tagline")}>
          <TextInput
            value={form.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.phone")}>
            <TextInput
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
            />
          </Field>
          <Field label={t("invoice.abn")}>
            <TextInput
              value={form.abn}
              onChange={(e) => update({ abn: e.target.value })}
            />
          </Field>
        </div>
        <Field label={t("invoice.email")}>
          <TextInput
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label={t("invoice.address")}>
          <TextInput
            value={form.address}
            onChange={(e) => update({ address: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.bankName")}>
            <TextInput
              value={form.bankName}
              onChange={(e) => update({ bankName: e.target.value })}
            />
          </Field>
          <Field label={t("invoice.accountName")}>
            <TextInput
              value={form.accountName}
              onChange={(e) => update({ accountName: e.target.value })}
            />
          </Field>
          <Field label={t("invoice.bsb")}>
            <TextInput
              value={form.bsb}
              onChange={(e) => update({ bsb: e.target.value })}
            />
          </Field>
          <Field label={t("invoice.accountNumber")}>
            <TextInput
              value={form.accountNumber}
              onChange={(e) => update({ accountNumber: e.target.value })}
            />
          </Field>
        </div>

        <Field label={t("invoice.paymentNote")}>
          <TextArea
            rows={3}
            value={form.paymentNote}
            onChange={(e) => update({ paymentNote: e.target.value })}
          />
        </Field>
        <Field label={t("invoice.deliveryNote")}>
          <TextArea
            rows={3}
            value={form.deliveryNote}
            onChange={(e) => update({ deliveryNote: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.currency")}>
            <TextInput
              value={form.currency}
              onChange={(e) => update({ currency: e.target.value })}
            />
          </Field>
          <Field label={t("invoice.taxAmount")} hint={t("common.optional")}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={form.taxAmount}
              onChange={(e) => updateNumber("taxAmount", e.target.value)}
            />
          </Field>
          <Field label={t("invoice.dueDays")}>
            <TextInput
              type="number"
              min="0"
              step="1"
              value={form.dueDays}
              onChange={(e) => updateNumber("dueDays", e.target.value)}
            />
          </Field>
          <Field label={t("invoice.invoicePrefix")}>
            <TextInput
              value={form.invoicePrefix}
              onChange={(e) => update({ invoicePrefix: e.target.value })}
            />
          </Field>
          <Field label={t("invoice.nextInvoiceNumber")}>
            <TextInput
              type="number"
              min="1"
              step="1"
              value={form.nextInvoiceNumber}
              onChange={(e) =>
                updateNumber("nextInvoiceNumber", e.target.value)
              }
            />
          </Field>
        </div>

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

  async function changeRole(user: UserRow, role: UserRole) {
    setError(null);
    try {
      await updateUserRole(user.id, role);
      await reload();
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
                  {t(roleLabelKey(user.role))}
                </p>
                <select
                  value={user.role}
                  onChange={(event) =>
                    void changeRole(user, event.target.value as UserRole)
                  }
                  className="mt-1 min-h-8 rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--ink)]"
                >
                  {ROLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {t(roleLabelKey(item))}
                    </option>
                  ))}
                </select>
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
              className="min-h-10 flex-1 rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
            >
              {ROLE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {t(roleLabelKey(item))}
                </option>
              ))}
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
