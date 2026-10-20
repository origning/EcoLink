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
import {
  invoiceIsOverdue,
  invoiceOutstanding,
  invoicePaidAmount,
  invoicePaymentStatus,
} from "../utils/payments";
import type { InvoiceRecord, PackRecord, PhotoRef } from "../types";

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
  const invoices = useAppStore((s) => s.invoiceRecords);
  const saveRecord = useAppStore((s) => s.savePackRecord);
  const deleteRecord = useAppStore((s) => s.deletePackRecord);
  const flash = useAppStore((s) => s.flash);
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState<PackRecord | "new" | null>(null);
  const [mode, setMode] = useState<"single" | "range">("range");
  const [day, setDay] = useState(todayIso());
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [keyword, setKeyword] = useState("");
  const today = todayIso();

  const invoiceMap = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  const recordInvoices = (record: PackRecord) =>
    record.invoiceIds
      .map((id) => invoiceMap.get(id))
      .filter((invoice): invoice is InvoiceRecord => Boolean(invoice));

  const start = mode === "single" ? day : from <= to ? from : to;
  const end = mode === "single" ? day : from <= to ? to : from;
  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return records
      .filter((record) => {
        if (record.date < start || record.date > end) return false;
        if (!needle) return true;
        const buyer = buyers.find((item) => item.id === record.buyerId);
        const linked = recordInvoices(record);
        return [
          record.logistics,
          record.trackingNo,
          record.storeName,
          record.note,
          buyer?.name ?? "",
          buyer?.code ?? "",
          ...linked.map((invoice) => invoice.invoiceNo),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, buyers, invoices, start, end, keyword]);

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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-0.5">
                {(["single", "range"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`min-h-8 rounded-[7px] px-4 py-1 text-xs font-semibold transition ${
                      mode === item
                        ? "bg-[var(--ink)] text-white shadow-[var(--shadow-xs)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {t(`summary.${item}`)}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[var(--muted)]">
                {t("packing.count", { count: filtered.length })}
              </span>
            </div>
            {mode === "single" ? (
              <Field label={t("packing.date")}>
                <TextInput
                  type="date"
                  value={day}
                  onChange={(event) => setDay(event.target.value)}
                />
              </Field>
            ) : (
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
            )}
            <SearchInput
              value={keyword}
              onValueChange={setKeyword}
              placeholder={t("packing.searchPlaceholder")}
              clearLabel={t("common.clear")}
            />
          </Card>

          {filtered.length === 0 ? (
            <EmptyState text={t("packing.noMatch")} />
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
              {filtered.map((record) => {
                const buyer = buyers.find((item) => item.id === record.buyerId);
                const linked = recordInvoices(record);
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
                          {record.trackingNo
                            ? ` · ${record.trackingNo}`
                            : ""}
                        </p>
                        {buyer ? (
                          <p className="truncate text-xs text-[var(--ink)]">
                            {t("pickups.buyer")}: {buyer.code || buyer.name}
                          </p>
                        ) : null}
                        {record.note ? (
                          <p className="mt-1 text-sm text-[var(--ink)]">{record.note}</p>
                        ) : null}
                        <div className="mt-2 space-y-1">
                          {linked.length === 0 ? (
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              {t("packing.pendingInvoice")}
                            </span>
                          ) : (
                            linked.map((invoice) => {
                              const status = invoicePaymentStatus(invoice);
                              const overdue = invoiceIsOverdue(invoice, today);
                              return (
                                <div
                                  key={invoice.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--bg)] px-2 py-1.5 text-xs"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {invoice.invoiceNo} ·{" "}
                                      {invoice.snapshot.total.toLocaleString()}
                                    </p>
                                    <p className="text-[var(--muted)]">
                                      {t("packing.received")}{" "}
                                      {invoicePaidAmount(invoice).toLocaleString()}{" "}
                                      · {t("packing.unreceived")}{" "}
                                      {invoiceOutstanding(invoice).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                        overdue
                                          ? "bg-red-100 text-red-700"
                                          : status === "paid"
                                            ? "bg-emerald-50 text-emerald-700"
                                            : status === "partial"
                                              ? "bg-amber-50 text-amber-700"
                                              : "bg-red-50 text-red-600"
                                      }`}
                                    >
                                      {overdue
                                        ? t("pickups.statusOverdue")
                                        : status === "paid"
                                          ? t("pickups.statusPaid")
                                          : status === "partial"
                                            ? t("pickups.statusPartial")
                                            : t("pickups.statusUnpaid")}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
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
          invoices={invoices}
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
  invoices,
  onClose,
  onSave,
}: {
  initial: PackRecord | null;
  buyers: ReturnType<typeof useAppStore.getState>["buyers"];
  invoices: InvoiceRecord[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    date: string;
    logistics: string;
    trackingNo: string;
    storeName: string;
    note: string;
    buyerId?: string;
    invoiceIds: string[];
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
  const [trackingNo, setTrackingNo] = useState(initial?.trackingNo ?? "");
  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [buyerId, setBuyerId] = useState(initial?.buyerId ?? "");
  const [invoiceIds, setInvoiceIds] = useState<string[]>(
    initial?.invoiceIds ?? [],
  );
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
  const buyerInvoices = invoices
    .filter((invoice) => invoice.buyerId === buyerId)
    .sort((a, b) => b.createdAt - a.createdAt);

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
          if (!buyerId) {
            flash({ type: "error", message: t("packing.needBuyer") });
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
            trackingNo: trackingNo.trim(),
            storeName: storeName.trim(),
            note: note.trim(),
            buyerId: buyerId || undefined,
            invoiceIds,
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
        <Field label={t("packing.trackingNo")} hint={t("common.optional")}>
          <TextInput
            value={trackingNo}
            onChange={(event) => setTrackingNo(event.target.value)}
          />
        </Field>
        <Field label={t("packing.storeName")} hint={t("common.required")}>
          <TextInput
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
          />
        </Field>
        <Field label={t("pickups.buyer")} hint={t("common.required")}>
          <select
            value={buyerId}
            onChange={(event) => {
              const nextBuyerId = event.target.value;
              setBuyerId(nextBuyerId);
              setInvoiceIds((prev) =>
                prev.filter(
                  (id) =>
                    invoices.find((invoice) => invoice.id === id)?.buyerId ===
                    nextBuyerId,
                ),
              );
            }}
            className="min-h-10 w-full rounded-[10px] border border-[var(--line)] bg-white px-3 py-2 text-base text-[var(--ink)] sm:text-sm"
          >
            <option value="">{t("pickups.noBuyer")}</option>
            {sortedBuyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.code || buyer.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-[var(--muted)]">
            {t("packing.invoices")}{" "}
            <span className="text-xs font-normal">
              {t("packing.invoiceLinkHint")}
            </span>
          </span>
          {!buyerId ? (
            <p className="text-xs text-[var(--muted)]">
              {t("packing.selectBuyerFirst")}
            </p>
          ) : buyerInvoices.length === 0 ? (
            <p className="text-xs text-amber-700">
              {t("packing.noInvoicesForBuyer")}
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-2">
              {buyerInvoices.map((invoice) => {
                const checked = invoiceIds.includes(invoice.id);
                return (
                  <li key={invoice.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-2 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={checked}
                        onChange={() =>
                          setInvoiceIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== invoice.id)
                              : [...prev, invoice.id],
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {invoice.invoiceNo} · {invoice.snapshot.total.toLocaleString()}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {invoiceOutstanding(invoice) > 0
                          ? `${t("packing.unreceived")} ${invoiceOutstanding(
                              invoice,
                            ).toLocaleString()}`
                          : t("pickups.statusPaid")}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {buyerId && invoiceIds.length === 0 ? (
            <p className="text-xs text-amber-700">
              {t("packing.pendingInvoiceHint")}
            </p>
          ) : null}
        </div>
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
