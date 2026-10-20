import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ingredientThumbUrl } from "../api/db";
import {
  Card,
  EmptyState,
  Field,
  GhostButton,
  PageTitle,
  PrimaryButton,
  Sheet,
  TextArea,
  TextInput,
  Thumb,
} from "../components/ui";
import { ExportPreviewSheet } from "../components/ExportPreviewSheet";
import { buildSummary, useAppStore } from "../store/useAppStore";
import { useAuthStore } from "../store/useAuthStore";
import { exportSummary } from "../utils/exportSummary";
import { exportPickingList } from "../utils/exportPickingList";
import {
  exportBatchPickingZip,
  type BatchPickingItem,
} from "../utils/exportBatch";
import {
  buildInvoiceData,
  exportInvoiceSnapshot,
  formatInvoiceNumber,
  printInvoiceSnapshot,
} from "../utils/exportInvoice";
import { groupLabel, todayIso } from "../utils/format";
import type {
  Buyer,
  Group,
  InvoiceRecord,
  InvoiceSettings,
  InvoiceSnapshot,
  SummaryMatrix,
} from "../types";

/** 只保留选中的客户列，并把行合计重算成「选中客户」的合计。 */
function filterMatrixBuyers(
  matrix: SummaryMatrix,
  ids: Set<string>,
): SummaryMatrix {
  const buyers = matrix.buyers.filter((buyer) => ids.has(buyer.id));
  const sections = matrix.sections
    .map((section) => {
      const rows = section.rows
        .map((row) => {
          const quantities: Record<string, number> = {};
          let total = 0;
          for (const buyer of buyers) {
            const quantity = row.quantities[buyer.id] ?? 0;
            quantities[buyer.id] = quantity;
            total += quantity;
          }
          return { ingredient: row.ingredient, quantities, total };
        })
        .filter((row) => row.total > 0);
      return { ...section, rows };
    })
    .filter((section) => section.rows.length > 0);
  return { ...matrix, buyers, sections };
}

export function SummaryPage() {
  const { t } = useTranslation();
  const groups = useAppStore((s) => s.groups);
  const ingredients = useAppStore((s) => s.ingredients);
  const buyers = useAppStore((s) => s.buyers);
  const orders = useAppStore((s) => s.orders);
  const flash = useAppStore((s) => s.flash);
  const locale = useAppStore((s) => s.settings.locale);
  const fontFamily = useAppStore((s) => s.settings.fontFamily);
  const fontSize = useAppStore((s) => s.settings.fontSize);
  const [mode, setMode] = useState<"single" | "range">("single");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [allSummaryOpen, setAllSummaryOpen] = useState(false);
  const [preview, setPreview] = useState<null | "summary" | "picking">(null);
  const [batchPickingBusy, setBatchPickingBusy] = useState(false);

  const rangeFrom = from;
  const rangeTo = mode === "single" ? from : to;

  const matrix = useMemo(
    () => buildSummary({ groups, ingredients, buyers, orders }, rangeFrom, rangeTo),
    [groups, ingredients, buyers, orders, rangeFrom, rangeTo],
  );

  const sortedBuyers = useMemo(
    () => [...buyers].sort((a, b) => a.sort - b.sort),
    [buyers],
  );

  const selectedSet = useMemo(() => new Set(selectedBuyerIds), [selectedBuyerIds]);
  const selectedMatrix = useMemo(
    () => filterMatrixBuyers(matrix, selectedSet),
    [matrix, selectedSet],
  );
  const selectedEmpty = selectedMatrix.sections.length === 0;

  // 汇总页的批量拣货单：每个客户单独一张，没有订单的客户自动跳过。
  const batchPickingItems = useMemo<BatchPickingItem[]>(() => {
    const items: BatchPickingItem[] = [];
    for (const buyerId of selectedBuyerIds) {
      const buyer = buyers.find((item) => item.id === buyerId);
      if (!buyer) continue;
      const buyerMatrix = filterMatrixBuyers(matrix, new Set([buyerId]));
      if (buyerMatrix.sections.length === 0) continue;
      items.push({ buyer, matrix: buyerMatrix });
    }
    return items;
  }, [selectedBuyerIds, buyers, matrix]);

  const groupName = (group: Group) => groupLabel(group, t);
  const sectionLabel = (group: Group, parent?: Group) =>
    parent
      ? `${groupLabel(parent, t)} / ${groupLabel(group, t)}`
      : groupLabel(group, t);

  const summaryLabels = {
    sheet: locale === "zh" ? "汇总" : "Summary",
    title: t("summary.exportTitle"),
    titleForBuyer: (name: string) => t("summary.exportTitleForBuyer", { name }),
    rangeLabel: t("summary.rangeLabel"),
    exportedAtLabel: t("summary.exportedAtLabel"),
    code: t("summary.code"),
    item: t("summary.item"),
    nameEn: t("summary.nameEn"),
    total: t("common.total"),
    unitPrice: t("summary.unitPrice"),
    totalPrice: t("summary.totalPrice"),
    storeAddress: t("summary.storeAddress"),
    storePhone: t("summary.storePhone"),
    storeLogistics: t("summary.storeLogistics"),
    orderDate: t("summary.orderDate"),
    groupName,
    deleted: t("common.deletedItem"),
    fontFamily,
    fontSize,
  };

  const pickingLabels = {
    sheet: locale === "zh" ? "拣货单" : "Picking list",
    title: t("picking.title"),
    titleForBuyer: (name: string) => t("picking.titleForBuyer", { name }),
    rangeLabel: t("summary.rangeLabel"),
    exportedAtLabel: t("summary.exportedAtLabel"),
    item: t("summary.item"),
    code: t("summary.code"),
    nameEn: t("summary.nameEn"),
    quantity: t("orders.quantity"),
    remark: t("summary.remark"),
    groupName,
    fontFamily,
    fontSize,
  };

  const runBatchPicking = async () => {
    if (batchPickingItems.length === 0) return;
    setBatchPickingBusy(true);
    try {
      await exportBatchPickingZip(batchPickingItems, pickingLabels, locale);
      flash({
        type: "ok",
        message: t("summary.batchPickingExported", {
          count: batchPickingItems.length,
        }),
      });
    } catch (error) {
      flash({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setBatchPickingBusy(false);
    }
  };

  const handlePreviewExport = async (ordered: SummaryMatrix) => {
    try {
      if (preview === "picking") {
        await exportPickingList(ordered, pickingLabels, {
          buyerIds: selectedBuyerIds,
        });
        flash({ type: "ok", message: t("picking.exported") });
        return;
      }
      await exportSummary(ordered, summaryLabels, {
        buyerIds: selectedBuyerIds,
      });
      flash({ type: "ok", message: t("summary.exported") });
    } catch (error) {
      flash({ type: "error", message: String(error) });
    }
  };

  return (
    <div>
      <PageTitle title={t("summary.title")} />

      <Card className="mb-4 space-y-3">
        <div className="flex rounded-full bg-[var(--bg)] p-1">
          {(["single", "range"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`min-h-10 flex-1 rounded-full py-1.5 text-sm font-medium ${
                mode === item ? "bg-[var(--brand)] text-white" : "text-[var(--muted)]"
              }`}
            >
              {t(`summary.${item}`)}
            </button>
          ))}
        </div>
        {mode === "single" ? (
          <Field label={t("orders.date")}>
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("summary.from")}>
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("summary.to")}>
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-[var(--muted)]">
            {t("summary.selectBuyers")}
            <span className="ml-1 text-xs font-normal text-[var(--muted)] opacity-70">
              {t("summary.selectBuyersHint")}
            </span>
          </span>
          <BuyerMultiSelect
            buyers={sortedBuyers}
            selectedIds={selectedBuyerIds}
            onChange={setSelectedBuyerIds}
          />
        </div>
      </Card>

      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between gap-2"
        onClick={() => setAllSummaryOpen((open) => !open)}
      >
        <h3 className="font-semibold">
          {allSummaryOpen ? "▾" : "▸"} {t("summary.allBuyersTitle")}
        </h3>
        <span className="text-[var(--muted)]">{allSummaryOpen ? "–" : "+"}</span>
      </button>
      {allSummaryOpen && (
        <div className="mb-6">
          <SummaryTables matrix={matrix} emptyText={t("summary.empty")} />
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t("summary.selectedTitle")}</h3>
        <div className="flex flex-wrap justify-end gap-1">
          <GhostButton
            disabled={batchPickingItems.length === 0 || batchPickingBusy}
            onClick={() => void runBatchPicking()}
          >
            {batchPickingBusy
              ? t("data.exporting")
              : t("summary.batchPickingZip")}
          </GhostButton>
          <GhostButton
            disabled={selectedEmpty}
            onClick={() => setPreview("picking")}
          >
            {t("summary.exportPicking")}
          </GhostButton>
          <PrimaryButton
            disabled={selectedEmpty}
            onClick={() => setPreview("summary")}
          >
            {t("summary.export")}
          </PrimaryButton>
        </div>
      </div>
      <div className="mb-6">
        {selectedBuyerIds.length === 0 ? (
          <Card>
            <p className="py-4 text-center text-sm text-[var(--muted)]">
              {t("summary.pickBuyersHint")}
            </p>
          </Card>
        ) : (
          <SummaryTables matrix={selectedMatrix} emptyText={t("summary.noBuyerData")} />
        )}
      </div>

      {preview ? (
        <ExportPreviewSheet
          matrix={selectedMatrix}
          title={preview === "picking" ? t("picking.title") : t("summary.selectedTitle")}
          confirmLabel={
            preview === "picking" ? t("summary.exportPicking") : t("summary.export")
          }
          groupLabel={sectionLabel}
          onExport={handlePreviewExport}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </div>
  );
}

export function BuyerMultiSelect({
  buyers,
  selectedIds,
  onChange,
}: {
  buyers: Buyer[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selectedIds);
  const names = buyers
    .filter((buyer) => selectedSet.has(buyer.id))
    .map((buyer) => buyer.name || t("common.deletedItem"));
  const summary =
    names.length === 0
      ? t("summary.selectBuyersPlaceholder")
      : names.length <= 3
        ? names.join("、")
        : t("summary.selectedCount", { count: names.length });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-left text-base"
      >
        <span className={`min-w-0 truncate ${names.length ? "" : "text-[var(--muted)]"}`}>
          {summary}
        </span>
        <span className="shrink-0 text-[var(--muted)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-40 mt-1 max-h-72 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-[var(--line)]">
            <div className="flex items-center justify-between px-1 pb-1">
              <GhostButton onClick={() => onChange(buyers.map((buyer) => buyer.id))}>
                {t("summary.selectAll")}
              </GhostButton>
              <GhostButton onClick={() => onChange([])}>
                {t("summary.clearAll")}
              </GhostButton>
            </div>
            {buyers.length === 0 ? (
              <p className="px-2 py-3 text-sm text-[var(--muted)]">
                {t("buyers.empty")}
              </p>
            ) : (
              buyers.map((buyer) => (
                <label
                  key={buyer.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--bg)]"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedSet.has(buyer.id)}
                    onChange={() =>
                      onChange(
                        selectedSet.has(buyer.id)
                          ? selectedIds.filter((id) => id !== buyer.id)
                          : [...selectedIds, buyer.id],
                      )
                    }
                  />
                  <span className="min-w-0 truncate">
                    {buyer.name || t("common.deletedItem")}
                  </span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryTables({
  matrix,
  emptyText,
}: {
  matrix: SummaryMatrix;
  emptyText: string;
}) {
  const { t } = useTranslation();
  if (matrix.sections.length === 0) return <EmptyState text={emptyText} />;
  const deletedLabel = t("common.deletedItem");

  return (
    <>
      <div className="space-y-3 md:hidden">
        {matrix.sections.map((section) => (
          <Card key={section.group.id}>
            <p className="mb-3 font-semibold text-[var(--brand)]">
              {section.parent
                ? `${groupLabel(section.parent, t)} / ${groupLabel(section.group, t)}`
                : groupLabel(section.group, t)}
            </p>
            <ul className="space-y-4">
              {section.rows.map((row) => (
                <li
                  key={row.ingredient.id}
                  className="border-t border-[var(--line)] pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Thumb
                      src={
                        row.ingredient.hasImage
                          ? ingredientThumbUrl(
                              row.ingredient.id,
                              row.ingredient.imageRev,
                            )
                          : undefined
                      }
                      alt={row.ingredient.nameEn || row.ingredient.name}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">
                        {row.ingredient.nameEn ||
                          row.ingredient.name ||
                          deletedLabel}
                      </p>
                      {row.ingredient.name && row.ingredient.nameEn && (
                        <p className="truncate text-xs text-[var(--ink)]">
                          {row.ingredient.name}
                        </p>
                      )}
                      <p className="truncate text-xs text-[var(--muted)]">
                        {[row.ingredient.code, row.ingredient.remark]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {matrix.buyers.map((buyer) => (
                      <div
                        key={buyer.id}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <dt className="truncate text-[var(--muted)]">
                          {buyer.name || deletedLabel}
                        </dt>
                        <dd className="font-medium">
                          {row.quantities[buyer.id] || "—"}
                        </dd>
                      </div>
                    ))}
                    <div className="col-span-2 flex items-baseline justify-between gap-2 border-t border-[var(--line)] pt-1 font-semibold">
                      <dt>{t("common.total")}</dt>
                      <dd>{row.total}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-3xl bg-white ring-1 ring-[var(--line)] md:block">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--brand)] text-white">
              <th className="sticky left-0 z-10 bg-[var(--brand)] px-3 py-2 text-left font-semibold">
                {t("summary.nameEn")}
              </th>
              {matrix.buyers.map((buyer) => (
                <th key={buyer.id} className="px-3 py-2 font-semibold">
                  {buyer.name || deletedLabel}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">{t("common.total")}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.sections.map((section, index) => {
              const prev = matrix.sections[index - 1];
              const top = section.parent ?? section.group;
              const prevTopId = prev ? (prev.parent ?? prev.group).id : null;
              return (
                <SectionRows
                  key={section.group.id}
                  topTitle={top.id !== prevTopId ? groupLabel(top, t) : undefined}
                  subTitle={
                    section.parent ? groupLabel(section.group, t) : undefined
                  }
                  colSpan={matrix.buyers.length + 2}
                  rows={section.rows}
                  buyers={matrix.buyers}
                  deletedLabel={deletedLabel}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + Math.max(0, days));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function withTotals(snapshot: InvoiceSnapshot): InvoiceSnapshot {
  const lines = snapshot.lines.map((line) => ({
    ...line,
    amount: line.quantity * line.price,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax = subtotal * (snapshot.taxRate / 100);
  return { ...snapshot, lines, subtotal, tax, total: subtotal + tax };
}

export function initialInvoiceSnapshot(
  matrix: SummaryMatrix,
  buyer: Buyer,
  settings: InvoiceSettings,
): InvoiceSnapshot {
  const data = buildInvoiceData(matrix, settings, settings.nextInvoiceNumber);
  return withTotals({
    companyName: settings.companyName,
    tagline: settings.tagline,
    phone: settings.phone,
    abn: settings.abn,
    email: settings.email,
    address: settings.address,
    bankName: settings.bankName,
    accountName: settings.accountName,
    bsb: settings.bsb,
    accountNumber: settings.accountNumber,
    paymentNote: settings.paymentNote,
    deliveryNote: settings.deliveryNote,
    currency: settings.currency,
    taxRate: settings.taxRate,
    dueDays: settings.dueDays,
    billTo: { name: buyer.name, address: buyer.address, phone: buyer.phone },
    shipTo: { name: buyer.name, address: buyer.address, phone: buyer.phone },
    lines: data.lines.map((line) => ({ ...line })),
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    issuedAt: todayIso(),
    dueAt: addDaysIso(todayIso(), settings.dueDays),
  });
}

export function InvoiceEditSheet({
  matrix,
  buyer,
  settings,
  fontFamily,
  onClose,
  onExported,
}: {
  matrix: SummaryMatrix;
  buyer: Buyer;
  settings: InvoiceSettings;
  fontFamily: string;
  onClose: () => void;
  onExported: () => void;
}) {
  const { t } = useTranslation();
  const saveInvoiceRecord = useAppStore((s) => s.saveInvoiceRecord);
  const user = useAuthStore((s) => s.user);
  const [snapshot, setSnapshot] = useState<InvoiceSnapshot>(() =>
    initialInvoiceSnapshot(matrix, buyer, settings),
  );
  const [invoiceNo, setInvoiceNo] = useState(() =>
    formatInvoiceNumber(settings.invoicePrefix, settings.nextInvoiceNumber),
  );
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<InvoiceSnapshot>) =>
    setSnapshot((prev) => withTotals({ ...prev, ...patch }));

  const updateParty = (
    key: "billTo" | "shipTo",
    field: "name" | "address" | "phone",
    value: string,
  ) =>
    setSnapshot((prev) =>
      withTotals({
        ...prev,
        [key]: { ...prev[key], [field]: value },
      }),
    );

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

  const addLine = () =>
    setSnapshot((prev) =>
      withTotals({
        ...prev,
        lines: [
          ...prev.lines,
          { description: "", quantity: 1, price: 0, amount: 0 },
        ],
      }),
    );

  const removeLine = (index: number) =>
    setSnapshot((prev) =>
      withTotals({
        ...prev,
        lines: prev.lines.filter((_, lineIndex) => lineIndex !== index),
      }),
    );

  const exportNow = async (format: "excel" | "pdf") => {
    if (!invoiceNo.trim()) {
      setError(t("invoice.needNumber"));
      return;
    }
    setError(null);
    setBusy(format);
    try {
      const number =
        Number((invoiceNo.match(/(\d+)$/) ?? [])[1]) ||
        settings.nextInvoiceNumber;
      const record: InvoiceRecord = {
        id: `invoice-${crypto.randomUUID()}`,
        invoiceNo: invoiceNo.trim(),
        invoiceNumber: number,
        buyerId: buyer.id,
        buyerName: buyer.name,
        from: matrix.from,
        to: matrix.to,
        snapshot,
        createdBy: user?.id ?? "local",
        createdByName: user?.username ?? "local",
        createdAt: Date.now(),
      };
      // 先打印/导出，再写发票记录：即使服务器暂时 502，也不会挡住 PDF。
      if (format === "excel") {
        await exportInvoiceSnapshot(snapshot, invoiceNo.trim(), fontFamily);
      } else {
        await printInvoiceSnapshot(snapshot, invoiceNo.trim(), fontFamily);
      }
      try {
        await saveInvoiceRecord(record);
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : String(saveError);
        setError(
          `${t("invoice.exportedFileUnsaved")}${
            message.includes("502")
              ? ` ${t("invoice.serverUnavailable")}`
              : ` ${message}`
          }`,
        );
        return;
      }
      onExported();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message === "popup-blocked"
          ? t("invoice.popupBlocked")
          : message === "invoice-number-taken"
            ? t("invoice.numberTaken")
            : message.includes("502")
              ? t("invoice.serverUnavailable")
              : message,
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet title={t("invoice.editTitle")} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {t("invoice.editHint")}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("invoice.number")}>
            <TextInput
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
          </Field>
          <Field label={t("invoice.issueDate")}>
            <TextInput
              type="date"
              value={snapshot.issuedAt}
              onChange={(event) => update({ issuedAt: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.dueDate")}>
            <TextInput
              type="date"
              value={snapshot.dueAt}
              onChange={(event) => update({ dueAt: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.companyName")}>
            <TextInput
              value={snapshot.companyName}
              onChange={(event) => update({ companyName: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.tagline")}>
            <TextInput
              value={snapshot.tagline}
              onChange={(event) => update({ tagline: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.phone")}>
            <TextInput
              value={snapshot.phone}
              onChange={(event) => update({ phone: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.abn")}>
            <TextInput
              value={snapshot.abn}
              onChange={(event) => update({ abn: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.email")}>
            <TextInput
              value={snapshot.email}
              onChange={(event) => update({ email: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.address")}>
            <TextInput
              value={snapshot.address}
              onChange={(event) => update({ address: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-2xl bg-[var(--bg)] p-3">
            <p className="text-sm font-semibold">Bill to</p>
            <Field label={t("common.name")}>
              <TextInput
                value={snapshot.billTo.name}
                onChange={(event) =>
                  updateParty("billTo", "name", event.target.value)
                }
              />
            </Field>
            <Field label={t("buyers.address")}>
              <TextInput
                value={snapshot.billTo.address}
                onChange={(event) =>
                  updateParty("billTo", "address", event.target.value)
                }
              />
            </Field>
            <Field label={t("buyers.phone")}>
              <TextInput
                value={snapshot.billTo.phone}
                onChange={(event) =>
                  updateParty("billTo", "phone", event.target.value)
                }
              />
            </Field>
          </div>
          <div className="space-y-2 rounded-2xl bg-[var(--bg)] p-3">
            <p className="text-sm font-semibold">Ship to</p>
            <Field label={t("common.name")}>
              <TextInput
                value={snapshot.shipTo.name}
                onChange={(event) =>
                  updateParty("shipTo", "name", event.target.value)
                }
              />
            </Field>
            <Field label={t("buyers.address")}>
              <TextInput
                value={snapshot.shipTo.address}
                onChange={(event) =>
                  updateParty("shipTo", "address", event.target.value)
                }
              />
            </Field>
            <Field label={t("buyers.phone")}>
              <TextInput
                value={snapshot.shipTo.phone}
                onChange={(event) =>
                  updateParty("shipTo", "phone", event.target.value)
                }
              />
            </Field>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t("invoice.lines")}</p>
            <GhostButton onClick={addLine}>{t("invoice.addLine")}</GhostButton>
          </div>
          {snapshot.lines.map((line, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-2xl bg-[var(--bg)] p-3 sm:grid-cols-[1fr_5rem_6rem_6rem_auto]"
            >
              <TextInput
                value={line.description}
                placeholder={t("invoice.description")}
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
              <GhostButton danger onClick={() => removeLine(index)}>
                ×
              </GhostButton>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.taxRate")}>
            <TextInput
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={snapshot.taxRate}
              onChange={(event) =>
                update({ taxRate: Number(event.target.value) || 0 })
              }
            />
          </Field>
          <Field label={t("invoice.currency")}>
            <TextInput
              value={snapshot.currency}
              onChange={(event) => update({ currency: event.target.value })}
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-[var(--bg)] p-3 text-sm">
          <div className="flex justify-between">
            <span>{t("invoice.subtotal")}</span>
            <span>{snapshot.subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>
              {t("invoice.tax")} ({snapshot.taxRate}%)
            </span>
            <span>{snapshot.tax.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>{t("common.total")}</span>
            <span>
              {snapshot.currency}
              {snapshot.total.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("invoice.bankName")}>
            <TextInput
              value={snapshot.bankName}
              onChange={(event) => update({ bankName: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.accountName")}>
            <TextInput
              value={snapshot.accountName}
              onChange={(event) => update({ accountName: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.bsb")}>
            <TextInput
              value={snapshot.bsb}
              onChange={(event) => update({ bsb: event.target.value })}
            />
          </Field>
          <Field label={t("invoice.accountNumber")}>
            <TextInput
              value={snapshot.accountNumber}
              onChange={(event) =>
                update({ accountNumber: event.target.value })
              }
            />
          </Field>
        </div>

        <Field label={t("invoice.paymentNote")}>
          <TextArea
            rows={3}
            value={snapshot.paymentNote}
            onChange={(event) => update({ paymentNote: event.target.value })}
          />
        </Field>
        <Field label={t("invoice.deliveryNote")}>
          <TextArea
            rows={3}
            value={snapshot.deliveryNote}
            onChange={(event) => update({ deliveryNote: event.target.value })}
          />
        </Field>

        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <GhostButton onClick={onClose}>{t("common.cancel")}</GhostButton>
          <GhostButton
            disabled={busy !== null}
            onClick={() => void exportNow("pdf")}
          >
            {busy === "pdf" ? t("data.exporting") : t("invoice.exportPdf")}
          </GhostButton>
          <PrimaryButton
            disabled={busy !== null}
            onClick={() => void exportNow("excel")}
          >
            {busy === "excel" ? t("data.exporting") : t("invoice.exportExcel")}
          </PrimaryButton>
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          {t("invoice.pdfHint")}
        </p>
      </div>
    </Sheet>
  );
}

function SectionRows({
  topTitle,
  subTitle,
  colSpan,
  rows,
  buyers,
  deletedLabel,
}: {
  topTitle?: string;
  subTitle?: string;
  colSpan: number;
  rows: ReturnType<typeof buildSummary>["sections"][number]["rows"];
  buyers: ReturnType<typeof buildSummary>["buyers"];
  deletedLabel: string;
}) {
  return (
    <>
      {topTitle ? (
        <tr>
          <td
            colSpan={colSpan}
            className="bg-[var(--brand-soft)] px-3 py-2 font-semibold text-[var(--brand)]"
          >
            {topTitle}
          </td>
        </tr>
      ) : null}
      {subTitle ? (
        <tr>
          <td
            colSpan={colSpan}
            className="bg-[var(--bg)] px-3 py-1.5 text-sm font-medium text-[var(--brand)]"
          >
            <span className="pl-4">▸ {subTitle}</span>
          </td>
        </tr>
      ) : null}
      {rows.map((row) => (
        <tr key={row.ingredient.id} className="border-t border-[var(--line)]">
          <td className="sticky left-0 bg-white px-3 py-2">
            <div className="flex items-center gap-2">
              <Thumb
                src={
                  row.ingredient.hasImage
                    ? ingredientThumbUrl(row.ingredient.id, row.ingredient.imageRev)
                    : undefined
                }
                alt={row.ingredient.nameEn || row.ingredient.name}
                size={36}
              />
              <div className="min-w-0">
                <p className="font-medium">
                  {row.ingredient.nameEn || row.ingredient.name || deletedLabel}
                </p>
                {row.ingredient.name && row.ingredient.nameEn && (
                  <p className="text-xs text-[var(--ink)]">{row.ingredient.name}</p>
                )}
                <p className="text-xs text-[var(--muted)]">
                  {[row.ingredient.code, row.ingredient.remark]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </td>
          {buyers.map((buyer) => (
            <td key={buyer.id} className="px-3 py-2 text-center">
              {row.quantities[buyer.id] ? row.quantities[buyer.id] : ""}
            </td>
          ))}
          <td className="px-3 py-2 text-center font-semibold">{row.total}</td>
        </tr>
      ))}
    </>
  );
}
