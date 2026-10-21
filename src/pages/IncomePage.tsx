import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  TextInput,
} from "../components/ui";
import { InvoiceReceiptSheet } from "../components/InvoiceReceiptSheet";
import { useAuthStore } from "../store/useAuthStore";
import { useAppStore } from "../store/useAppStore";
import { monthStartIso, todayIso } from "../utils/format";
import {
  invoiceIsOverdue,
  invoiceOutstanding,
  invoicePaidAmount,
  invoicePaymentStatus,
} from "../utils/payments";
import type { InvoiceRecord } from "../types";

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function IncomePage() {
  const { t } = useTranslation();
  const invoices = useAppStore((s) => s.invoiceRecords);
  const packRecords = useAppStore((s) => s.packRecords);
  const buyers = useAppStore((s) => s.buyers);
  const addInvoicePayment = useAppStore((s) => s.addInvoicePayment);
  const voidInvoicePayment = useAppStore((s) => s.voidInvoicePayment);
  const flash = useAppStore((s) => s.flash);
  const user = useAuthStore((s) => s.user);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [buyerId, setBuyerId] = useState("all");
  const [status, setStatus] = useState<
    "all" | "pending" | "unpaid" | "partial" | "paid" | "overdue"
  >("all");
  const [receiptTarget, setReceiptTarget] = useState<InvoiceRecord | null>(null);
  const today = todayIso();

  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const invoiceMap = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  const filteredInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => {
          const issued = invoice.snapshot.issuedAt || invoice.from;
          if (issued < start || issued > end) return false;
          if (buyerId !== "all" && invoice.buyerId !== buyerId) return false;
          if (status === "pending") return false;
          if (status === "overdue") {
            return invoiceIsOverdue(invoice, today);
          }
          if (status !== "all" && invoicePaymentStatus(invoice) !== status) {
            return false;
          }
          return true;
        })
        .sort((a, b) =>
          (b.snapshot.issuedAt || "").localeCompare(a.snapshot.issuedAt || ""),
        ),
    [invoices, start, end, buyerId, status, today],
  );

  const pendingRecords = useMemo(
    () =>
      packRecords.filter((record) => {
        if (record.date < start || record.date > end) return false;
        if (buyerId !== "all" && record.buyerId !== buyerId) return false;
        return record.invoiceIds.every((id) => !invoiceMap.has(id));
      }),
    [packRecords, start, end, buyerId, invoiceMap],
  );

  const stats = useMemo(() => {
    const total = filteredInvoices.reduce(
      (sum, invoice) => sum + invoice.snapshot.total,
      0,
    );
    const paid = filteredInvoices.reduce(
      (sum, invoice) => sum + invoicePaidAmount(invoice),
      0,
    );
    const outstanding = filteredInvoices.reduce(
      (sum, invoice) => sum + invoiceOutstanding(invoice),
      0,
    );
    const overdue = filteredInvoices
      .filter((invoice) => invoiceIsOverdue(invoice, today))
      .reduce((sum, invoice) => sum + invoiceOutstanding(invoice), 0);
    return { total, paid, outstanding, overdue };
  }, [filteredInvoices, today]);

  const showPending = status === "all" || status === "pending";

  return (
    <div>
      <PageTitle title={t("income.title")} />

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
              value={buyerId}
              onChange={(event) => setBuyerId(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              <option value="all">{t("income.allCustomers")}</option>
              {buyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.code || buyer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("packing.incomeFilter")}>
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as
                    | "all"
                    | "pending"
                    | "unpaid"
                    | "partial"
                    | "paid"
                    | "overdue",
                )
              }
              className="min-h-11 w-full rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-base"
            >
              <option value="all">{t("packing.incomeAll")}</option>
              <option value="pending">{t("packing.pendingInvoice")}</option>
              <option value="unpaid">{t("pickups.statusUnpaid")}</option>
              <option value="partial">{t("pickups.statusPartial")}</option>
              <option value="paid">{t("pickups.statusPaid")}</option>
              <option value="overdue">{t("pickups.statusOverdue")}</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: t("packing.invoiceAmount"), value: stats.total },
            { label: t("packing.received"), value: stats.paid },
            { label: t("packing.unreceived"), value: stats.outstanding },
            { label: t("packing.overdueUnpaid"), value: stats.overdue },
            {
              label: t("packing.pendingInvoices"),
              value: pendingRecords.length,
              count: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl bg-[var(--bg)] px-3 py-2"
            >
              <p className="text-xs text-[var(--muted)]">{item.label}</p>
              <p className="mt-0.5 text-base font-semibold">
                {item.count ? item.value : money(item.value)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {showPending ? (
        <Card className="mb-4">
          <p className="mb-3 font-semibold">
            {t("packing.pendingReport", {
              count: pendingRecords.length,
            })}
          </p>
          {pendingRecords.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {t("packing.reportEmpty")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pendingRecords.map((record) => (
                <div
                  key={record.id}
                  className="rounded-2xl bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <p className="font-medium">
                    {record.date} · {record.storeName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {record.logistics}
                    {record.trackingNo ? ` · ${record.trackingNo}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{t("income.invoiceList")}</p>
          <span className="text-xs text-[var(--muted)]">
            {t("income.count", { count: filteredInvoices.length })}
          </span>
        </div>
        {filteredInvoices.length === 0 ? (
          <EmptyState text={t("income.empty")} />
        ) : (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
            {filteredInvoices.map((invoice) => {
              const paymentStatus = invoicePaymentStatus(invoice);
              const overdue = invoiceIsOverdue(invoice, today);
              return (
                <div
                  key={invoice.id}
                  className="rounded-2xl bg-[var(--bg)] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {invoice.invoiceNo} · {invoice.buyerName}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {invoice.snapshot.issuedAt} ·{" "}
                        {t("packing.invoiceAmount")}{" "}
                        {money(invoice.snapshot.total)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          overdue
                            ? "bg-red-100 text-red-700"
                            : paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : paymentStatus === "partial"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-600"
                        }`}
                      >
                        {overdue
                          ? t("pickups.statusOverdue")
                          : paymentStatus === "paid"
                            ? t("pickups.statusPaid")
                            : paymentStatus === "partial"
                              ? t("pickups.statusPartial")
                              : t("pickups.statusUnpaid")}
                      </span>
                      {user?.role === "admin" ||
                      user?.role === "summarizer" ? (
                        <GhostButton
                          onClick={() => setReceiptTarget(invoice)}
                        >
                          {t("invoice.updatePayment")}
                        </GhostButton>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {t("packing.received")}{" "}
                    {money(invoicePaidAmount(invoice))} ·{" "}
                    {t("packing.unreceived")}{" "}
                    {money(invoiceOutstanding(invoice))}
                    {invoice.snapshot.dueAt
                      ? ` · ${t("pickups.dueDate")} ${invoice.snapshot.dueAt}`
                      : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {receiptTarget ? (
        <InvoiceReceiptSheet
          invoice={receiptTarget}
          onClose={() => setReceiptTarget(null)}
          onAdd={async (input) => {
            await addInvoicePayment(receiptTarget.id, input);
            flash({ type: "ok", message: t("packing.receiptSaved") });
            setReceiptTarget(null);
          }}
          onVoid={async (paymentId) => {
            await voidInvoicePayment(receiptTarget.id, paymentId);
            flash({ type: "ok", message: t("pickups.paymentVoided") });
            setReceiptTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
