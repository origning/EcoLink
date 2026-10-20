import { saveAs } from "file-saver";
import type { Group, SummaryMatrix } from "../types";
import { formatDateTime } from "./format";
import {
  applyPageSetup,
  BRAND_ARGB,
  BRAND_SOFT_ARGB,
  fontFor,
  styleMetaRow,
  styleTitleRow,
} from "./excelStyle";

type Labels = {
  sheet: string;
  title: string;
  titleForBuyer: (name: string) => string;
  rangeLabel: string;
  exportedAtLabel: string;
  code: string;
  item: string;
  nameEn: string;
  total: string;
  unitPrice: string;
  totalPrice: string;
  storeAddress: string;
  storePhone: string;
  storeLogistics: string;
  orderDate: string;
  groupName: (group: Group) => string;
  deleted: string;
  fontFamily: string;
  fontSize: number;
  buyerName?: string;
};

export function summaryFileName(
  from: string,
  to: string,
  locale: "zh" | "en",
  buyerName?: string,
) {
  const prefix = locale === "zh" ? "采购汇总" : "procurement-summary";
  const who = buyerName ? `-${buyerName.replace(/[\\/:*?"<>|]/g, "_")}` : "";
  return from === to
    ? `${prefix}${who}-${from}.xlsx`
    : `${prefix}${who}-${from}_${to}.xlsx`;
}

export async function exportSummary(
  matrix: SummaryMatrix,
  labels: Labels,
  options: { buyerIds?: string[] } = {},
) {
  // 按需加载 exceljs：只有点「导出」时才下载这部分代码，首屏更快。
  const { default: ExcelJS } = await import("exceljs");
  const isSelection = Boolean(options.buyerIds && options.buyerIds.length > 0);
  const selectedIds = new Set(options.buyerIds ?? []);
  const buyers = isSelection
    ? matrix.buyers.filter((buyer) => selectedIds.has(buyer.id))
    : matrix.buyers;
  const singleBuyer = isSelection && buyers.length === 1 ? buyers[0] : undefined;
  const showTotal = !singleBuyer;

  // 单个客户汇总在标题下多一行店铺信息，后续行整体下移一行。
  const hasStoreInfo = Boolean(singleBuyer);
  const headerRowIndex = hasStoreInfo ? 4 : 3;
  const dataStartRow = headerRowIndex + 1;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EcoLink Procurement";
  const sheet = workbook.addWorksheet(labels.sheet, {
    views: [{ state: "frozen", ySplit: headerRowIndex, xSplit: 1 }],
  });

  const codeCol = 1;
  const nameCol = 2;
  const itemCol = 3;
  const firstBuyerCol = 4;
  const buyerCount = buyers.length;
  const totalCol = firstBuyerCol + buyerCount;
  const priceCol = firstBuyerCol + buyerCount + (showTotal ? 1 : 0);
  const totalPriceCol = priceCol + 1;
  const lastCol = totalPriceCol;

  sheet.getColumn(codeCol).width = 9;
  sheet.getColumn(nameCol).width = 30;
  sheet.getColumn(itemCol).width = 13;
  for (let i = 0; i < buyerCount; i += 1) {
    sheet.getColumn(firstBuyerCol + i).width = 14;
  }
  if (showTotal) sheet.getColumn(totalCol).width = 10;
  sheet.getColumn(priceCol).width = 12;
  sheet.getColumn(totalPriceCol).width = 14;

  const title =
    singleBuyer?.name && labels.titleForBuyer
      ? labels.titleForBuyer(singleBuyer.name)
      : labels.title;

  const rangeText =
    matrix.from === matrix.to ? matrix.from : `${matrix.from} ~ ${matrix.to}`;

  // 第 1 行：标题
  styleTitleRow(sheet, 1, lastCol, title, labels.fontFamily, labels.fontSize);

  // 第 2 行（仅单个客户）：店铺信息
  if (singleBuyer) {
    const parts = [
      singleBuyer.address ? `${labels.storeAddress}: ${singleBuyer.address}` : "",
      singleBuyer.phone ? `${labels.storePhone}: ${singleBuyer.phone}` : "",
      singleBuyer.logistics
        ? `${labels.storeLogistics}: ${singleBuyer.logistics}`
        : "",
      `${labels.orderDate}: ${rangeText}`,
    ].filter(Boolean);
    const infoRow = sheet.getRow(2);
    infoRow.getCell(1).value = parts.join("    ");
    sheet.mergeCells(2, 1, 2, lastCol);
    infoRow.getCell(1).font = fontFor(
      labels.fontFamily,
      labels.fontSize,
      false,
      "FF374151",
    );
    infoRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF9FAFB" },
    };
    infoRow.getCell(1).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    infoRow.height = 20;
  }

  // 日期标注行；第 headerRowIndex 行：表头
  const scopeText = singleBuyer?.name ? ` · ${singleBuyer.name}` : "";
  styleMetaRow(
    sheet,
    hasStoreInfo ? 3 : 2,
    lastCol,
    `${labels.rangeLabel}: ${rangeText}${scopeText}    ${labels.exportedAtLabel}: ${formatDateTime()}`,
    labels.fontFamily,
    labels.fontSize,
  );

  const headerValues = [
    labels.code,
    labels.nameEn,
    labels.item,
    ...buyers.map((buyer) => buyer.name || labels.deleted),
    ...(showTotal ? [labels.total] : []),
    labels.unitPrice,
    labels.totalPrice,
  ];
  const header = sheet.getRow(headerRowIndex);
  header.values = headerValues;
  header.eachCell((cell) => {
    cell.font = fontFor(labels.fontFamily, labels.fontSize, true, "FFFFFFFF");
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_ARGB },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
  header.height = 24;

  const writeGroupRow = (rowIndex: number, text: string, isTop: boolean) => {
    const groupRow = sheet.getRow(rowIndex);
    groupRow.getCell(1).value = isTop ? text : `　▸ ${text}`;
    sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
    groupRow.getCell(1).font = fontFor(
      labels.fontFamily,
      labels.fontSize + (isTop ? 1 : 0),
      true,
      BRAND_ARGB,
    );
    groupRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isTop ? BRAND_SOFT_ARGB : "FFF4FAF6" },
    };
    groupRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    groupRow.height = isTop ? 20 : 18;
    return rowIndex + 1;
  };

  let rowIndex = dataStartRow;
  let currentTopId: string | null = null;
  for (const section of matrix.sections) {
    const top = section.parent ?? section.group;
    if (top.id !== currentTopId) {
      currentTopId = top.id;
      rowIndex = writeGroupRow(rowIndex, labels.groupName(top), true);
    }
    if (section.parent) {
      rowIndex = writeGroupRow(
        rowIndex,
        labels.groupName(section.group),
        false,
      );
    }

    for (const row of section.rows) {
      const excelRow = sheet.getRow(rowIndex);

      const codeCell = excelRow.getCell(codeCol);
      codeCell.value = row.ingredient.code || "";
      codeCell.font = fontFor(labels.fontFamily, labels.fontSize);
      codeCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      const nameCell = excelRow.getCell(nameCol);
      nameCell.value = row.ingredient.nameEn || labels.deleted;
      nameCell.font = fontFor(labels.fontFamily, labels.fontSize);
      nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

      const itemCell = excelRow.getCell(itemCol);
      itemCell.value = row.ingredient.name || "";
      itemCell.font = fontFor(labels.fontFamily, labels.fontSize);
      itemCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

      buyers.forEach((buyer, index) => {
        const quantity = row.quantities[buyer.id] ?? 0;
        const cell = excelRow.getCell(firstBuyerCol + index);
        cell.value = quantity > 0 ? quantity : "";
        cell.font = fontFor(labels.fontFamily, labels.fontSize);
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      if (showTotal) {
        const totalCell = excelRow.getCell(totalCol);
        totalCell.value = row.total;
        totalCell.font = fontFor(labels.fontFamily, labels.fontSize, true);
        totalCell.alignment = { vertical: "middle", horizontal: "center" };
      }

      const price = row.ingredient.price ?? 0;
      const pricedQuantity = singleBuyer
        ? row.quantities[singleBuyer.id] ?? 0
        : row.total;

      const priceCell = excelRow.getCell(priceCol);
      priceCell.value = price > 0 ? price : "";
      priceCell.numFmt = "#,##0.00";
      priceCell.font = fontFor(labels.fontFamily, labels.fontSize);
      priceCell.alignment = { vertical: "middle", horizontal: "center" };

      const amountCell = excelRow.getCell(totalPriceCol);
      amountCell.value = price > 0 ? price * pricedQuantity : "";
      amountCell.numFmt = "#,##0.00";
      amountCell.font = fontFor(labels.fontFamily, labels.fontSize, true);
      amountCell.alignment = { vertical: "middle", horizontal: "center" };

      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
      rowIndex += 1;
    }
  }

  applyPageSetup(sheet, {
    orientation: "landscape",
    titleRows: `1:${headerRowIndex}`,
    footerText: `${title} · ${rangeText}`,
    fontFamily: labels.fontFamily,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const locale = labels.sheet === "汇总" ? "zh" : "en";
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    summaryFileName(
      matrix.from,
      matrix.to,
      locale,
      singleBuyer?.name || labels.buyerName,
    ),
  );
}
