import { saveAs } from "file-saver";
import type ExcelJS from "exceljs";
import type {
  AppDb,
  Buyer,
  Group,
  Ingredient,
  InvoiceRecord,
  PackRecord,
  PickupRecord,
} from "../types";
import { buildSummary } from "../store/useAppStore";
import { formatDateTime } from "./format";
import {
  applyPageSetup,
  BRAND_ARGB,
  BRAND_SOFT_ARGB,
  fontFor,
  styleMetaRow,
  styleTitleRow,
} from "./excelStyle";

type Locale = "zh" | "en";

const t = (locale: Locale, zh: string, en: string) => (locale === "zh" ? zh : en);

function groupName(group: Group | undefined, locale: Locale) {
  if (!group || group.id === "__deleted") {
    return t(locale, "已删除", "Deleted");
  }
  if (group.i18nKey) {
    const names: Record<string, [string, string]> = {
      fresh: ["新鲜食材", "Fresh"],
      frozen: ["冷冻食材", "Frozen"],
      packaged: ["包装食材", "Packaged"],
      uncategorized: ["未分类", "Uncategorized"],
    };
    const pair = names[group.i18nKey];
    if (pair) return locale === "zh" ? pair[0] : pair[1];
  }
  return group.name || t(locale, "未命名", "Untitled");
}

function buyerName(buyer: Buyer | undefined, locale: Locale) {
  return buyer?.name || t(locale, "已删除", "Deleted");
}

function ingredientName(item: Ingredient | undefined, locale: Locale) {
  if (!item) return t(locale, "已删除", "Deleted");
  return item.nameEn || item.name || item.code || t(locale, "已删除", "Deleted");
}

function sheetTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  meta: string,
  headers: string[],
  widths: number[],
  fontFamily: string,
  fontSize: number,
) {
  const lastCol = headers.length;
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  styleTitleRow(sheet, 1, lastCol, title, fontFamily, fontSize);
  styleMetaRow(sheet, 2, lastCol, meta, fontFamily, fontSize);

  const header = sheet.getRow(3);
  header.values = headers;
  header.eachCell((cell) => {
    cell.font = fontFor(fontFamily, fontSize, true, "FFFFFFFF");
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_ARGB },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
  header.height = 24;
  return lastCol;
}

function writeRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  values: (string | number | null)[],
  fontFamily: string,
  fontSize: number,
  options: { leftColumns?: number[]; moneyColumns?: number[] } = {},
) {
  const row = sheet.getRow(rowIndex);
  values.forEach((value, index) => {
    const cell = row.getCell(index + 1);
    cell.value = value ?? "";
    cell.font = fontFor(fontFamily, fontSize);
    cell.alignment = {
      vertical: "middle",
      horizontal: options.leftColumns?.includes(index + 1) ? "left" : "center",
      wrapText: options.leftColumns?.includes(index + 1),
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } },
    };
    if (options.moneyColumns?.includes(index + 1) && typeof value === "number") {
      cell.numFmt = "#,##0.00";
    } else if (typeof value === "number") {
      cell.numFmt = "#,##0.##";
    }
  });
  return rowIndex + 1;
}

function writeGroupRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  text: string,
  lastCol: number,
  fontFamily: string,
  fontSize: number,
  isTop: boolean,
) {
  const row = sheet.getRow(rowIndex);
  row.getCell(1).value = text;
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  row.getCell(1).font = fontFor(
    fontFamily,
    fontSize + (isTop ? 1 : 0),
    true,
    BRAND_ARGB,
  );
  row.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: isTop ? BRAND_SOFT_ARGB : "FFF4FAF6" },
  };
  row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  row.height = isTop ? 20 : 18;
  return rowIndex + 1;
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function metaText(from: string, to: string, locale: Locale) {
  return `${t(locale, "统计区间", "Range")}: ${from === to ? from : `${from} ~ ${to}`}    ${t(locale, "导出时间", "Exported at")}: ${formatDateTime()}`;
}

function collectImageIds(db: AppDb) {
  const ids: { id: string; rev: number }[] = [];
  for (const ingredient of db.ingredients) {
    if (ingredient.hasImage) ids.push({ id: ingredient.id, rev: ingredient.imageRev });
  }
  for (const record of db.pickupRecords) {
    ids.push(...record.photos, ...record.invoicePhotos);
  }
  for (const record of db.packRecords) {
    ids.push(...record.photos, ...record.invoicePhotos);
  }
  return ids;
}

function photoFileNames(photos: { id: string }[]) {
  return photos.map((photo) => `${photo.id}.jpg`).join(", ");
}

async function buildWorkbookBuffer(
  db: AppDb,
  from: string,
  to: string,
  locale: Locale,
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EcoLink";
  const fontFamily = db.settings.fontFamily;
  const fontSize = db.settings.fontSize;
  const meta = metaText(from, to, locale);

  const buyerMap = new Map(db.buyers.map((buyer) => [buyer.id, buyer]));
  const ingredientMap = new Map(
    db.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const groupMap = new Map(db.groups.map((group) => [group.id, group]));

  // 1. 订单明细
  const orders = db.orders
    .filter((order) => inRange(order.date, from, to))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (buyerMap.get(a.buyerId)?.code ?? "").localeCompare(
          buyerMap.get(b.buyerId)?.code ?? "",
        ),
    );
  const detailHeaders = [
    t(locale, "日期", "Date"),
    t(locale, "客户代码", "Customer code"),
    t(locale, "客户", "Customer"),
    "CODE",
    t(locale, "中文", "Chinese"),
    t(locale, "名字", "Name"),
    t(locale, "数量", "Qty"),
    t(locale, "单位", "Unit"),
    t(locale, "单价", "Price"),
    t(locale, "金额", "Amount"),
  ];
  const detail = workbook.addWorksheet(t(locale, "订单明细", "Order details"), {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  sheetTitle(
    detail,
    t(locale, "订单明细", "Order details"),
    meta,
    detailHeaders,
    [12, 14, 22, 10, 16, 28, 10, 8, 10, 12],
    fontFamily,
    fontSize,
  );
  let detailRow = 4;
  for (const order of orders) {
    const buyer = buyerMap.get(order.buyerId);
    for (const item of order.items) {
      if (item.quantity <= 0) continue;
      const ingredient = ingredientMap.get(item.ingredientId);
      const price = ingredient?.price ?? 0;
      detailRow = writeRow(
        detail,
        detailRow,
        [
          order.date,
          buyer?.code ?? "",
          buyerName(buyer, locale),
          ingredient?.code ?? "",
          ingredient?.name ?? "",
          ingredientName(ingredient, locale),
          item.quantity,
          ingredient?.unit ?? "",
          price,
          price > 0 ? price * item.quantity : "",
        ],
        fontFamily,
        fontSize,
        { leftColumns: [3, 6], moneyColumns: [9, 10] },
      );
    }
  }
  applyPageSetup(detail, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "订单明细", "Order details"),
    fontFamily,
  });

  // 2. 采购汇总
  const matrix = buildSummary(db, from, to);
  const summaryHeaders = [
    "CODE",
    t(locale, "名字", "Name"),
    t(locale, "中文", "Chinese"),
    ...matrix.buyers.map((buyer) => buyerName(buyer, locale)),
    t(locale, "合计", "Total"),
    t(locale, "单价", "Price"),
    t(locale, "总价", "Amount"),
  ];
  const summary = workbook.addWorksheet(t(locale, "采购汇总", "Summary"), {
    views: [{ state: "frozen", ySplit: 3, xSplit: 3 }],
  });
  const summaryLastCol = sheetTitle(
    summary,
    t(locale, "采购汇总", "Procurement summary"),
    meta,
    summaryHeaders,
    [10, 28, 15, ...matrix.buyers.map(() => 12), 10, 10, 12],
    fontFamily,
    fontSize,
  );
  let summaryRow = 4;
  let currentTopId: string | null = null;
  for (const section of matrix.sections) {
    const top = section.parent ?? section.group;
    if (top.id !== currentTopId) {
      currentTopId = top.id;
      summaryRow = writeGroupRow(
        summary,
        summaryRow,
        groupName(top, locale),
        summaryLastCol,
        fontFamily,
        fontSize,
        true,
      );
    }
    if (section.parent) {
      summaryRow = writeGroupRow(
        summary,
        summaryRow,
        groupName(section.group, locale),
        summaryLastCol,
        fontFamily,
        fontSize,
        false,
      );
    }
    for (const row of section.rows) {
      const price = row.ingredient.price ?? 0;
      summaryRow = writeRow(
        summary,
        summaryRow,
        [
          row.ingredient.code,
          row.ingredient.nameEn,
          row.ingredient.name,
          ...matrix.buyers.map((buyer) => row.quantities[buyer.id] || ""),
          row.total,
          price || "",
          price > 0 ? price * row.total : "",
        ],
        fontFamily,
        fontSize,
        { leftColumns: [2], moneyColumns: [summaryLastCol - 1, summaryLastCol] },
      );
    }
  }
  applyPageSetup(summary, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "采购汇总", "Procurement summary"),
    fontFamily,
  });

  // 3. 拣货单
  const pickingHeaders = [
    t(locale, "分组", "Group"),
    t(locale, "中文", "Chinese"),
    "CODE",
    t(locale, "名字", "Name"),
    t(locale, "数量", "Qty"),
    t(locale, "备注", "Notes"),
  ];
  const picking = workbook.addWorksheet(t(locale, "拣货单", "Picking list"), {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  sheetTitle(
    picking,
    t(locale, "拣货单", "Picking list"),
    meta,
    pickingHeaders,
    [22, 16, 10, 30, 10, 20],
    fontFamily,
    fontSize,
  );
  let pickingRow = 4;
  for (const section of matrix.sections) {
    const label = section.parent
      ? `${groupName(section.parent, locale)} / ${groupName(section.group, locale)}`
      : groupName(section.group, locale);
    pickingRow = writeGroupRow(
      picking,
      pickingRow,
      label,
      6,
      fontFamily,
      fontSize,
      !section.parent,
    );
    for (const row of section.rows) {
      pickingRow = writeRow(
        picking,
        pickingRow,
        [
          "",
          row.ingredient.name,
          row.ingredient.code,
          row.ingredient.nameEn,
          row.total,
          row.ingredient.remark,
        ],
        fontFamily,
        fontSize,
        { leftColumns: [2, 4, 6] },
      );
    }
  }
  applyPageSetup(picking, {
    orientation: "portrait",
    titleRows: "1:3",
    footerText: t(locale, "拣货单", "Picking list"),
    fontFamily,
  });

  // 4. 取货记录
  const pickups: PickupRecord[] = db.pickupRecords
    .filter((record) => inRange(record.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const pickupHeaders = [
    t(locale, "日期", "Date"),
    t(locale, "取货店名", "Pickup store"),
    t(locale, "税", "Tax"),
    t(locale, "金额", "Amount"),
    t(locale, "备注", "Notes"),
    t(locale, "取货照片", "Pickup photos"),
    t(locale, "发票照片", "Invoice photos"),
    t(locale, "录入人", "Entered by"),
    t(locale, "录入时间", "Entered at"),
  ];
  const pickupSheet = workbook.addWorksheet(t(locale, "取货记录", "Pickups"), {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  sheetTitle(
    pickupSheet,
    t(locale, "取货记录", "Pickup records"),
    meta,
    pickupHeaders,
    [12, 24, 10, 12, 24, 26, 26, 14, 18],
    fontFamily,
    fontSize,
  );
  let pickupRow = 4;
  for (const record of pickups) {
    pickupRow = writeRow(
      pickupSheet,
      pickupRow,
      [
        record.date,
        record.storeName,
        record.tax,
        record.amount,
        record.note,
        photoFileNames(record.photos),
        photoFileNames(record.invoicePhotos),
        record.createdByName,
        formatDateTime(new Date(record.createdAt)),
      ],
      fontFamily,
      fontSize,
      { leftColumns: [2, 5, 6, 7], moneyColumns: [3, 4] },
    );
  }
  applyPageSetup(pickupSheet, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "取货记录", "Pickup records"),
    fontFamily,
  });

  // 5. 打包发货记录
  const packs: PackRecord[] = db.packRecords
    .filter((record) => inRange(record.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const packHeaders = [
    t(locale, "日期", "Date"),
    t(locale, "物流", "Logistics"),
    t(locale, "发货店名", "Store"),
    t(locale, "备注", "Notes"),
    t(locale, "打包发货照片", "Packing photos"),
    t(locale, "发票照片", "Invoice photos"),
    t(locale, "录入人", "Entered by"),
    t(locale, "录入时间", "Entered at"),
  ];
  const packSheet = workbook.addWorksheet(t(locale, "打包发货", "Packing"), {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  sheetTitle(
    packSheet,
    t(locale, "打包发货记录", "Packing records"),
    meta,
    packHeaders,
    [12, 20, 24, 24, 26, 26, 14, 18],
    fontFamily,
    fontSize,
  );
  let packRow = 4;
  for (const record of packs) {
    packRow = writeRow(
      packSheet,
      packRow,
      [
        record.date,
        record.logistics,
        record.storeName,
        record.note,
        photoFileNames(record.photos),
        photoFileNames(record.invoicePhotos),
        record.createdByName,
        formatDateTime(new Date(record.createdAt)),
      ],
      fontFamily,
      fontSize,
      { leftColumns: [2, 3, 4, 5, 6] },
    );
  }
  applyPageSetup(packSheet, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "打包发货记录", "Packing records"),
    fontFamily,
  });

  // 6. 发票记录 + 发票明细
  const invoices: InvoiceRecord[] = db.invoiceRecords
    .filter((record) => inRange(record.snapshot.issuedAt, from, to))
    .sort((a, b) => a.invoiceNo.localeCompare(b.invoiceNo));
  const invoiceHeaders = [
    t(locale, "发票号", "Invoice no."),
    t(locale, "开票日", "Issue date"),
    t(locale, "客户", "Customer"),
    t(locale, "统计区间", "Range"),
    t(locale, "小计", "Subtotal"),
    t(locale, "税", "Tax"),
    t(locale, "总额", "Total"),
    t(locale, "币种", "Currency"),
    t(locale, "导出人", "Issued by"),
  ];
  const invoiceSheet = workbook.addWorksheet(
    t(locale, "发票记录", "Invoices"),
    { views: [{ state: "frozen", ySplit: 3 }] },
  );
  sheetTitle(
    invoiceSheet,
    t(locale, "发票记录", "Invoice records"),
    meta,
    invoiceHeaders,
    [16, 12, 24, 20, 12, 12, 14, 8, 14],
    fontFamily,
    fontSize,
  );
  let invoiceRow = 4;
  for (const record of invoices) {
    invoiceRow = writeRow(
      invoiceSheet,
      invoiceRow,
      [
        record.invoiceNo,
        record.snapshot.issuedAt,
        record.buyerName,
        record.from === record.to ? record.from : `${record.from} ~ ${record.to}`,
        record.snapshot.subtotal,
        record.snapshot.tax,
        record.snapshot.total,
        record.snapshot.currency,
        record.createdByName,
      ],
      fontFamily,
      fontSize,
      { leftColumns: [3], moneyColumns: [5, 6, 7] },
    );
  }
  applyPageSetup(invoiceSheet, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "发票记录", "Invoice records"),
    fontFamily,
  });

  const invoiceLineHeaders = [
    t(locale, "发票号", "Invoice no."),
    t(locale, "描述", "Description"),
    t(locale, "数量", "Qty"),
    t(locale, "单价", "Price"),
    t(locale, "金额", "Amount"),
  ];
  const invoiceLineSheet = workbook.addWorksheet(
    t(locale, "发票明细", "Invoice lines"),
    { views: [{ state: "frozen", ySplit: 3 }] },
  );
  sheetTitle(
    invoiceLineSheet,
    t(locale, "发票明细", "Invoice lines"),
    meta,
    invoiceLineHeaders,
    [16, 48, 10, 12, 14],
    fontFamily,
    fontSize,
  );
  let lineRow = 4;
  for (const record of invoices) {
    for (const line of record.snapshot.lines) {
      lineRow = writeRow(
        invoiceLineSheet,
        lineRow,
        [
          record.invoiceNo,
          line.description,
          line.quantity,
          line.price,
          line.amount,
        ],
        fontFamily,
        fontSize,
        { leftColumns: [2], moneyColumns: [4, 5] },
      );
    }
  }
  applyPageSetup(invoiceLineSheet, {
    orientation: "portrait",
    titleRows: "1:3",
    footerText: t(locale, "发票明细", "Invoice lines"),
    fontFamily,
  });

  // 7. 基础资料
  const ingredientHeaders = [
    "CODE",
    t(locale, "中文", "Chinese"),
    t(locale, "名字", "Name"),
    t(locale, "单位", "Unit"),
    t(locale, "单价", "Price"),
    t(locale, "分组", "Group"),
    t(locale, "备注", "Notes"),
  ];
  const ingredientSheet = workbook.addWorksheet(
    t(locale, "食材资料", "Ingredients"),
    { views: [{ state: "frozen", ySplit: 3 }] },
  );
  sheetTitle(
    ingredientSheet,
    t(locale, "食材资料", "Ingredient master"),
    meta,
    ingredientHeaders,
    [10, 16, 28, 8, 10, 22, 24],
    fontFamily,
    fontSize,
  );
  let ingredientRow = 4;
  for (const ingredient of [...db.ingredients].sort(
    (a, b) => a.code.localeCompare(b.code, "zh"),
  )) {
    const group = groupMap.get(ingredient.groupId);
    ingredientRow = writeRow(
      ingredientSheet,
      ingredientRow,
      [
        ingredient.code,
        ingredient.name,
        ingredient.nameEn,
        ingredient.unit,
        ingredient.price || "",
        groupName(group, locale),
        ingredient.remark,
      ],
      fontFamily,
      fontSize,
      { leftColumns: [2, 3, 6, 7], moneyColumns: [5] },
    );
  }
  applyPageSetup(ingredientSheet, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "食材资料", "Ingredient master"),
    fontFamily,
  });

  const customerHeaders = [
    t(locale, "客户代码", "Code"),
    t(locale, "客户名称", "Customer"),
    t(locale, "地址", "Address"),
    t(locale, "电话", "Phone"),
    t(locale, "物流公司", "Logistics"),
  ];
  const customerSheet = workbook.addWorksheet(
    t(locale, "客户资料", "Customers"),
    { views: [{ state: "frozen", ySplit: 3 }] },
  );
  sheetTitle(
    customerSheet,
    t(locale, "客户资料", "Customer master"),
    meta,
    customerHeaders,
    [14, 26, 32, 16, 22],
    fontFamily,
    fontSize,
  );
  let customerRow = 4;
  for (const buyer of [...db.buyers].sort((a, b) => a.sort - b.sort)) {
    customerRow = writeRow(
      customerSheet,
      customerRow,
      [
        buyer.code,
        buyer.name,
        buyer.address,
        buyer.phone,
        buyer.logistics,
      ],
      fontFamily,
      fontSize,
      { leftColumns: [2, 3, 5] },
    );
  }
  applyPageSetup(customerSheet, {
    orientation: "landscape",
    titleRows: "1:3",
    footerText: t(locale, "客户资料", "Customer master"),
    fontFamily,
  });

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function exportReadableExcel(
  db: AppDb,
  from: string,
  to: string,
  locale: Locale,
) {
  const buffer = await buildWorkbookBuffer(db, from, to, locale);
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `EcoLink-${t(locale, "汇总报表", "report")}-${from}_${to}.xlsx`,
  );
}

export async function exportArchiveZip(
  db: AppDb,
  from: string,
  to: string,
  locale: Locale,
) {
  const buffer = await buildWorkbookBuffer(db, from, to, locale);
  const { default: JSZip } = await import("jszip");
  const { ingredientPreviewUrl } = await import("../api/db");
  const zip = new JSZip();
  const root = zip.folder(`EcoLink-${from}_${to}`);
  if (!root) throw new Error("zip-failed");

  root.file(`EcoLink-${t(locale, "汇总报表", "report")}-${from}_${to}.xlsx`, buffer);
  root.file("db.json", JSON.stringify(db, null, 2));

  const photos = root.folder("photos");
  if (photos) {
    for (const item of collectImageIds(db)) {
      try {
        const response = await fetch(ingredientPreviewUrl(item.id, item.rev));
        if (!response.ok) continue;
        const blob = await response.blob();
        photos.file(`${item.id}.jpg`, blob);
      } catch {
        // 单张照片失败不影响整份归档。
      }
    }
  }

  root.file(
    "README.txt",
    [
      "EcoLink archive",
      `Range: ${from} ~ ${to}`,
      `Exported at: ${formatDateTime()}`,
      "",
      "- The .xlsx file contains readable summary, orders, pickups, packing and invoices.",
      "- photos/ contains the original preview photos referenced by the Excel sheets.",
      "- db.json is the full data file; keep it for future restore or import.",
      "",
      "EcoLink 归档包",
      `日期范围：${from} ~ ${to}`,
      `导出时间：${formatDateTime()}`,
      "",
      "- .xlsx 是可读汇总报表。",
      "- photos/ 是报表中引用的照片。",
      "- db.json 是完整数据文件，请保留以便以后恢复或导入。",
    ].join("\n"),
  );

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  saveAs(blob, `EcoLink-${t(locale, "归档", "archive")}-${from}_${to}.zip`);
}
