import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientPreviewUrl, ingredientThumbUrl } from "../api/db";
import {
  MultiPhotoPicker,
  type DraftPhoto,
} from "../components/MultiPhotoPicker";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SearchInput,
  Sheet,
  TextArea,
  TextInput,
  Thumb,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { monthStartIso, todayIso } from "../utils/format";
import type { PackRecord, PhotoRef } from "../types";

function toDraftPhotos(photos: PhotoRef[]): DraftPhoto[] {
  return photos.map((photo) => ({
    key: photo.id,
    id: photo.id,
    rev: photo.rev,
    previewUrl: ingredientPreviewUrl(photo.id, photo.rev),
  }));
}

export function PackingPage() {
  const { t } = useTranslation();
  const records = useAppStore((s) => s.packRecords);
  const buyers = useAppStore((s) => s.buyers);
  const saveRecord = useAppStore((s) => s.savePackRecord);
  const deleteRecord = useAppStore((s) => s.deletePackRecord);
  const flash = useAppStore((s) => s.flash);
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState<PackRecord | "new" | null>(null);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [keyword, setKeyword] = useState("");

  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return records
      .filter((record) => {
        if (record.date < start || record.date > end) return false;
        if (!needle) return true;
        const buyer = buyers.find((item) => item.id === record.buyerId);
        return [
          record.logistics,
          record.storeName,
          record.note,
          buyer?.name ?? "",
          buyer?.code ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [records, buyers, start, end, keyword]);

  const canEdit = (record: PackRecord) =>
    user?.role === "admin" || record.createdBy === user?.id;

  return (
    <div>
      <PageTitle
        title={t("packing.title")}
        action={
          <PrimaryButton onClick={() => setEditing("new")}>
            {t("packing.add")}
          </PrimaryButton>
        }
      />

      {records.length === 0 ? (
        <EmptyState text={t("packing.empty")} />
      ) : (
        <>
          <Card className="mb-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("summary.from")}>
                <TextInput
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </Field>
              <Field label={t("summary.to")}>
                <TextInput
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </Field>
            </div>
            <SearchInput
              value={keyword}
              onValueChange={setKeyword}
              placeholder={t("packing.searchPlaceholder")}
              clearLabel={t("common.clear")}
            />
            <p className="text-xs text-[var(--muted)]">
              {t("packing.count", { count: filtered.length })}
            </p>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState text={t("packing.noMatch")} />
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
              {filtered.map((record) => {
                const buyer = buyers.find((item) => item.id === record.buyerId);
                return (
                  <Card key={record.id}>
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <Thumb
                          src={
                            record.photos[0]
                              ? ingredientThumbUrl(
                                  record.photos[0].id,
                                  record.photos[0].rev,
                                )
                              : undefined
                          }
                          alt={record.storeName}
                          size={58}
                        />
                        {record.photos.length > 1 ? (
                          <span className="text-[10px] text-[var(--muted)]">
                            {t("packing.photoCount", {
                              count: record.photos.length,
                            })}
                          </span>
                        ) : null}
                        {record.invoicePhotos.length > 0 ? (
                          <span className="rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] text-[var(--brand)]">
                            {t("packing.invoicePhotoCount", {
                              count: record.invoicePhotos.length,
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{record.storeName}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {record.date} · {t("packing.logistics")}:{" "}
                          {record.logistics}
                        </p>
                        {buyer ? (
                          <p className="truncate text-xs text-[var(--ink)]">
                            {t("pickups.buyer")}: {buyer.code || buyer.name}
                          </p>
                        ) : null}
                        {record.note ? (
                          <p className="mt-1 text-sm text-[var(--ink)]">{record.note}</p>
                        ) : null}
                        {user?.role === "admin" ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {t("pickups.createdBy", { name: record.createdByName })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {canEdit(record) ? (
                          <>
                            <GhostButton onClick={() => setEditing(record)}>
                              {t("common.edit")}
                            </GhostButton>
                            <GhostButton
                              danger
                              onClick={() => {
                                if (!window.confirm(t("packing.deleteConfirm"))) return;
                                void deleteRecord(record.id)
                                  .then(() =>
                                    flash({
                                      type: "ok",
                                      message: t("packing.deleted"),
                                    }),
                                  )
                                  .catch((error) =>
                                    flash({ type: "error", message: String(error) }),
                                  );
                              }}
                            >
                              {t("common.delete")}
                            </GhostButton>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing ? (
        <PackingSheet
          initial={editing === "new" ? null : editing}
          buyers={buyers}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            await saveRecord(input);
            flash({ type: "ok", message: t("packing.saved") });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function PackingSheet({
  initial,
  buyers,
  onClose,
  onSave,
}: {
  initial: PackRecord | null;
  buyers: ReturnType<typeof useAppStore.getState>["buyers"];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    date: string;
    logistics: string;
    storeName: string;
    note: string;
    buyerId?: string;
    photos: {
      id: string;
      rev: number;
      preview?: string;
      thumb?: string;
    }[];
    invoicePhotos: {
      id: string;
      rev: number;
      preview?: string;
      thumb?: string;
    }[];
  }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const flash = useAppStore((s) => s.flash);
  const [id] = useState(initial?.id ?? `pack-${crypto.randomUUID()}`);
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [logistics, setLogistics] = useState(initial?.logistics ?? "");
  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [buyerId, setBuyerId] = useState(initial?.buyerId ?? "");
  const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
    toDraftPhotos(initial?.photos ?? []),
  );
  const [invoicePhotos, setInvoicePhotos] = useState<DraftPhoto[]>(() =>
    toDraftPhotos(initial?.invoicePhotos ?? []),
  );
  const [busy, setBusy] = useState(false);

  const sortedBuyers = [...buyers].sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh"),
  );

  return (
    <Sheet
      title={initial ? t("packing.edit") : t("packing.add")}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!date) {
            flash({ type: "error", message: t("packing.needDate") });
            return;
          }
          if (!logistics.trim()) {
            flash({ type: "error", message: t("packing.needLogistics") });
            return;
          }
          if (!storeName.trim()) {
            flash({ type: "error", message: t("packing.needStore") });
            return;
          }
          if (photos.length === 0) {
            flash({ type: "error", message: t("packing.needPhoto") });
            return;
          }
          if (!initial && invoicePhotos.length === 0) {
            flash({ type: "error", message: t("packing.needInvoicePhoto") });
            return;
          }
          setBusy(true);
          void onSave({
            id,
            date,
            logistics: logistics.trim(),
            storeName: storeName.trim(),
            note: note.trim(),
            buyerId: buyerId || undefined,
            photos: photos.map((photo) => ({
              id: photo.id,
              rev: photo.rev,
              preview: photo.previewBase64,
              thumb: photo.thumbBase64,
            })),
            invoicePhotos: invoicePhotos.map((photo) => ({
              id: photo.id,
              rev: photo.rev,
              preview: photo.previewBase64,
              thumb: photo.thumbBase64,
            })),
          }).finally(() => setBusy(false));
        }}
      >
        <Field label={t("packing.date")}>
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label={t("packing.logistics")} hint={t("common.required")}>
          <TextInput
            value={logistics}
            onChange={(event) => setLogistics(event.target.value)}
          />
        </Field>
        <Field label={t("packing.storeName")} hint={t("common.required")}>
          <TextInput
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
          />
        </Field>
        <Field label={t("pickups.buyer")} hint={t("common.optional")}>
          <select
            value={buyerId}
            onChange={(event) => setBuyerId(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
          >
            <option value="">{t("pickups.noBuyer")}</option>
            {sortedBuyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.code || buyer.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("packing.photos")} hint={t("common.required")}>
          <MultiPhotoPicker
            photos={photos}
            nextId={() => `${id}-photo-${crypto.randomUUID()}`}
            onAdd={(photo) => setPhotos((prev) => [...prev, photo])}
            onRemove={(key) =>
              setPhotos((prev) => prev.filter((photo) => photo.key !== key))
            }
            onError={(error) =>
              flash({
                type: "error",
                message:
                  error.message === "too-large"
                    ? t("packing.tooLarge")
                    : t("packing.unsupported"),
              })
            }
            labels={{
              add: t("packing.addPhotos"),
              busy: t("packing.compressing"),
              remove: t("common.delete"),
              hint: t("packing.multiPhotoHint"),
            }}
          />
        </Field>
        <Field
          label={t("packing.invoicePhotos")}
          hint={initial ? t("common.optional") : t("common.required")}
        >
          <MultiPhotoPicker
            photos={invoicePhotos}
            nextId={() => `${id}-invoice-${crypto.randomUUID()}`}
            onAdd={(photo) => setInvoicePhotos((prev) => [...prev, photo])}
            onRemove={(key) =>
              setInvoicePhotos((prev) =>
                prev.filter((photo) => photo.key !== key),
              )
            }
            onError={(error) =>
              flash({
                type: "error",
                message:
                  error.message === "too-large"
                    ? t("packing.tooLarge")
                    : t("packing.unsupported"),
              })
            }
            labels={{
              add: t("packing.addInvoicePhotos"),
              busy: t("packing.compressing"),
              remove: t("common.delete"),
              hint: t("packing.invoicePhotoHint"),
            }}
          />
        </Field>
        <Field label={t("packing.note")} hint={t("common.optional")}>
          <TextArea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? t("common.saving") : t("common.save")}
          </PrimaryButton>
        </div>
      </form>
    </Sheet>
  );
}
