import { saveAs } from "file-saver";
import type { Buyer, InvoiceSnapshot, SummaryMatrix } from "../types";
import {
  addPickingListSheet,
  type PickingListLabels,
} from "./exportPickingList";
import {
  addInvoiceSnapshotSheet,
  formatAmount,
} from "./exportInvoice";
import { downloadHtmlAsPdf } from "./pdf";

export type BatchPickingItem = {
  buyer: Buyer;
  matrix: SummaryMatrix;
};

export type BatchExportItem = BatchPickingItem & {
  snapshot: InvoiceSnapshot;
  invoiceNo: string;
};

export type BatchPrintLabels = {
  invoiceTitle: string;
  invoiceNo: string;
  issueDate: string;
  dueDate: string;
  billTo: string;
  shipTo: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  subtotal: string;
  tax: string;
  total: string;
  bankDetails: string;
  paymentNote: string;
};

function safeFileName(value: string) {
  return (value || "customer").replace(/[\\/:*?"<>|]/g, "_");
}

export async function exportBatchZip(
  items: BatchExportItem[],
  fontFamily: string,
) {
  if (items.length === 0) return;
  const [{ default: JSZip }, { default: ExcelJS }] = await Promise.all([
    import("jszip"),
    import("exceljs"),
  ]);
  const zip = new JSZip();

  // 发票批量导出：每个客户一个 Excel。
  for (const item of items) {
    const workbook = new ExcelJS.Workbook();
    addInvoiceSnapshotSheet(
      workbook,
      item.snapshot,
      item.invoiceNo,
      fontFamily,
    );
    const buffer = await workbook.xlsx.writeBuffer();
    zip.file(
      `${safeFileName(item.buyer.code || item.buyer.name)} - ${safeFileName(
        item.invoiceNo,
      )}.xlsx`,
      new Uint8Array(buffer),
    );
  }

  const first = items[0];
  const range =
    first.matrix.from === first.matrix.to
      ? first.matrix.from
      : `${first.matrix.from}_${first.matrix.to}`;
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `EcoLink-invoices-${range}.zip`);
}

export async function exportBatchPickingZip(
  items: BatchPickingItem[],
  pickingLabels: PickingListLabels,
  locale: "zh" | "en",
) {
  if (items.length === 0) return;
  const [{ default: JSZip }, { default: ExcelJS }] = await Promise.all([
    import("jszip"),
    import("exceljs"),
  ]);
  const zip = new JSZip();
  const label = locale === "zh" ? "拣货单" : "picking-list";

  for (const item of items) {
    const workbook = new ExcelJS.Workbook();
    addPickingListSheet(workbook, item.matrix, pickingLabels, {
      buyerIds: [item.buyer.id],
    });
    const buffer = await workbook.xlsx.writeBuffer();
    zip.file(
      `${safeFileName(item.buyer.code || item.buyer.name)} - ${label}.xlsx`,
      new Uint8Array(buffer),
    );
  }

  const first = items[0];
  const range =
    first.matrix.from === first.matrix.to
      ? first.matrix.from
      : `${first.matrix.from}_${first.matrix.to}`;
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `EcoLink-picking-${range}.zip`);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlLines(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function money(currency: string, value: number) {
  return `${escapeHtml(currency)}${formatAmount(value)}`;
}

function quantity(value: number) {
  return value.toLocaleString("en-AU", { maximumFractionDigits: 3 });
}

function invoicePage(item: BatchExportItem, labels: BatchPrintLabels) {
  const snapshot = item.snapshot;
  const lines = snapshot.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.description)}</td>
        <td class="r">${quantity(line.quantity)}</td>
        <td class="r">${money(snapshot.currency, line.price)}</td>
        <td class="r">${money(snapshot.currency, line.amount)}</td>
      </tr>`,
    )
    .join("");

  const bank = [
    snapshot.bankName,
    snapshot.accountName,
    snapshot.bsb ? `BSB ${snapshot.bsb}` : "",
    snapshot.accountNumber ? `Account ${snapshot.accountNumber}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<section class="doc">
    <div class="invoice-head">
      <div>
        <h1>${escapeHtml(snapshot.companyName || labels.invoiceTitle)}</h1>
        ${snapshot.tagline ? `<p class="meta">${escapeHtml(snapshot.tagline)}</p>` : ""}
        ${snapshot.phone ? `<p class="meta">${escapeHtml(snapshot.phone)}</p>` : ""}
        ${snapshot.abn ? `<p class="meta">ABN ${escapeHtml(snapshot.abn)}</p>` : ""}
        ${snapshot.email ? `<p class="meta">${escapeHtml(snapshot.email)}</p>` : ""}
        ${snapshot.address ? `<p class="meta">${htmlLines(snapshot.address)}</p>` : ""}
      </div>
      <div class="invoice-meta">
        <p><strong>${escapeHtml(labels.invoiceTitle)}</strong></p>
        <p>${escapeHtml(labels.invoiceNo)}: ${escapeHtml(item.invoiceNo)}</p>
        <p>${escapeHtml(labels.issueDate)}: ${escapeHtml(snapshot.issuedAt)}</p>
        <p>${escapeHtml(labels.dueDate)}: ${escapeHtml(snapshot.dueAt)}</p>
      </div>
    </div>
    <div class="parties">
      <div>
        <p class="label">${escapeHtml(labels.billTo)}</p>
        <p>${escapeHtml(snapshot.billTo.name)}</p>
        <p class="meta">${htmlLines(snapshot.billTo.address)}</p>
        <p class="meta">${escapeHtml(snapshot.billTo.phone)}</p>
      </div>
      <div>
        <p class="label">${escapeHtml(labels.shipTo)}</p>
        <p>${escapeHtml(snapshot.shipTo.name)}</p>
        <p class="meta">${htmlLines(snapshot.shipTo.address)}</p>
        <p class="meta">${escapeHtml(snapshot.shipTo.phone)}</p>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>${escapeHtml(labels.description)}</th>
        <th class="r">${escapeHtml(labels.quantity)}</th>
        <th class="r">${escapeHtml(labels.unitPrice)}</th>
        <th class="r">${escapeHtml(labels.amount)}</th>
      </tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="totals">
      <p><span>${escapeHtml(labels.subtotal)}</span><strong>${money(
        snapshot.currency,
        snapshot.subtotal,
      )}</strong></p>
      <p><span>${escapeHtml(labels.tax)}</span><strong>${money(
        snapshot.currency,
        snapshot.tax,
      )}</strong></p>
      <p class="grand"><span>${escapeHtml(labels.total)}</span><strong>${money(
        snapshot.currency,
        snapshot.total,
      )}</strong></p>
    </div>
    ${
      snapshot.ingredientCategories.length > 0
        ? `<p class="note"><strong>Ingredient categories:</strong> ${escapeHtml(
            snapshot.ingredientCategories.join(", "),
          )}</p>`
        : ""
    }
    ${
      bank
        ? `<p class="note"><strong>${escapeHtml(
            labels.bankDetails,
          )}</strong> ${escapeHtml(bank)}</p>`
        : ""
    }
    ${
      snapshot.paymentNote
        ? `<p class="note"><strong>${escapeHtml(
            labels.paymentNote,
          )}</strong> ${htmlLines(snapshot.paymentNote)}</p>`
        : ""
    }
  </section>`;
}

function buildInvoicePrintHtml(bodyHtml: string, fontFamily: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>EcoLink</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111827;
    font-family: "${fontFamily}", Arial, "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 11px;
  }
  .doc {
    page-break-after: always;
    padding-bottom: 8mm;
  }
  .doc:last-child { page-break-after: auto; }
  h1 { margin: 0 0 4px; font-size: 19px; }
  p { margin: 2px 0; }
  .meta { color: #6b7280; font-size: 10px; }
  .label { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th {
    background: #1b7a4e;
    color: #fff;
    text-align: left;
    padding: 6px;
    font-size: 10px;
  }
  thead { display: table-header-group; }
  td { border-bottom: 1px solid #e5e7eb; padding: 5px 6px; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .invoice-head { display: flex; justify-content: space-between; gap: 20px; }
  .invoice-meta { text-align: right; white-space: nowrap; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; }
  .totals { width: 260px; margin: 10px 0 0 auto; }
  .totals p { display: flex; justify-content: space-between; gap: 20px; padding: 3px 0; }
  .totals .grand { border-top: 1px solid #111827; margin-top: 3px; padding-top: 5px; font-size: 12px; }
  .note { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** 批量导出发票 PDF 文件，每个客户一页。 */
export async function downloadBatchInvoicesPdf(
  items: BatchExportItem[],
  labels: BatchPrintLabels,
  fontFamily: string,
) {
  if (items.length === 0) return;
  const body = items.map((item) => invoicePage(item, labels)).join("");
  const first = items[0];
  const range =
    first.matrix.from === first.matrix.to
      ? first.matrix.from
      : `${first.matrix.from}_${first.matrix.to}`;
  await downloadHtmlAsPdf(
    buildInvoicePrintHtml(body, fontFamily),
    `EcoLink-invoices-${range}.pdf`,
  );
}
