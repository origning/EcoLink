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
  TextInput,
} from "../components/ui";
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
import type { InvoiceRecord, SummaryMatrix } from "../types";
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
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<"single" | "range">("single");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [editItem, setEditItem] = useState<BatchExportItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<"zip" | "pdf" | null>(null);

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
                      <span className="shrink-0 text-sm font-semibold">
                        {formatMoney(
                          record.snapshot.currency,
                          record.snapshot.total,
                        )}
                      </span>
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
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-1">
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
    </div>
  );
}
