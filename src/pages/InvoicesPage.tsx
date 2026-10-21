import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  SearchInput,
  Sheet,
  TextInput,
} from "../components/ui";
import { InvoiceReceiptSheet } from "../components/InvoiceReceiptSheet";
import { useAuthStore } from "../store/useAuthStore";
import { buildSummary, useAppStore } from "../store/useAppStore";
import {
  downloadBatchInvoicesPdf,
  exportBatchZip,
  type BatchExportItem,
  type BatchPrintLabels,
} from "../utils/exportBatch";
import {
  exportInvoiceSnapshot,
  formatInvoiceNumber,
  formatMoney,
  printInvoiceSnapshot,
} from "../utils/exportInvoice";
import { todayIso } from "../utils/format";
import {
  invoiceIsOverdue,
  invoiceOutstanding,
  invoicePaidAmount,
  invoicePaymentStatus,
} from "../utils/payments";
import type { InvoiceRecord, InvoiceSnapshot, SummaryMatrix } from "../types";
import {
  BuyerMultiSelect,
  initialInvoiceSnapshot,
  InvoiceEditSheet,
} from "./SummaryPage";

/** 只保留一个客户，发票明细按这个客户的数量生成。 */
function matrixForBuyer(matrix: SummaryMatrix, buyerId: string): SummaryMatrix {
  const buyer = matrix.buyers.find((item) => item.id === buyerId);
  const sections = matrix.sections
    .map((section) => {
      const rows = section.rows
        .map((row) => {
          const quantity = row.quantities[buyerId] ?? 0;
          return {
            ingredient: row.ingredient,
            quantities: { [buyerId]: quantity },
            total: quantity,
          };
        })
        .filter((row) => row.total > 0);
      return { ...section, rows };
    })
    .filter((section) => section.rows.length > 0);
  return { ...matrix, buyers: buyer ? [buyer] : [], sections };
}

function withTotals(snapshot: InvoiceSnapshot): InvoiceSnapshot {
  const lines = snapshot.lines.map((line) => ({
    ...line,
    amount: line.quantity * line.price,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax = snapshot.tax;
  return { ...snapshot, lines, subtotal, tax, total: subtotal + tax };
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const buyers = useAppStore((s) => s.buyers);
  const orders = useAppStore((s) => s.orders);
  const records = useAppStore((s) => s.invoiceRecords);
  const invoiceSettings = useAppStore((s) => s.settings.invoice);
  const fontFamily = useAppStore((s) => s.settings.fontFamily);
  const flash = useAppStore((s) => s.flash);
  const saveInvoiceRecord = useAppStore((s) => s.saveInvoiceRecord);
  const addInvoicePayment = useAppStore((s) => s.addInvoicePayment);
  const voidInvoicePayment = useAppStore((s) => s.voidInvoicePayment);
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<"single" | "range">("single");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [editItem, setEditItem] = useState<BatchExportItem | null>(null);
  const [editRecord, setEditRecord] = useState<InvoiceRecord | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<InvoiceRecord | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<"zip" | "pdf" | null>(null);
  const today = todayIso();

  const sortedBuyers = useMemo(
    () =>
      [...buyers].sort(
        (a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh"),
      ),
    [buyers],
  );

  const rangeFrom = from;
  const rangeTo = mode === "single" ? from : to;
  const matrix = useMemo(
    () =>
      buildSummary(
        { groups, ingredients, buyers, orders },
        rangeFrom,
        rangeTo,
      ),
    [groups, ingredients, buyers, orders, rangeFrom, rangeTo],
  );

  // 预先算好每个客户要导出的发票，没有订单的客户自动跳过。
  const preview = useMemo(() => {
    const valid: BatchExportItem[] = [];
    const skipped: string[] = [];
    let offset = 0;
    for (const buyerId of selectedBuyerIds) {
      const buyer = buyers.find((item) => item.id === buyerId);
      if (!buyer) continue;
      const buyerMatrix = matrixForBuyer(matrix, buyerId);
      if (buyerMatrix.sections.length === 0) {
        skipped.push(buyer.id);
        continue;
      }
      const invoiceNumber = invoiceSettings.nextInvoiceNumber + offset;
      valid.push({
        buyer,
        matrix: buyerMatrix,
        snapshot: initialInvoiceSnapshot(buyerMatrix, buyer, invoiceSettings),
        invoiceNo: formatInvoiceNumber(
          invoiceSettings.invoicePrefix,
          invoiceNumber,
        ),
      });
      offset += 1;
    }
    return { valid, skipped };
  }, [selectedBuyerIds, buyers, matrix, invoiceSettings]);

  const itemByBuyer = useMemo(
    () => new Map(preview.valid.map((item) => [item.buyer.id, item])),
    [preview.valid],
  );
  const singleItem =
    selectedBuyerIds.length === 1 && preview.valid.length === 1
      ? preview.valid[0]
      : null;

  const printLabels: BatchPrintLabels = {
    invoiceTitle: t("invoice.tabTitle"),
    invoiceNo: t("invoice.number"),
    issueDate: t("invoice.issueDate"),
    dueDate: t("invoice.dueDate"),
    billTo: t("invoice.billTo"),
    shipTo: t("invoice.shipTo"),
    description: t("invoice.description"),
    quantity: t("orders.quantity"),
    unitPrice: t("summary.unitPrice"),
    amount: t("invoice.amount"),
    subtotal: t("invoice.subtotal"),
    tax: t("invoice.tax"),
    total: t("common.total"),
    bankDetails: t("invoice.bankDetails"),
    paymentNote: t("invoice.paymentNote"),
  };

  const displayError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("502")
      ? t("invoice.serverUnavailable")
      : message;
  };

  const filteredRecords = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return [...records]
      .filter((record) => {
        if (!needle) return true;
        return [
          record.invoiceNo,
          record.buyerName,
          record.snapshot.billTo.name,
          record.createdByName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [records, keyword]);

  const reexport = async (record: InvoiceRecord, format: "excel" | "pdf") => {
    const key = `${record.id}:${format}`;
    setBusy(key);
    try {
      if (format === "excel") {
        await exportInvoiceSnapshot(
          record.snapshot,
          record.invoiceNo,
          fontFamily,
        );
      } else {
        await printInvoiceSnapshot(
          record.snapshot,
          record.invoiceNo,
          fontFamily,
        );
      }
      flash({ type: "ok", message: t("invoice.exported") });
    } catch (error) {
      const message = displayError(error);
      flash({
        type: "error",
        message:
          message === "popup-blocked" ? t("invoice.popupBlocked") : message,
      });
    } finally {
      setBusy(null);
    }
  };

  const toRecord = (item: BatchExportItem): InvoiceRecord => {
    const number =
      Number((item.invoiceNo.match(/(\d+)$/) ?? [])[1]) ||
      invoiceSettings.nextInvoiceNumber;
    return {
      id: `invoice-${crypto.randomUUID()}`,
      invoiceNo: item.invoiceNo,
      invoiceNumber: number,
      buyerId: item.buyer.id,
      buyerName: item.buyer.name,
      from: item.matrix.from,
      to: item.matrix.to,
      snapshot: item.snapshot,
      payments: [],
      createdBy: user?.id ?? "local",
      createdByName: user?.username ?? "local",
      createdAt: Date.now(),
    };
  };

  const runBatch = async (format: "zip" | "pdf") => {
    if (preview.valid.length === 0) return;
    setBatchBusy(format);
    let generated = false;
    try {
      if (format === "pdf") {
        await downloadBatchInvoicesPdf(
          preview.valid,
          printLabels,
          fontFamily,
        );
      } else {
        await exportBatchZip(preview.valid, fontFamily);
      }
      generated = true;
      for (const item of preview.valid) {
        await saveInvoiceRecord(toRecord(item));
      }
      flash({
        type: "ok",
        message: t("invoice.batchExported", {
          count: preview.valid.length,
        }),
      });
      setSelectedBuyerIds([]);
    } catch (error) {
      const message = displayError(error);
      flash({
        type: "error",
        message:
          message === "popup-blocked"
            ? t("invoice.popupBlocked")
            : generated
              ? `${t("invoice.batchSaveFailed")} ${message}`
              : message,
      });
    } finally {
      setBatchBusy(null);
    }
  };

  return (
    <div>
      <PageTitle title={t("invoice.tabTitle")} />

      <div className="lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-5">
        <Card className="mb-4 space-y-3 lg:sticky lg:top-24 lg:mb-0">
          <div>
            <p className="font-semibold">{t("invoice.batchTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {t("invoice.batchHint")}
            </p>
          </div>

          <Field label={t("invoice.customer")}>
            <BuyerMultiSelect
              buyers={sortedBuyers}
              selectedIds={selectedBuyerIds}
              onChange={setSelectedBuyerIds}
            />
          </Field>

          <div className="inline-flex w-fit rounded-[9px] border border-[var(--line)] bg-[var(--surface)] p-0.5">
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

          {mode === "single" ? (
            <Field label={t("orders.date")}>
              <TextInput
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
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

          {selectedBuyerIds.length > 0 ? (
            <div className="rounded-2xl bg-[var(--bg)] p-2">
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">
                {t("invoice.previewTitle")}
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {selectedBuyerIds.map((id) => {
                  const buyer = buyers.find((item) => item.id === id);
                  if (!buyer) return null;
                  const item = itemByBuyer.get(id);
                  return (
                    <li
                      key={id}
                      className="rounded-xl bg-white px-2 py-1.5 text-xs"
                    >
                      <p className="truncate font-medium">
                        {buyer.code || buyer.name}
                      </p>
                      {item ? (
                        <p className="text-[var(--muted)]">
                          {t("invoice.previewItem", {
                            count: item.matrix.sections.reduce(
                              (sum, section) => sum + section.rows.length,
                              0,
                            ),
                            total: formatMoney(
                              item.snapshot.currency,
                              item.snapshot.total,
                            ),
                            invoiceNo: item.invoiceNo,
                          })}
                        </p>
                      ) : (
                        <p className="text-amber-700">
                          {t("invoice.noOrderData")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {preview.skipped.length > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  {t("invoice.skippedCount", {
                    count: preview.skipped.length,
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              {t("invoice.selectHint")}
            </p>
          )}

          <div className="grid gap-2">
            {singleItem ? (
              <GhostButton
                className="w-full"
                disabled={batchBusy !== null}
                onClick={() => setEditItem(singleItem)}
              >
                {t("invoice.singleCreate")}
              </GhostButton>
            ) : null}
            <PrimaryButton
              className="w-full"
              disabled={preview.valid.length === 0 || batchBusy !== null}
              onClick={() => void runBatch("zip")}
            >
              {batchBusy === "zip"
                ? t("data.exporting")
                : t("invoice.exportZip")}
            </PrimaryButton>
            <GhostButton
              className="w-full"
              disabled={preview.valid.length === 0 || batchBusy !== null}
              onClick={() => void runBatch("pdf")}
            >
              {batchBusy === "pdf"
                ? t("data.exporting")
                : t("invoice.printBatch")}
            </GhostButton>
          </div>
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {t("invoice.zipHint")}
          </p>
        </Card>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{t("invoice.historyTitle")}</h3>
            <span className="text-xs text-[var(--muted)]">
              {t("invoice.historyCount", { count: filteredRecords.length })}
            </span>
          </div>
          <div className="mb-3 lg:max-w-md">
            <SearchInput
              value={keyword}
              onValueChange={setKeyword}
              placeholder={t("invoice.searchPlaceholder")}
              clearLabel={t("common.clear")}
            />
          </div>

          {records.length === 0 ? (
            <EmptyState text={t("invoice.empty")} />
          ) : filteredRecords.length === 0 ? (
            <EmptyState text={t("invoice.noMatch")} />
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
              {filteredRecords.map((record) => {
                const buyer = buyers.find((item) => item.id === record.buyerId);
                const buyerName = buyer
                  ? buyer.code || buyer.name
                  : record.buyerName || record.snapshot.billTo.name;
                const paymentStatus = invoicePaymentStatus(record);
                const overdue = invoiceIsOverdue(record, today);
                return (
                  <Card key={record.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {record.invoiceNo}
                        </p>
                        <p className="truncate text-sm text-[var(--ink)]">
                          {buyerName}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold">
                          {formatMoney(
                            record.snapshot.currency,
                            record.snapshot.total,
                          )}
                        </span>
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
                      </div>
                    </div>
                    <div className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                      <p>
                        {t("invoice.issueDate")}: {record.snapshot.issuedAt}
                      </p>
                      <p>
                        {t("invoice.range")}: {record.from} → {record.to}
                      </p>
                      <p>
                        {t("invoice.linesCount", {
                          count: record.snapshot.lines.length,
                        })}
                        {" · "}
                        {t("invoice.createdBy")}: {record.createdByName}
                      </p>
                      <p>
                        {t("packing.received")}:{" "}
                        {formatMoney(
                          record.snapshot.currency,
                          invoicePaidAmount(record),
                        )}{" "}
                        · {t("packing.unreceived")}:{" "}
                        {formatMoney(
                          record.snapshot.currency,
                          invoiceOutstanding(record),
                        )}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-1">
                      <GhostButton onClick={() => setEditRecord(record)}>
                        {t("common.edit")}
                      </GhostButton>
                      <GhostButton onClick={() => setReceiptTarget(record)}>
                        {t("invoice.updatePayment")}
                      </GhostButton>
                      <GhostButton
                        disabled={busy === `${record.id}:excel`}
                        onClick={() => void reexport(record, "excel")}
                      >
                        {busy === `${record.id}:excel`
                          ? t("data.exporting")
                          : t("invoice.excelAction")}
                      </GhostButton>
                      <GhostButton
                        disabled={busy === `${record.id}:pdf`}
                        onClick={() => void reexport(record, "pdf")}
                      >
                        {busy === `${record.id}:pdf`
                          ? t("data.exporting")
                          : t("invoice.pdfAction")}
                      </GhostButton>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editItem ? (
        <InvoiceEditSheet
          matrix={editItem.matrix}
          buyer={editItem.buyer}
          settings={invoiceSettings}
          fontFamily={fontFamily}
          onClose={() => setEditItem(null)}
          onExported={() => {
            setEditItem(null);
            setSelectedBuyerIds([]);
            flash({ type: "ok", message: t("invoice.exported") });
          }}
        />
      ) : null}

      {editRecord ? (
        <InvoiceRecordSheet
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSave={async (next) => {
            await saveInvoiceRecord(next);
            flash({ type: "ok", message: t("invoice.recordSaved") });
            setEditRecord(null);
          }}
        />
      ) : null}

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

function InvoiceRecordSheet({
  record,
  onClose,
  onSave,
}: {
  record: InvoiceRecord;
  onClose: () => void;
  onSave: (record: InvoiceRecord) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [invoiceNo, setInvoiceNo] = useState(record.invoiceNo);
  const [snapshot, setSnapshot] = useState<InvoiceSnapshot>(record.snapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = invoicePaidAmount(record);

  const update = (patch: Partial<InvoiceSnapshot>) =>
    setSnapshot((prev) => withTotals({ ...prev, ...patch }));

  const updateLine = (
    index: number,
    field: "description" | "quantity" | "price",
    value: string,
  ) => {
    setSnapshot((prev) => {
      const lines = prev.lines.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        if (field === "description") return { ...line, description: value };
        return { ...line, [field]: Number(value) || 0 };
      });
      return withTotals({ ...prev, lines });
    });
  };

  const save = async () => {
    if (!invoiceNo.trim()) {
      setError(t("invoice.needNumber"));
      return;
    }
    if (
      !snapshot.issuedAt ||
      !snapshot.currency.trim() ||
      !snapshot.billTo.name.trim() ||
      !snapshot.lines.some(
        (line) => line.description.trim() && line.quantity > 0,
      )
    ) {
      setError(t("invoice.requiredFields"));
      return;
    }
    if (snapshot.total + 0.0001 < paid) {
      setError(t("invoice.totalBelowPaid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const number =
        Number((invoiceNo.match(/(\d+)$/) ?? [])[1]) || record.invoiceNumber;
      await onSave({
        ...record,
        invoiceNo: invoiceNo.trim(),
        invoiceNumber: number,
        snapshot,
      });
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : String(saveError);
      setError(
        message === "invoice-number-taken"
          ? t("invoice.numberTaken")
          : message === "invoice-total-below-paid"
            ? t("invoice.totalBelowPaid")
            : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t("invoice.editRecordTitle")} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-2xl bg-[var(--bg)] px-3 py-2 text-xs text-[var(--muted)]">
          {t("invoice.editRecordHint")}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("invoice.number")} hint={t("common.required")}>
            <TextInput
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
          </Field>
          <Field label={t("invoice.issueDate")} hint={t("common.required")}>
            <TextInput
              type="date"
              value={snapshot.issuedAt}
              onChange={(event) => update({ issuedAt: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.dueDate")} hint={t("common.optional")}>
            <TextInput
              type="date"
              value={snapshot.dueAt}
              onChange={(event) => update({ dueAt: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.currency")} hint={t("common.required")}>
            <TextInput
              value={snapshot.currency}
              onChange={(event) => update({ currency: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.taxAmount")} hint={t("common.optional")}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={snapshot.tax}
              onChange={(event) =>
                update({ tax: Number(event.target.value) || 0 })
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("common.name")} hint={t("common.required")}>
            <TextInput
              value={snapshot.billTo.name}
              onChange={(event) =>
                update({
                  billTo: { ...snapshot.billTo, name: event.target.value },
                })
              }
            />
          </Field>
          <Field label={t("buyers.address")} hint={t("common.optional")}>
            <TextInput
              value={snapshot.billTo.address}
              onChange={(event) =>
                update({
                  billTo: { ...snapshot.billTo, address: event.target.value },
                })
              }
            />
          </Field>
          <Field label={t("buyers.phone")} hint={t("common.optional")}>
            <TextInput
              value={snapshot.billTo.phone}
              onChange={(event) =>
                update({
                  billTo: { ...snapshot.billTo, phone: event.target.value },
                })
              }
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              {t("invoice.lines")}{" "}
              <span className="text-xs text-[var(--muted)]">
                {t("common.required")}
              </span>
            </p>
            <GhostButton
              onClick={() =>
                update({
                  lines: [
                    ...snapshot.lines,
                    { description: "", quantity: 1, price: 0, amount: 0 },
                  ],
                })
              }
            >
              {t("invoice.addLine")}
            </GhostButton>
          </div>
          <div className="space-y-2">
            {snapshot.lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-1 gap-2 rounded-2xl bg-[var(--bg)] p-3 sm:grid-cols-[1fr_5rem_6rem_5rem_auto]"
              >
                <TextInput
                  placeholder={t("invoice.description")}
                  value={line.description}
                  onChange={(event) =>
                    updateLine(index, "description", event.target.value)
                  }
                />
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t("orders.quantity")}
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, "quantity", event.target.value)
                  }
                />
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t("summary.unitPrice")}
                  value={line.price}
                  onChange={(event) =>
                    updateLine(index, "price", event.target.value)
                  }
                />
                <div className="flex items-center justify-end text-sm font-medium">
                  {line.amount.toFixed(2)}
                </div>
                <GhostButton
                  danger
                  onClick={() =>
                    update({
                      lines: snapshot.lines.filter(
                        (_, lineIndex) => lineIndex !== index,
                      ),
                    })
                  }
                >
                  {t("common.delete")}
                </GhostButton>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--bg)] p-3 text-sm">
          <div className="flex justify-between">
            <span>{t("invoice.subtotal")}</span>
            <span>{snapshot.subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>{t("invoice.tax")}</span>
            <span>{snapshot.tax.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>{t("common.total")}</span>
            <span>
              {snapshot.currency}
              {snapshot.total.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{t("packing.received")}</span>
            <span>{paid.toFixed(2)}</span>
          </div>
        </div>

        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            {busy ? t("common.saving") : t("invoice.saveRecord")}
          </PrimaryButton>
        </div>
      </div>
    </Sheet>
  );
}
