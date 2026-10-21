import { saveAs } from "file-saver";
import type { Workbook } from "exceljs";
import { downloadHtmlAsPdf } from "./pdf";
import i18n from "../i18n";
import type {
  Buyer,
  Group,
  InvoiceSettings,
  InvoiceSnapshot,
  SummaryMatrix,
} from "../types";
import { applyPageSetup, fontFor } from "./excelStyle";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DARK = "FF111827";
const MUTED = "FF6B7280";
const LINE = "FFD1D5DB";
const SOFT = "FFF3F4F6";

export function formatInvoiceNumber(prefix: string, value: number) {
  return `${prefix}${String(Math.max(1, Math.round(value))).padStart(4, "0")}`;
}

export function formatInvoiceDate(date: Date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** 带货币符号，如 $3,113.55 */
export function formatMoney(currency: string, value: number) {
  return `${currency}${formatAmount(value)}`;
}

/** 不带货币符号，如 1,201.50 */
export function formatAmount(value: number) {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type InvoiceLine = {
  description: string;
  quantity: number;
  price: number;
  amount: number;
};

export type InvoiceData = {
  lines: InvoiceLine[];
  ingredientCategories: string[];
  subtotal: number;
  tax: number;
  total: number;
  issueDate: Date;
  dueDate: Date;
  invoiceNo: string;
};

function categoryLabel(group: Group | undefined, parent?: Group) {
  const labelFor = (item: Group | undefined) => {
    if (!item || item.id === "__deleted") return i18n.t("common.deletedItem");
    if (item.i18nKey) return i18n.t(`groups.${item.i18nKey}`);
    return item.name || i18n.t("common.unnamed");
  };
  return parent ? `${labelFor(parent)} / ${labelFor(group)}` : labelFor(group);
}

export function buildInvoiceData(
  matrix: SummaryMatrix,
  settings: InvoiceSettings,
  invoiceNumber: number,
): InvoiceData {
  const issueDate = new Date();
  const dueDate = new Date(
    issueDate.getTime() + Math.max(0, settings.dueDays) * 24 * 60 * 60 * 1000,
  );

  const lines = matrix.sections
    .map((section) => {
      const amount = section.rows.reduce(
        (sum, row) => sum + row.total * (row.ingredient.price ?? 0),
        0,
      );
      return {
        description: categoryLabel(section.group, section.parent),
        quantity: 1,
        price: amount,
        amount,
      };
    })
    .filter((line) => line.amount !== 0 || line.description);
  const ingredientCategories = lines.map((line) => line.description);

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax = Number(settings.taxAmount) || 0;

  return {
    lines,
    ingredientCategories,
    subtotal,
    tax,
    total: subtotal + tax,
    issueDate,
    dueDate,
    invoiceNo: formatInvoiceNumber(settings.invoicePrefix, invoiceNumber),
  };
}

export function invoiceFileName(
  buyerName: string,
  settings: InvoiceSettings,
  invoiceNumber: number,
) {
  return `Invoice ${formatInvoiceNumber(
    settings.invoicePrefix,
    invoiceNumber,
  )} - ${buyerName.replace(/[\\/:*?"<>|]/g, "_") || "customer"}.xlsx`;
}

export function addInvoiceSheet(
  workbook: Workbook,
  matrix: SummaryMatrix,
  buyer: Buyer,
  settings: InvoiceSettings,
  invoiceNumber: number,
  fontFamily = "Arial",
  override?: InvoiceData,
  shipTo?: Buyer,
) {
  const data = override ?? buildInvoiceData(matrix, settings, invoiceNumber);
  const {
    lines,
    ingredientCategories,
    subtotal,
    tax,
    total,
    issueDate,
    dueDate,
    invoiceNo,
  } = data;

  workbook.creator = settings.companyName || "EcoLink";
  const sheet = workbook.addWorksheet("Invoice", {
    views: [{ state: "frozen", ySplit: 0 }],
  });

  const lastCol = 4;
  sheet.getColumn(1).width = 46;
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 18;

  const merge = (row: number, from: number, to: number) => {
    if (to > from) sheet.mergeCells(row, from, row, to);
  };

  const setCell = (
    row: number,
    col: number,
    value: string | number,
    options: {
      bold?: boolean;
      size?: number;
      color?: string;
      align?: "left" | "center" | "right";
      wrap?: boolean;
      fill?: string;
    } = {},
  ) => {
    const cell = sheet.getCell(row, col);
    cell.value = value;
    cell.font = fontFor(
      fontFamily,
      options.size ?? 10,
      options.bold,
      options.color ?? DARK,
    );
    cell.alignment = {
      vertical: "middle",
      horizontal: options.align ?? "left",
      wrapText: options.wrap ?? false,
    };
    if (options.fill) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: options.fill },
      };
    }
    return cell;
  };

  // 标题
  merge(1, 1, lastCol);
  setCell(1, 1, "Tax Invoice", { bold: true, size: 24 });
  sheet.getRow(1).height = 34;

  // 公司名 / 标语
  merge(2, 1, lastCol);
  setCell(2, 1, settings.companyName, {
    bold: true,
    size: 15,
    align: "right",
    color: "FF1B7A4E",
  });
  if (settings.tagline) {
    merge(3, 1, lastCol);
    setCell(3, 1, `"${settings.tagline}"`, {
      size: 9,
      align: "right",
      color: MUTED,
    });
  }
  sheet.getRow(2).height = 22;

  // Bill to / Ship to / 公司信息
  const blockStart = 5;
  merge(blockStart, 1, 2);
  setCell(blockStart, 1, "Bill to", { bold: true, size: 9, color: MUTED });
  merge(blockStart, 3, 4);
  setCell(blockStart, 3, "Ship to", { bold: true, size: 9, color: MUTED });
  setCell(blockStart, 4, settings.companyName, {
    bold: true,
    size: 10,
    align: "right",
  });

  const billLines = [
    buyer.name,
    buyer.address,
    buyer.phone ? `Phone: ${buyer.phone}` : "",
  ].filter(Boolean);
  const shipLines = shipTo
    ? [
        shipTo.name,
        shipTo.address,
        shipTo.phone ? `Phone: ${shipTo.phone}` : "",
      ].filter(Boolean)
    : billLines;
  const companyLines = [
    settings.tagline ? `"${settings.tagline}"` : "",
    settings.phone ? `Phone:${settings.phone}` : "",
    settings.abn ? `ABN:${settings.abn}` : "",
    settings.email,
    settings.address,
  ].filter(Boolean);

  const blockRows = Math.max(billLines.length, shipLines.length, companyLines.length, 2);
  for (let i = 0; i < blockRows; i += 1) {
    const row = blockStart + 1 + i;
    merge(row, 1, 2);
    setCell(row, 1, billLines[i] ?? "", { size: 9, wrap: true });
    merge(row, 3, 4);
    setCell(row, 3, shipLines[i] ?? "", { size: 9, wrap: true });
    setCell(row, 4, companyLines[i] ?? "", {
      size: 9,
      align: "right",
      wrap: true,
      color: MUTED,
    });
  }

  // 金额 / 日期 / 发票号
  const metaLabelRow = blockStart + blockRows + 2;
  const metaValueRow = metaLabelRow + 1;
  const labels: { col: number; to: number; label: string }[] = [
    { col: 1, to: 1, label: "Amount due" },
    { col: 2, to: 2, label: "Due date" },
    { col: 3, to: 3, label: "Issue date" },
    { col: 4, to: 4, label: "Invoice number" },
  ];
  for (const item of labels) {
    merge(metaLabelRow, item.col, item.to);
    setCell(metaLabelRow, item.col, item.label, { size: 9, color: MUTED });
  }
  setCell(metaValueRow, 1, formatMoney(settings.currency, total), {
    bold: true,
    size: 15,
  });
  setCell(metaValueRow, 2, formatInvoiceDate(dueDate), { bold: true, size: 11 });
  setCell(metaValueRow, 3, formatInvoiceDate(issueDate), {
    bold: true,
    size: 11,
  });
  setCell(metaValueRow, 4, invoiceNo, { bold: true, size: 11 });
  sheet.getRow(metaValueRow).height = 22;

  // 明细表
  const headerRow = metaValueRow + 2;
  const headerLabels = ["Description", "Quantity", "Price", "Amount"];
  headerLabels.forEach((label, index) => {
    const cell = setCell(headerRow, index + 1, label, {
      bold: true,
      size: 10,
      align: index === 0 ? "left" : "center",
      fill: SOFT,
    });
    cell.border = {
      top: { style: "thin", color: { argb: LINE } },
      bottom: { style: "thin", color: { argb: LINE } },
    };
  });
  sheet.getRow(headerRow).height = 22;

  let rowIndex = headerRow + 1;
  for (const line of lines) {
    setCell(rowIndex, 1, line.description, { size: 10, wrap: true });
    setCell(rowIndex, 2, line.quantity, { size: 10, align: "right" });
    setCell(rowIndex, 3, line.price, { size: 10, align: "right" });
    setCell(rowIndex, 4, line.amount, { size: 10, align: "right" });
    sheet.getCell(rowIndex, 2).numFmt = "#,##0.##";
    sheet.getCell(rowIndex, 3).numFmt = "#,##0.00";
    sheet.getCell(rowIndex, 4).numFmt = "#,##0.00";
    for (let col = 1; col <= lastCol; col += 1) {
      sheet.getCell(rowIndex, col).border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    }
    rowIndex += 1;
  }

  // 合计
  rowIndex += 1;
  const totals: { label: string; value: number; bold?: boolean; size?: number }[] =
    [
      { label: "Subtotal", value: subtotal },
      ...(tax > 0 ? [{ label: "GST", value: tax }] : []),
      { label: "Total", value: total, bold: true },
      { label: "Amount due", value: total, bold: true, size: 12 },
    ];
  for (const item of totals) {
    setCell(rowIndex, 3, item.label, {
      size: item.size ? item.size - 1 : 10,
      bold: item.bold,
      align: "right",
      color: item.bold ? DARK : MUTED,
    });
    const valueCell = setCell(
      rowIndex,
      4,
      item.label === "Amount due"
        ? formatMoney(settings.currency, item.value)
        : formatAmount(item.value),
      {
        size: item.size ?? 10,
        bold: item.bold,
        align: "right",
      },
    );
    if (item.label === "Subtotal") {
      valueCell.border = {
        top: { style: "thin", color: { argb: LINE } },
      };
    }
    rowIndex += 1;
  }

  // 付款信息
  rowIndex += 1;
  const writeNote = (text: string, cols: [number, number], size = 9) => {
    if (!text) return;
    merge(rowIndex, cols[0], cols[1]);
    setCell(rowIndex, cols[0], text, { size, wrap: true, color: DARK });
    rowIndex += 1;
  };

  if (ingredientCategories.length > 0) {
    writeNote(
      `Ingredient categories: ${ingredientCategories.join(", ")}`,
      [1, lastCol],
    );
    rowIndex += 1;
  }
  for (const line of settings.paymentNote.split(/\r?\n/)) {
    writeNote(line, [1, 3]);
  }
  rowIndex += 1;
  writeNote(`Bank: ${settings.bankName}`, [1, 3]);
  writeNote(`Account Name: ${settings.accountName}`, [1, 3]);
  writeNote(`BSB: ${settings.bsb}  ACC: ${settings.accountNumber}`, [1, 3]);
  rowIndex += 1;
  for (const line of settings.deliveryNote.split(/\r?\n/)) {
    writeNote(line, [1, lastCol]);
  }

  applyPageSetup(sheet, {
    orientation: "portrait",
    titleRows: `${headerRow}:${headerRow}`,
    footerText: invoiceNo,
    fontFamily,
  });
}

export async function buildInvoiceBuffer(
  matrix: SummaryMatrix,
  buyer: Buyer,
  settings: InvoiceSettings,
  invoiceNumber: number,
  fontFamily = "Arial",
  override?: InvoiceData,
  shipTo?: Buyer,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addInvoiceSheet(
    workbook,
    matrix,
    buyer,
    settings,
    invoiceNumber,
    fontFamily,
    override,
    shipTo,
  );
  return workbook.xlsx.writeBuffer();
}

export async function exportInvoice(
  matrix: SummaryMatrix,
  buyer: Buyer,
  settings: InvoiceSettings,
  invoiceNumber: number,
  fontFamily = "Arial",
) {
  const buffer = await buildInvoiceBuffer(
    matrix,
    buyer,
    settings,
    invoiceNumber,
    fontFamily,
  );
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    invoiceFileName(buyer.name, settings, invoiceNumber),
  );
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const htmlLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

/**
 * 生成发票的 A4 打印 HTML。PDF 由 html2pdf 直接渲染并下载，不打开打印窗口。
 * 中文用系统字体渲染，不依赖额外字体文件。
 */
export function buildInvoiceHtml(
  matrix: SummaryMatrix,
  buyer: Buyer,
  settings: InvoiceSettings,
  invoiceNumber: number,
  fontFamily = "Arial",
  override?: InvoiceData,
  shipTo?: Buyer,
) {
  const data = override ?? buildInvoiceData(matrix, settings, invoiceNumber);
  const {
    lines,
    ingredientCategories,
    subtotal,
    tax,
    total,
    issueDate,
    dueDate,
    invoiceNo,
  } = data;

  const billHtml = `
    <div>${escapeHtml(buyer.name)}</div>
    ${htmlLines(buyer.address ?? "")}
    ${buyer.phone ? `<div>Phone: ${escapeHtml(buyer.phone)}</div>` : ""}
  `;
  const shipHtml = shipTo
    ? `
    <div>${escapeHtml(shipTo.name)}</div>
    ${htmlLines(shipTo.address ?? "")}
    ${shipTo.phone ? `<div>Phone: ${escapeHtml(shipTo.phone)}</div>` : ""}
  `
    : billHtml;
  const companyHtml = `
    <div class="company-name">${escapeHtml(settings.companyName)}</div>
    ${settings.tagline ? `<div>"${escapeHtml(settings.tagline)}"</div>` : ""}
    ${settings.phone ? `<div>Phone:${escapeHtml(settings.phone)}</div>` : ""}
    ${settings.abn ? `<div>ABN:${escapeHtml(settings.abn)}</div>` : ""}
    ${settings.email ? `<div>${escapeHtml(settings.email)}</div>` : ""}
    ${settings.address ? `<div>${escapeHtml(settings.address)}</div>` : ""}
  `;
  const rowHtml = lines
    .map(
      (line) => `
      <tr>
        <td>${escapeHtml(line.description)}</td>
        <td class="r">${line.quantity.toLocaleString("en-AU", { maximumFractionDigits: 3 })}</td>
        <td class="r">${formatAmount(line.price)}</td>
        <td class="r">${formatAmount(line.amount)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(invoiceNo)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111827;
    font-family: "${fontFamily}", Arial, "Microsoft YaHei", "PingFang SC", sans-serif;
    font-size: 11px;
  }
  .page { width: 186mm; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  h1 { font-size: 32px; margin: 0; letter-spacing: -0.02em; }
  .brand { text-align: right; margin-top: 6px; }
  .brand .name { color: #1b7a4e; font-size: 17px; font-weight: 700; }
  .brand .tag { color: #6b7280; font-size: 10px; margin-top: 2px; }
  .blocks { display: flex; gap: 16px; margin-top: 22px; }
  .bill, .ship { flex: 0 0 25%; line-height: 1.5; }
  .company { flex: 1; text-align: right; line-height: 1.55; color: #6b7280; }
  .company .company-name { color: #111827; font-weight: 600; font-size: 11px; }
  .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
  .block-name { font-weight: 600; margin-top: 3px; }
  .meta { display: flex; justify-content: space-between; gap: 14px; margin-top: 24px; }
  .meta .item { min-width: 0; }
  .meta .value { font-size: 15px; font-weight: 700; margin-top: 4px; }
  .meta .due { font-size: 21px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th {
    text-align: left;
    font-size: 10px;
    padding: 8px 5px;
    background: #f3f4f6;
    border-top: 1px solid #d1d5db;
    border-bottom: 1px solid #d1d5db;
  }
  td { padding: 8px 5px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .r { text-align: right; }
  .totals { width: 44%; margin-left: auto; margin-top: 10px; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 5px; }
  .totals .row.big { font-size: 16px; font-weight: 700; border-top: 1px solid #d1d5db; }
  .notes { margin-top: 26px; line-height: 1.65; font-size: 10px; }
  .notes .block { margin-bottom: 14px; }
  .notes .bank { margin-top: 8px; }
</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <h1>Tax Invoice</h1>
      <div class="brand">
        <div class="name">${escapeHtml(settings.companyName)}</div>
        ${settings.tagline ? `<div class="tag">"${escapeHtml(settings.tagline)}"</div>` : ""}
      </div>
    </div>

    <div class="blocks">
      <div class="bill">
        <div class="label">Bill to</div>
        ${billHtml}
      </div>
      <div class="ship">
        <div class="label">Ship to</div>
        ${shipHtml}
      </div>
      <div class="company">${companyHtml}</div>
    </div>

    <div class="meta">
      <div class="item">
        <div class="label">Amount due</div>
        <div class="value due">${escapeHtml(formatMoney(settings.currency, total))}</div>
      </div>
      <div class="item">
        <div class="label">Due date</div>
        <div class="value">${formatInvoiceDate(dueDate)}</div>
      </div>
      <div class="item">
        <div class="label">Issue date</div>
        <div class="value">${formatInvoiceDate(issueDate)}</div>
      </div>
      <div class="item">
        <div class="label">Invoice number</div>
        <div class="value">${escapeHtml(invoiceNo)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="r">Quantity</th>
          <th class="r">Price</th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatAmount(subtotal)}</span></div>
      ${
        tax > 0
          ? `<div class="row"><span>GST</span><span>${formatAmount(tax)}</span></div>`
          : ""
      }
      <div class="row"><span>Total</span><span>${formatAmount(total)}</span></div>
      <div class="row big"><span>Amount due</span><span>${escapeHtml(
        formatMoney(settings.currency, total),
      )}</span></div>
    </div>

    <div class="notes">
      ${
        ingredientCategories.length > 0
          ? `<div class="block"><strong>Ingredient categories:</strong> ${escapeHtml(
              ingredientCategories.join(", "),
            )}</div>`
          : ""
      }
      <div class="block">${htmlLines(settings.paymentNote)}</div>
      <div class="block bank">
        <div>Bank: ${escapeHtml(settings.bankName)}</div>
        <div>Account Name: ${escapeHtml(settings.accountName)}</div>
        <div>BSB: ${escapeHtml(settings.bsb)} &nbsp; ACC: ${escapeHtml(
          settings.accountNumber,
        )}</div>
      </div>
      <div class="block">${htmlLines(settings.deliveryNote)}</div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function settingsFromSnapshot(snapshot: InvoiceSnapshot): InvoiceSettings {
  return {
    companyName: snapshot.companyName,
    tagline: snapshot.tagline,
    phone: snapshot.phone,
    abn: snapshot.abn,
    email: snapshot.email,
    address: snapshot.address,
    bankName: snapshot.bankName,
    accountName: snapshot.accountName,
    bsb: snapshot.bsb,
    accountNumber: snapshot.accountNumber,
    paymentNote: snapshot.paymentNote,
    deliveryNote: snapshot.deliveryNote,
    currency: snapshot.currency,
    taxAmount: snapshot.tax,
    dueDays: snapshot.dueDays,
    invoicePrefix: "",
    nextInvoiceNumber: 1,
  };
}

function buyerFromSnapshot(party: {
  name: string;
  address: string;
  phone: string;
}): Buyer {
  return {
    id: "",
    name: party.name,
    code: "",
    address: party.address,
    phone: party.phone,
    logistics: "",
    commonIngredientIds: [],
    sort: 0,
  };
}

function invoiceDataFromSnapshot(
  snapshot: InvoiceSnapshot,
  invoiceNo: string,
): InvoiceData {
  return {
    lines: snapshot.lines,
    ingredientCategories: snapshot.ingredientCategories,
    subtotal: snapshot.subtotal,
    tax: snapshot.tax,
    total: snapshot.total,
    issueDate: parseIsoDate(snapshot.issuedAt),
    dueDate: parseIsoDate(snapshot.dueAt),
    invoiceNo,
  };
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}

const EMPTY_MATRIX: SummaryMatrix = {
  from: "",
  to: "",
  buyers: [],
  sections: [],
};

export function addInvoiceSnapshotSheet(
  workbook: Workbook,
  snapshot: InvoiceSnapshot,
  invoiceNo: string,
  fontFamily = "Arial",
) {
  const buyer = buyerFromSnapshot(snapshot.billTo);
  const shipTo = buyerFromSnapshot(snapshot.shipTo);
  const settings = settingsFromSnapshot(snapshot);
  const data = invoiceDataFromSnapshot(snapshot, invoiceNo);
  addInvoiceSheet(
    workbook,
    EMPTY_MATRIX,
    buyer,
    settings,
    1,
    fontFamily,
    data,
    shipTo,
  );
}

export async function buildInvoiceSnapshotBuffer(
  snapshot: InvoiceSnapshot,
  invoiceNo: string,
  fontFamily = "Arial",
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addInvoiceSnapshotSheet(workbook, snapshot, invoiceNo, fontFamily);
  return workbook.xlsx.writeBuffer();
}

export async function exportInvoiceSnapshot(
  snapshot: InvoiceSnapshot,
  invoiceNo: string,
  fontFamily = "Arial",
) {
  const buyer = buyerFromSnapshot(snapshot.billTo);
  const buffer = await buildInvoiceSnapshotBuffer(snapshot, invoiceNo, fontFamily);
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `Invoice ${safeFileName(invoiceNo)} - ${safeFileName(buyer.name) || "customer"}.xlsx`,
  );
}

export async function printInvoiceSnapshot(
  snapshot: InvoiceSnapshot,
  invoiceNo: string,
  fontFamily = "Arial",
) {
  const buyer = buyerFromSnapshot(snapshot.billTo);
  const shipTo = buyerFromSnapshot(snapshot.shipTo);
  const settings = settingsFromSnapshot(snapshot);
  const data = invoiceDataFromSnapshot(snapshot, invoiceNo);
  const html = buildInvoiceHtml(
    EMPTY_MATRIX,
    buyer,
    settings,
    1,
    fontFamily,
    data,
    shipTo,
  );
  await downloadHtmlAsPdf(
    html,
    `Invoice ${safeFileName(invoiceNo)} - ${safeFileName(buyer.name) || "customer"}.pdf`,
  );
}
