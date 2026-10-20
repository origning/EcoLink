import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  Field,
  PageTitle,
  TextInput,
} from "../components/ui";
import { useAppStore } from "../store/useAppStore";
import { buildExpenseSummary } from "../utils/expenses";
import { monthStartIso, todayIso } from "../utils/format";
import {
  pickupDueDate,
  pickupIsOverdue,
  pickupOutstanding,
  pickupPaidAmount,
  pickupPaymentStatus,
  storeForRecord,
} from "../utils/payments";

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ExpensesPage() {
  const { t } = useTranslation();
  const records = useAppStore((s) => s.pickupRecords);
  const stores = useAppStore((s) => s.stores);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unpaid" | "partial" | "paid" | "overdue"
  >("all");
  const today = todayIso();

  const summary = useMemo(
    () => buildExpenseSummary(records, stores, from, to, today),
    [records, stores, from, to, today],
  );

  const filteredRecords = useMemo(
    () =>
      summary.records.filter((record) => {
        if (storeFilter !== "all" && record.storeName.trim() !== storeFilter) {
          return false;
        }
        const store = storeForRecord(record, stores);
        if (statusFilter === "overdue") {
          return pickupIsOverdue(record, store, today);
        }
        if (
          statusFilter !== "all" &&
          pickupPaymentStatus(record) !== statusFilter
        ) {
          return false;
        }
        return true;
      }),
    [summary.records, storeFilter, statusFilter, stores, today],
  );

  const cards = [
    { label: t("pickups.totalAmount"), value: summary.totals.amount },
    { label: t("pickups.totalPaid"), value: summary.totals.paid },
    { label: t("pickups.totalUnpaid"), value: summary.totals.unpaid },
    { label: t("pickups.totalOverdue"), value: summary.totals.overdue },
    { label: t("pickups.totalTax"), value: summary.totals.tax },
  ];

  return (
    <div>
      <PageTitle title={t("expenses.title")} />

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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("pickups.settleStore")}>
            <select
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              <option value="all">{t("expenses.allStores")}</option>
              {summary.stores.map((store) => (
                <option key={store.storeName} value={store.storeName}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("pickups.paymentFilter")}>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "all"
                    | "unpaid"
                    | "partial"
                    | "paid"
                    | "overdue",
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
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl bg-[var(--bg)] px-3 py-2"
            >
              <p className="text-xs text-[var(--muted)]">{card.label}</p>
              <p className="mt-0.5 text-base font-semibold">
                {money(card.value)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <p className="mb-3 font-semibold">{t("expenses.byStore")}</p>
          {summary.stores.length === 0 ? (
            <EmptyState text={t("expenses.empty")} />
          ) : (
            <div className="space-y-2">
              {summary.stores.map((store) => (
                <div
                  key={store.storeName}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{store.storeName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {store.count} · {t("pickups.totalAmount")}{" "}
                      {money(store.amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>
                      {t("pickups.paid")}: {money(store.paid)}
                    </span>
                    <span>
                      {t("pickups.unpaid")}: {money(store.unpaid)}
                    </span>
                    {store.overdue > 0 ? (
                      <span className="font-semibold text-red-600">
                        {t("pickups.totalOverdue")}: {money(store.overdue)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-3 font-semibold">{t("expenses.byMonth")}</p>
          {summary.months.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {t("expenses.empty")}
            </p>
          ) : (
            <div className="space-y-2">
              {summary.months.map((month) => (
                <div
                  key={month.month}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <span className="font-medium">{month.month}</span>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span>{money(month.amount)}</span>
                    <span>
                      {t("pickups.paid")}: {money(month.paid)}
                    </span>
                    <span>
                      {t("pickups.unpaid")}: {money(month.unpaid)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <p className="mb-3 font-semibold">{t("expenses.details")}</p>
          {filteredRecords.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {t("expenses.empty")}
            </p>
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
              {filteredRecords.map((record) => {
                const store = storeForRecord(record, stores);
                const status = pickupPaymentStatus(record);
                const overdue = pickupIsOverdue(record, store, today);
                const due = pickupDueDate(record, store);
                return (
                  <div
                    key={record.id}
                    className="rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">
                        {record.storeName}
                      </p>
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
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {record.date} · {t("pickups.amount")}{" "}
                      {money(record.amount)} · {t("pickups.paid")}{" "}
                      {money(pickupPaidAmount(record))} ·{" "}
                      {t("pickups.unpaid")}{" "}
                      {money(pickupOutstanding(record))}
                    </p>
                    {due ? (
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {t("pickups.dueDate")}: {due}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
