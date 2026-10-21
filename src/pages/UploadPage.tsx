import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Sheet,
  TextInput,
} from "../components/ui";
import {
  MultiPhotoPicker,
  type DraftPhoto,
} from "../components/MultiPhotoPicker";
import { useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { ingredientPreviewUrl } from "../api/db";
import { todayIso } from "../utils/format";
import type { PackRecord, PickupRecord, PhotoRef } from "../types";

function toDraftPhotos(photos: PhotoRef[]): DraftPhoto[] {
  return photos.map((photo) => ({
    key: photo.id,
    id: photo.id,
    rev: photo.rev,
    previewUrl: ingredientPreviewUrl(photo.id, photo.rev),
    isPdf: photo.id.endsWith("-pdf"),
  }));
}

type UploadKind = "pickup" | "pack";

export function UploadPage() {
  const { t } = useTranslation();
  const pickups = useAppStore((s) => s.pickupRecords);
  const packs = useAppStore((s) => s.packRecords);
  const stores = useAppStore((s) => s.stores);
  const savePickup = useAppStore((s) => s.savePickupRecord);
  const savePack = useAppStore((s) => s.savePackRecord);
  const deletePickup = useAppStore((s) => s.deletePickupRecord);
  const deletePack = useAppStore((s) => s.deletePackRecord);
  const flash = useAppStore((s) => s.flash);
  const user = useAuthStore((s) => s.user);
  const [kind, setKind] = useState<UploadKind>("pickup");
  const [editing, setEditing] = useState<
    PickupRecord | PackRecord | "new" | null
  >(null);

  const ownPickups = useMemo(
    () =>
      pickups
        .filter((record) => record.createdBy === user?.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [pickups, user?.id],
  );
  const ownPacks = useMemo(
    () =>
      packs
        .filter((record) => record.createdBy === user?.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [packs, user?.id],
  );

  const records = kind === "pickup" ? ownPickups : ownPacks;

  return (
    <div>
      <PageTitle
        title={t("upload.title")}
        action={
          <PrimaryButton onClick={() => setEditing("new")}>
            {kind === "pickup" ? t("upload.addPickup") : t("upload.addPack")}
          </PrimaryButton>
        }
      />

      <div className="mb-4 inline-flex rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-0.5">
        {(["pickup", "pack"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            className={`min-h-8 rounded-[7px] px-4 py-1 text-xs font-semibold transition ${
              kind === item
                ? "bg-[var(--ink)] text-white"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {item === "pickup" ? t("upload.pickupPhotos") : t("upload.packPhotos")}
          </button>
        ))}
      </div>

      {records.length === 0 ? (
        <EmptyState text={t("upload.empty")} />
      ) : (
        <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
          {records.map((record) => {
            const isPickup = kind === "pickup";
            const pickup = isPickup ? (record as PickupRecord) : null;
            const pack = isPickup ? null : (record as PackRecord);
            const pending = isPickup
              ? !pickup?.storeName || pickup.amount <= 0
              : !pack?.buyerId || !pack.logistics || pack.invoiceIds.length === 0;
            return (
              <Card key={record.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{record.date}</p>
                    {isPickup && pickup?.storeName ? (
                      <p className="mt-0.5 text-sm font-medium">
                        {t("upload.supplier")}: {pickup.storeName}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {t("upload.photoCount", { count: record.photos.length })}
                      {isPickup && pickup && pickup.invoicePhotos.length > 0
                        ? ` · ${t("upload.invoicePhotoCount", {
                            count: pickup.invoicePhotos.length,
                          })}`
                        : ""}
                    </p>
                    {record.note ? (
                      <p className="mt-1 text-sm text-[var(--ink)]">
                        {record.note}
                      </p>
                    ) : null}
                    {isPickup && pickup && pickup.invoicePhotos.length === 0 ? (
                      <span className="mt-1 mr-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        {t("upload.noInvoice")}
                      </span>
                    ) : null}
                    {pending ? (
                      <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {t("upload.pendingReview")}
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {t("upload.reviewed")}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <GhostButton onClick={() => setEditing(record)}>
                      {t("common.edit")}
                    </GhostButton>
                    <GhostButton
                      danger
                      onClick={() => {
                        if (!window.confirm(t("upload.deleteConfirm"))) return;
                        const action = isPickup
                          ? deletePickup(record.id)
                          : deletePack(record.id);
                        void action
                          .then(() =>
                            flash({ type: "ok", message: t("common.deleted") }),
                          )
                          .catch((error) =>
                            flash({
                              type: "error",
                              message: String(error),
                            }),
                          );
                      }}
                    >
                      {t("common.delete")}
                    </GhostButton>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {editing ? (
        <UploadSheet
          key={editing === "new" ? "new" : editing.id}
          kind={kind}
          initial={editing === "new" ? null : editing}
          suppliers={stores.map((store) => store.name)}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            if (kind === "pickup") {
              const existing =
                editing === "new" ? null : (editing as PickupRecord | null);
              await savePickup({
                id: existing?.id ?? input.id,
                date: input.date,
                storeName: input.storeName,
                tax: existing?.tax ?? 0,
                amount: existing?.amount ?? 0,
                note: input.note,
                buyerId: existing?.buyerId,
                photos: input.photos,
                invoicePhotos: input.invoicePhotos,
              });
            } else {
              const existing =
                editing === "new" ? null : (editing as PackRecord | null);
              await savePack({
                id: existing?.id ?? input.id,
                date: input.date,
                logistics: existing?.logistics ?? "",
                trackingNo: existing?.trackingNo ?? "",
                storeName: existing?.storeName ?? "",
                note: input.note,
                buyerId: existing?.buyerId,
                invoiceIds: existing?.invoiceIds ?? [],
                photos: input.photos,
                invoicePhotos: existing?.invoicePhotos ?? [],
              });
            }
            flash({ type: "ok", message: t("upload.saved") });
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function UploadSheet({
  kind,
  initial,
  suppliers,
  onClose,
  onSave,
}: {
  kind: UploadKind;
  initial: PickupRecord | PackRecord | null;
  suppliers: string[];
  onClose: () => void;
  onSave: (input: {
    id: string;
    date: string;
    storeName: string;
    note: string;
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
  const [id] = useState(
    initial?.id ??
      (kind === "pickup"
        ? `pickup-${crypto.randomUUID()}`
        : `pack-${crypto.randomUUID()}`),
  );
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [storeName, setStoreName] = useState(
    kind === "pickup" && initial
      ? (initial as PickupRecord).storeName
      : "",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
    toDraftPhotos(initial?.photos ?? []),
  );
  const pickup =
    kind === "pickup" && initial ? (initial as PickupRecord) : null;
  const [invoicePhotos, setInvoicePhotos] = useState<DraftPhoto[]>(() =>
    toDraftPhotos(pickup?.invoicePhotos ?? []),
  );
  const [busy, setBusy] = useState(false);

  return (
    <Sheet
      title={
        kind === "pickup" ? t("upload.addPickup") : t("upload.addPack")
      }
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!date) {
            flash({ type: "error", message: t("upload.needDate") });
            return;
          }
          if (kind === "pickup" && !storeName.trim()) {
            flash({ type: "error", message: t("upload.needSupplier") });
            return;
          }
          setBusy(true);
          void onSave({
            id,
            date,
            storeName: storeName.trim(),
            note: note.trim(),
            photos: photos.map((photo) => ({
              id: photo.id,
              rev: photo.rev,
              preview: photo.previewBase64,
              thumb: photo.thumbBase64,
            })),
            invoicePhotos:
              kind === "pickup"
                ? invoicePhotos.map((photo) => ({
                    id: photo.id,
                    rev: photo.rev,
                    preview: photo.previewBase64,
                    thumb: photo.thumbBase64,
                  }))
                : [],
          }).finally(() => setBusy(false));
        }}
      >
        <Field label={t("upload.date")} hint={t("common.required")}>
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        {kind === "pickup" ? (
          <Field label={t("upload.supplier")} hint={t("common.required")}>
            <TextInput
              list="upload-supplier-options"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
            />
            <datalist id="upload-supplier-options">
              {suppliers.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
        ) : null}
        <Field
          label={
            kind === "pickup" ? t("upload.pickupPhotos") : t("upload.packPhotos")
          }
          hint={t("common.optional")}
        >
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
                    ? t("upload.tooLarge")
                    : t("upload.unsupported"),
              })
            }
            labels={{
              add: t("upload.addPhotos"),
              busy: t("upload.compressing"),
              remove: t("common.delete"),
              hint: t("upload.multiPhotoHint"),
            }}
          />
        </Field>
        {kind === "pickup" ? (
          <Field label={t("upload.pickupInvoicePhotos")} hint={t("common.optional")}>
            <MultiPhotoPicker
              photos={invoicePhotos}
              nextId={() => `${id}-invoice-${crypto.randomUUID()}`}
              onAdd={(photo) =>
                setInvoicePhotos((prev) => [...prev, photo])
              }
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
                      ? t("upload.tooLarge")
                      : t("upload.unsupported"),
                })
              }
              labels={{
                add: t("upload.addInvoicePhotos"),
                busy: t("upload.compressing"),
                remove: t("common.delete"),
                hint: t("upload.pickupInvoiceHint"),
              }}
            />
          </Field>
        ) : (
          <p className="rounded-2xl bg-[var(--bg)] px-3 py-2 text-xs text-[var(--muted)]">
            {t("upload.dispatchInvoiceLater")}
          </p>
        )}
        <Field label={t("upload.note")} hint={t("common.optional")}>
          <TextInput
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
