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
  pickupDueDate,
  pickupIsOverdue,
  pickupOutstanding,
  pickupPaidAmount,
  pickupPaymentStatus,
  storeForRecord,
} from "../utils/payments";
import type { PhotoRef, PickupRecord, Store } from "../types";

function toDraftPhotos(photos: PhotoRef[]): DraftPhoto[] {
  return photos.map((photo) => ({
    key: photo.id,
    id: photo.id,
    rev: photo.rev,
    previewUrl: ingredientPreviewUrl(photo.id, photo.rev),
  }));
}

export function PickupPage() {
  const { t } = useTranslation();
  const records = useAppStore((s) => s.pickupRecords);
  const buyers = useAppStore((s) => s.buyers);
  const stores = useAppStore((s) => s.stores);
  const saveRecord = useAppStore((s) => s.savePickupRecord);
  const addPayment = useAppStore((s) => s.addPickupPayment);
  const voidPayment = useAppStore((s) => s.voidPickupPayment);
  const deleteRecord = useAppStore((s) => s.deletePickupRecord);
  const saveStore = useAppStore((s) => s.saveStore);
  const deleteStore = useAppStore((s) => s.deleteStore);
  const flash = useAppStore((s) => s.flash);
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState<PickupRecord | "new" | null>(null);
  const [paymentTargetId, setPaymentTargetId] = useState<string | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);
  const [payFilter, setPayFilter] = useState<
    "all" | "unpaid" | "partial" | "paid" | "overdue"
  >("all");
  const [mode, setMode] = useState<"single" | "range">("range");
  const [day, setDay] = useState(todayIso());
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [keyword, setKeyword] = useState("");

  const start = mode === "single" ? day : from <= to ? from : to;
  const end = mode === "single" ? day : from <= to ? to : from;
  const today = todayIso();
  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return records
      .filter((record) => {
        if (record.date < start || record.date > end) return false;
        if (payFilter === "overdue") {
          if (
            !pickupIsOverdue(record, storeForRecord(record, stores), today)
          ) {
            return false;
          }
        } else if (
          payFilter !== "all" &&
          pickupPaymentStatus(record) !== payFilter
        ) {
          return false;
        }
        if (!needle) return true;
        const buyer = buyers.find((item) => item.id === record.buyerId);
        return [record.storeName, record.note, buyer?.name ?? "", buyer?.code ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
      );
  }, [records, buyers, stores, start, end, keyword, payFilter, today]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, record) => {
        const paid = pickupPaidAmount(record);
        acc.amount += record.amount;
        acc.tax += record.tax;
        acc.paid += paid;
        acc.unpaid += Math.max(0, record.amount - paid);
        if (pickupIsOverdue(record, storeForRecord(record, stores), today)) {
          acc.overdue += Math.max(0, record.amount - paid);
        }
        return acc;
      },
      { amount: 0, tax: 0, paid: 0, unpaid: 0, overdue: 0 },
    );
  }, [filtered, stores, today]);

  const paymentTarget =
    records.find((record) => record.id === paymentTargetId) ?? null;

  const canEdit = (record: PickupRecord) =>
    user?.role === "admin" || record.createdBy === user?.id;

  return (
    <div>
      <PageTitle
        title={t("pickups.title")}
        action={
          <div className="flex flex-wrap justify-end gap-1">
            {user?.role === "admin" ? (
              <GhostButton onClick={() => setStoresOpen(true)}>
                {t("pickups.manageStores")}
              </GhostButton>
            ) : null}
            <GhostButton onClick={() => setSettleOpen(true)}>
              {t("pickups.batchSettle")}
            </GhostButton>
            <PrimaryButton onClick={() => setEditing("new")}>
              {t("pickups.add")}
            </PrimaryButton>
          </div>
        }
      />

      {records.length === 0 ? (
        <EmptyState text={t("pickups.empty")} />
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
                {t("pickups.count", { count: filtered.length })}
              </span>
            </div>
            {mode === "single" ? (
              <Field label={t("pickups.date")}>
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
              placeholder={t("pickups.searchPlaceholder")}
              clearLabel={t("common.clear")}
            />
            <Field label={t("pickups.paymentFilter")}>
              <select
                value={payFilter}
                onChange={(event) =>
                  setPayFilter(
                    event.target.value as
                      | "all"
                      | "unpaid"
                      | "partial"
                      | "paid",
                  )
                }
                className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
              >
                <option value="all">{t("pickups.paymentAll")}</option>
                <option value="unpaid">{t("pickups.statusUnpaid")}</option>
                <option value="partial">{t("pickups.statusPartial")}</option>
                <option value="paid">{t("pickups.statusPaid")}</option>
                <option value="overdue">{t("pickups.statusOverdue")}</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                { label: t("pickups.totalAmount"), value: totals.amount },
                { label: t("pickups.totalPaid"), value: totals.paid },
                { label: t("pickups.totalUnpaid"), value: totals.unpaid },
                { label: t("pickups.totalOverdue"), value: totals.overdue },
                { label: t("pickups.totalTax"), value: totals.tax },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-[var(--bg)] px-3 py-2"
                >
                  <p className="text-xs text-[var(--muted)]">{item.label}</p>
                  <p className="mt-0.5 text-base font-semibold">
                    {item.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {filtered.length === 0 ? (
            <EmptyState text={t("pickups.noMatch")} />
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
              {filtered.map((record) => {
                const buyer = buyers.find((item) => item.id === record.buyerId);
                const paid = pickupPaidAmount(record);
                const outstanding = pickupOutstanding(record);
                const status = pickupPaymentStatus(record);
                const store = storeForRecord(record, stores);
                const dueDate = pickupDueDate(record, store);
                const overdue = pickupIsOverdue(record, store, today);
                const statusClass =
                  status === "paid"
                    ? "bg-emerald-50 text-emerald-700"
                    : status === "partial"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-600";
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
                            {t("pickups.photoCount", {
                              count: record.photos.length,
                            })}
                          </span>
                        ) : null}
                        {record.invoicePhotos.length > 0 ? (
                          <span className="rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] text-[var(--brand)]">
                            {t("pickups.invoicePhotoCount", {
                              count: record.invoicePhotos.length,
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">
                            {record.storeName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}
                          >
                            {status === "paid"
                              ? t("pickups.statusPaid")
                              : status === "partial"
                                ? t("pickups.statusPartial")
                                : t("pickups.statusUnpaid")}
                          </span>
                          {overdue ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              {t("pickups.statusOverdue")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {record.date} · {t("pickups.tax")} {record.tax} ·{" "}
                          {t("pickups.amount")} {record.amount}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--ink)]">
                          {t("pickups.paid")} {paid.toLocaleString()} ·{" "}
                          {t("pickups.unpaid")} {outstanding.toLocaleString()}
                        </p>
                        {dueDate ? (
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {t("pickups.dueDate")}: {dueDate}
                          </p>
                        ) : null}
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
                            <GhostButton
                              onClick={() => setPaymentTargetId(record.id)}
                            >
                              {outstanding > 0
                                ? t("pickups.addPayment")
                                : t("pickups.paymentRecords")}
                            </GhostButton>
                            <GhostButton onClick={() => setEditing(record)}>
                              {t("common.edit")}
                            </GhostButton>
                            <GhostButton
                              danger
                              onClick={() => {
                                if (!window.confirm(t("pickups.deleteConfirm"))) return;
                                void deleteRecord(record.id)
                                  .then(() =>
                                    flash({ type: "ok", message: t("pickups.deleted") }),
                                  )
                                  .catch((error) =>
                                    flash({
                                      type: "error",
                                      message:
                                        error instanceof Error &&
                                        error.message === "pickup-has-payments"
                                          ? t("pickups.hasPaymentsCannotDelete")
                                          : String(error),
                                    }),
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
        <PickupSheet
          initial={editing === "new" ? null : editing}
          buyers={buyers}
          stores={stores}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              await saveRecord(input);
              flash({ type: "ok", message: t("pickups.saved") });
              setEditing(null);
            } catch (error) {
              flash({
                type: "error",
                message:
                  error instanceof Error &&
                  error.message === "amount-below-paid"
                    ? t("pickups.amountBelowPaid")
                    : String(error),
              });
            }
          }}
        />
      ) : null}

      {paymentTarget ? (
        <PaymentSheet
          record={paymentTarget}
          canVoid={canEdit(paymentTarget)}
          onClose={() => setPaymentTargetId(null)}
          onAdd={async (input) => {
            await addPayment(paymentTarget.id, input);
            flash({ type: "ok", message: t("pickups.paymentSaved") });
            setPaymentTargetId(null);
          }}
          onVoid={async (paymentId) => {
            await voidPayment(paymentTarget.id, paymentId);
            flash({ type: "ok", message: t("pickups.paymentVoided") });
          }}
        />
      ) : null}

      {settleOpen ? (
        <SettlementSheet
          records={records}
          onClose={() => setSettleOpen(false)}
          onSave={async (allocations, input) => {
            for (const allocation of allocations) {
              await addPayment(allocation.recordId, {
                date: input.date,
                amount: allocation.amount,
                method: input.method,
                note: input.note,
              });
            }
            flash({ type: "ok", message: t("pickups.settleSaved") });
            setSettleOpen(false);
          }}
        />
      ) : null}

      {storesOpen ? (
        <StoreSheet
          stores={stores}
          onClose={() => setStoresOpen(false)}
          onSave={async (input) => {
            await saveStore(input);
            flash({ type: "ok", message: t("common.saved") });
          }}
          onDelete={async (id) => {
            await deleteStore(id);
            flash({ type: "ok", message: t("common.deleted") });
          }}
        />
      ) : null}
    </div>
  );
}

function StoreSheet({
  stores,
  onClose,
  onSave,
  onDelete,
}: {
  stores: Store[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    name: string;
    settlementType: Store["settlementType"];
    settlementDay: number;
    dueDays: number;
    contact: string;
    phone: string;
    note: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Store | "new" | null>(null);
  const [name, setName] = useState("");
  const [settlementType, setSettlementType] =
    useState<Store["settlementType"]>("immediate");
  const [settlementDay, setSettlementDay] = useState("31");
  const [dueDays, setDueDays] = useState("0");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (store: Store | "new") => {
    setEditing(store);
    if (store === "new") {
      setName("");
      setSettlementType("immediate");
      setSettlementDay("31");
      setDueDays("0");
      setContact("");
      setPhone("");
      setNote("");
    } else {
      setName(store.name);
      setSettlementType(store.settlementType);
      setSettlementDay(String(store.settlementDay));
      setDueDays(String(store.dueDays));
      setContact(store.contact);
      setPhone(store.phone);
      setNote(store.note);
    }
    setError(null);
  };

  return (
    <Sheet title={t("pickups.manageStores")} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex justify-end">
          <PrimaryButton onClick={() => startEdit("new")}>
            {t("pickups.addStore")}
          </PrimaryButton>
        </div>

        {stores.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {t("pickups.noStores")}
          </p>
        ) : (
          <ul className="space-y-2">
            {stores.map((store) => (
              <li
                key={store.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{store.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {store.settlementType === "monthly"
                      ? t("pickups.settlementMonthly", {
                          day: store.settlementDay,
                        })
                      : store.settlementType === "custom"
                        ? t("pickups.settlementCustom")
                        : t("pickups.settlementImmediate")}
                    {store.dueDays > 0
                      ? ` · ${t("pickups.dueDaysValue", {
                          days: store.dueDays,
                        })}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <GhostButton onClick={() => startEdit(store)}>
                    {t("common.edit")}
                  </GhostButton>
                  <GhostButton
                    danger
                    onClick={() => {
                      if (!window.confirm(t("pickups.storeDeleteConfirm"))) {
                        return;
                      }
                      void onDelete(store.id).catch((err) =>
                        setError(String(err)),
                      );
                    }}
                  >
                    {t("common.delete")}
                  </GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <form
            className="space-y-3 border-t border-[var(--line)] pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) {
                setError(t("pickups.needStoreName"));
                return;
              }
              setError(null);
              setBusy(true);
              void onSave({
                id: editing === "new" ? undefined : editing.id,
                name,
                settlementType,
                settlementDay: Number(settlementDay) || 31,
                dueDays: Number(dueDays) || 0,
                contact,
                phone,
                note,
              })
                .then(() => setEditing(null))
                .catch((err) =>
                  setError(
                    err instanceof Error && err.message === "store-name-taken"
                      ? t("pickups.storeNameTaken")
                      : String(err),
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            <p className="text-sm font-medium text-[var(--muted)]">
              {editing === "new" ? t("pickups.addStore") : t("pickups.editStore")}
            </p>
            <Field label={t("pickups.storeName")}>
              <TextInput
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={t("pickups.settlementType")}>
              <select
                value={settlementType}
                onChange={(event) =>
                  setSettlementType(
                    event.target.value as Store["settlementType"],
                  )
                }
                className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
              >
                <option value="immediate">
                  {t("pickups.settlementImmediate")}
                </option>
                <option value="monthly">
                  {t("pickups.settlementMonthlyOption")}
                </option>
                <option value="custom">{t("pickups.settlementCustom")}</option>
              </select>
            </Field>
            {settlementType === "monthly" ? (
              <Field
                label={t("pickups.settlementDay")}
                hint={t("pickups.settlementDayHint")}
              >
                <TextInput
                  type="number"
                  min="1"
                  max="31"
                  value={settlementDay}
                  onChange={(event) => setSettlementDay(event.target.value)}
                />
              </Field>
            ) : null}
            <Field label={t("pickups.dueDays")} hint={t("common.optional")}>
              <TextInput
                type="number"
                min="0"
                value={dueDays}
                onChange={(event) => setDueDays(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("pickups.contact")} hint={t("common.optional")}>
                <TextInput
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                />
              </Field>
              <Field label={t("pickups.phone")} hint={t("common.optional")}>
                <TextInput
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </Field>
            </div>
            <Field label={t("pickups.note")} hint={t("common.optional")}>
              <TextInput
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </GhostButton>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? t("common.saving") : t("common.save")}
              </PrimaryButton>
            </div>
          </form>
        ) : null}
      </div>
    </Sheet>
  );
}

function SettlementSheet({
  records,
  onClose,
  onSave,
}: {
  records: PickupRecord[];
  onClose: () => void;
  onSave: (
    allocations: { recordId: string; amount: number }[],
    input: { date: string; method: string; note: string },
  ) => Promise<void>;
}) {
  const { t } = useTranslation();
  const stores = useMemo(
    () =>
      [...new Set(records.map((record) => record.storeName.trim()))].filter(
        Boolean,
      ),
    [records],
  );
  const [storeName, setStoreName] = useState(stores[0] ?? "");
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState("bank");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.storeName.trim() === storeName &&
            record.date.startsWith(month) &&
            pickupOutstanding(record) > 0,
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
        ),
    [records, storeName, month],
  );
  const totalOutstanding = pending.reduce(
    (sum, record) => sum + pickupOutstanding(record),
    0,
  );

  const allocations = useMemo(() => {
    let remaining = Number(amount);
    if (!Number.isFinite(remaining) || remaining <= 0) return [];
    return pending.flatMap((record) => {
      if (remaining <= 0) return [];
      const take = Math.min(remaining, pickupOutstanding(record));
      remaining -= take;
      return [{ recordId: record.id, amount: take }];
    });
  }, [amount, pending]);

  return (
    <Sheet title={t("pickups.settleTitle")} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          {t("pickups.settleHint")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("pickups.settleStore")}>
            <select
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              {stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("pickups.settleMonth")}>
            <TextInput
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-[var(--bg)] p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--muted)]">
              {t("pickups.settlePending", { count: pending.length })}
            </span>
            <span className="font-semibold">
              {totalOutstanding.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {t("pickups.settleNoRecords")}
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {pending.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white px-2 py-1.5 text-xs"
                >
                  <span className="truncate">
                    {record.date} · {record.note || record.storeName}
                  </span>
                  <span className="shrink-0 font-medium">
                    {pickupOutstanding(record).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("pickups.paymentDate")}>
            <TextInput
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label={t("pickups.paymentAmount")}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
        </div>
        <Field label={t("pickups.paymentMethod")}>
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
          >
            <option value="bank">{t("pickups.paymentBank")}</option>
            <option value="cash">{t("pickups.paymentCash")}</option>
            <option value="other">{t("pickups.paymentOther")}</option>
          </select>
        </Field>
        <Field label={t("pickups.paymentNote")} hint={t("common.optional")}>
          <TextInput
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>

        {allocations.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--muted)]">
              {t("pickups.settleAllocation")}
            </p>
            <ul className="space-y-1">
              {allocations.map((allocation) => {
                const record = pending.find(
                  (item) => item.id === allocation.recordId,
                );
                return (
                  <li
                    key={allocation.recordId}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[var(--brand-soft)] px-2 py-1.5 text-xs"
                  >
                    <span className="truncate">
                      {record?.date} · {record?.note || record?.storeName}
                    </span>
                    <span className="font-semibold">
                      {allocation.amount.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton
            disabled={busy || pending.length === 0}
            onClick={() => {
              const value = Number(amount);
              if (!Number.isFinite(value) || value <= 0) {
                setError(t("pickups.needPaymentAmount"));
                return;
              }
              if (value > totalOutstanding + 0.0001) {
                setError(t("pickups.paymentOverAmount"));
                return;
              }
              if (allocations.length === 0) {
                setError(t("pickups.settleNoAllocation"));
                return;
              }
              setError(null);
              setBusy(true);
              void onSave(allocations, {
                date,
                method,
                note:
                  note.trim() ||
                  `${t("pickups.batchSettle")} ${month}`,
              }).finally(() => setBusy(false));
            }}
          >
            {busy ? t("common.saving") : t("pickups.settleSave")}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}

function PaymentSheet({
  record,
  canVoid,
  onClose,
  onAdd,
  onVoid,
}: {
  record: PickupRecord;
  canVoid: boolean;
  onClose: () => void;
  onAdd: (input: {
    date: string;
    amount: number;
    method: string;
    note: string;
    proofPhotos: {
      id: string;
      rev: number;
      preview?: string;
      thumb?: string;
    }[];
  }) => Promise<void>;
  onVoid: (paymentId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const paid = pickupPaidAmount(record);
  const outstanding = pickupOutstanding(record);
  const status = pickupPaymentStatus(record);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState(
    outstanding > 0 ? String(outstanding) : "",
  );
  const [method, setMethod] = useState("bank");
  const [note, setNote] = useState("");
  const [proofPhotos, setProofPhotos] = useState<DraftPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title={t("pickups.paymentTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-[var(--bg)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{record.storeName}</p>
            <span className="text-xs text-[var(--muted)]">
              {status === "paid"
                ? t("pickups.statusPaid")
                : status === "partial"
                  ? t("pickups.statusPartial")
                  : t("pickups.statusUnpaid")}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("pickups.amount")} {record.amount.toLocaleString()} ·{" "}
            {t("pickups.paid")} {paid.toLocaleString()} ·{" "}
            {t("pickups.unpaid")} {outstanding.toLocaleString()}
          </p>
        </div>

        {record.payments.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--muted)]">
              {t("pickups.paymentRecords")}
            </p>
            <ul className="space-y-2">
              {record.payments.map((payment) => (
                <li
                  key={payment.id}
                  className={`flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2 ${
                    payment.voidedAt ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    {payment.proofPhotos[0] ? (
                      <Thumb
                        src={ingredientThumbUrl(
                          payment.proofPhotos[0].id,
                          payment.proofPhotos[0].rev,
                        )}
                        alt={t("pickups.paymentProof")}
                        size={36}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p
                        className={`font-medium ${
                          payment.voidedAt ? "line-through" : ""
                        }`}
                      >
                        {payment.date} · {payment.amount.toLocaleString()}
                        {payment.voidedAt ? (
                          <span className="ml-2 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 no-underline">
                            {t("pickups.paymentVoided")}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {[
                          payment.method === "bank"
                            ? t("pickups.paymentBank")
                            : payment.method === "cash"
                              ? t("pickups.paymentCash")
                              : t("pickups.paymentOther"),
                          payment.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  {canVoid && !payment.voidedAt ? (
                    <GhostButton
                      danger
                      onClick={() => {
                        if (!window.confirm(t("pickups.paymentVoidConfirm"))) {
                          return;
                        }
                        void onVoid(payment.id).catch((err) =>
                          setError(String(err)),
                        );
                      }}
                    >
                      {t("pickups.voidPayment")}
                    </GhostButton>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {outstanding > 0 ? (
          <form
            className="space-y-3 border-t border-[var(--line)] pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = Number(amount);
              if (!Number.isFinite(value) || value <= 0) {
                setError(t("pickups.needPaymentAmount"));
                return;
              }
              if (value > outstanding + 0.0001) {
                setError(t("pickups.paymentOverAmount"));
                return;
              }
              setError(null);
              setBusy(true);
              void onAdd({
                date,
                amount: value,
                method,
                note,
                proofPhotos: proofPhotos.map((photo) => ({
                  id: photo.id,
                  rev: photo.rev,
                  preview: photo.previewBase64,
                  thumb: photo.thumbBase64,
                })),
              }).finally(() => setBusy(false));
            }}
          >
            <p className="text-sm font-medium text-[var(--muted)]">
              {t("pickups.addPayment")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("pickups.paymentDate")}>
                <TextInput
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field label={t("pickups.paymentAmount")}>
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </Field>
            </div>
            <Field label={t("pickups.paymentMethod")}>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
              >
                <option value="bank">{t("pickups.paymentBank")}</option>
                <option value="cash">{t("pickups.paymentCash")}</option>
                <option value="other">{t("pickups.paymentOther")}</option>
              </select>
            </Field>
            <Field label={t("pickups.paymentNote")} hint={t("common.optional")}>
              <TextInput
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            <Field
              label={t("pickups.paymentProof")}
              hint={t("common.optional")}
            >
              <MultiPhotoPicker
                photos={proofPhotos}
                nextId={() =>
                  `${record.id}-pay-${crypto.randomUUID()}`
                }
                onAdd={(photo) =>
                  setProofPhotos((prev) => [...prev, photo])
                }
                onRemove={(key) =>
                  setProofPhotos((prev) =>
                    prev.filter((photo) => photo.key !== key),
                  )
                }
                onError={(photoError) =>
                  setError(
                    photoError.message === "too-large"
                      ? t("pickups.tooLarge")
                      : t("pickups.unsupported"),
                  )
                }
                labels={{
                  add: t("pickups.addPaymentProof"),
                  busy: t("pickups.compressing"),
                  remove: t("common.delete"),
                  hint: t("pickups.paymentProofHint"),
                }}
              />
            </Field>
            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <GhostButton onClick={onClose}>{t("common.close")}</GhostButton>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? t("common.saving") : t("pickups.paymentSave")}
              </PrimaryButton>
            </div>
          </form>
        ) : (
          <div className="flex justify-end">
            <GhostButton onClick={onClose}>{t("common.close")}</GhostButton>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function PickupSheet({
  initial,
  buyers,
  stores,
  onClose,
  onSave,
}: {
  initial: PickupRecord | null;
  buyers: ReturnType<typeof useAppStore.getState>["buyers"];
  stores: Store[];
  onClose: () => void;
  onSave: (input: {
    id?: string;
    date: string;
    storeName: string;
    tax: number;
    amount: number;
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
  const [id] = useState(initial?.id ?? `pickup-${crypto.randomUUID()}`);
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [storeName, setStoreName] = useState(initial?.storeName ?? "");
  const [tax, setTax] = useState(initial ? String(initial.tax) : "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
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
      title={initial ? t("pickups.edit") : t("pickups.add")}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!date) {
            flash({ type: "error", message: t("pickups.needDate") });
            return;
          }
          if (!storeName.trim()) {
            flash({ type: "error", message: t("pickups.needStore") });
            return;
          }
          if (photos.length === 0) {
            flash({ type: "error", message: t("pickups.needPhoto") });
            return;
          }
          if (!initial && invoicePhotos.length === 0) {
            flash({ type: "error", message: t("pickups.needInvoicePhoto") });
            return;
          }
          setBusy(true);
          void onSave({
            id,
            date,
            storeName: storeName.trim(),
            tax: Number(tax) > 0 ? Number(tax) : 0,
            amount: Number(amount) > 0 ? Number(amount) : 0,
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
        <Field label={t("pickups.date")}>
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field label={t("pickups.storeName")} hint={t("common.required")}>
          <TextInput
            list="pickup-store-options"
            value={storeName}
            onChange={(event) => setStoreName(event.target.value)}
          />
          <datalist id="pickup-store-options">
            {stores.map((store) => (
              <option key={store.id} value={store.name} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("pickups.tax")}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={tax}
              onChange={(event) => setTax(event.target.value)}
            />
          </Field>
          <Field label={t("pickups.amount")}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
        </div>
        <Field label={t("pickups.buyer")} hint={t("common.optional")}>
          <select
            value={buyerId}
            onChange={(event) => setBuyerId(event.target.value)}
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
        <Field label={t("pickups.photos")} hint={t("common.required")}>
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
                    ? t("pickups.tooLarge")
                    : t("pickups.unsupported"),
              })
            }
            labels={{
              add: t("pickups.addPhotos"),
              busy: t("pickups.compressing"),
              remove: t("common.delete"),
              hint: t("pickups.multiPhotoHint"),
            }}
          />
        </Field>
        <Field
          label={t("pickups.invoicePhotos")}
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
                    ? t("pickups.tooLarge")
                    : t("pickups.unsupported"),
              })
            }
            labels={{
              add: t("pickups.addInvoicePhotos"),
              busy: t("pickups.compressing"),
              remove: t("common.delete"),
              hint: t("pickups.invoicePhotoHint"),
            }}
          />
        </Field>
        <Field label={t("pickups.note")} hint={t("common.optional")}>
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
