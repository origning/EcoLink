import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { fetchBackup, putBackup } from "../api/db";
import { Card, PageTitle, PrimaryButton } from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { todayIso } from "../utils/format";
import type { BackupFile } from "../types";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const counts = [
    { label: t("data.groups"), value: groups.length },
    { label: t("nav.ingredients"), value: ingredients.length },
    { label: t("nav.buyers"), value: buyers.length },
    { label: t("nav.orders"), value: orders.length },
  ];

  return (
    <div>
      <PageTitle title={t("data.title")} />

      <Card className="mb-4">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {storageKind === "device" ? t("data.storageDevice") : t("data.storageFiles")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{t("data.hint")}</p>
        {storageKind === "device" ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {t("data.addToHome")}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {t("data.phoneHint")}
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <p className="mb-3 text-sm font-medium text-[var(--muted)]">{t("data.counts")}</p>
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
  );
}
