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
  rangeLabel: string;
  exportedAtLabel: string;
  code: string;
  item: string;
  nameEn: string;
  total: string;
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
  options: { buyerId?: string } = {},
) {
  // 按需加载 exceljs：只有点「导出」时才下载这部分代码，首屏更快。
  const { default: ExcelJS } = await import("exceljs");
  const buyers = options.buyerId
    ? matrix.buyers.filter((buyer) => buyer.id === options.buyerId)
    : matrix.buyers;
  const singleBuyer = options.buyerId ? buyers[0] : undefined;
  const showTotal = !singleBuyer;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EcoLink Procurement";
  const sheet = workbook.addWorksheet(labels.sheet, {
    views: [{ state: "frozen", ySplit: 3, xSplit: 1 }],
  });

  const codeCol = 1;
  const nameCol = 2;
  const itemCol = 3;
  const firstBuyerCol = 4;
  const buyerCount = buyers.length;
  const totalCol = firstBuyerCol + buyerCount;
  const lastCol = showTotal ? totalCol : firstBuyerCol + buyerCount - 1;

  sheet.getColumn(codeCol).width = 12;
  sheet.getColumn(nameCol).width = 20;
  sheet.getColumn(itemCol).width = 20;
  for (let i = 0; i < buyerCount; i += 1) {
    sheet.getColumn(firstBuyerCol + i).width = 14;
  }
  if (showTotal) sheet.getColumn(totalCol).width = 10;

  // 第 1 行：标题；第 2 行：日期标注；第 3 行：表头
  styleTitleRow(sheet, 1, lastCol, labels.title, labels.fontFamily, labels.fontSize);
  const rangeText =
    matrix.from === matrix.to ? matrix.from : `${matrix.from} ~ ${matrix.to}`;
  const scopeText = singleBuyer?.name ? ` · ${singleBuyer.name}` : "";
  styleMetaRow(
    sheet,
    2,
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
  ];
  const header = sheet.getRow(3);
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

  let rowIndex = 4;
  for (const section of matrix.sections) {
    const groupRow = sheet.getRow(rowIndex);
    groupRow.getCell(1).value = labels.groupName(section.group);
    sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
    groupRow.getCell(1).font = fontFor(labels.fontFamily, labels.fontSize, true, BRAND_ARGB);
    groupRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_SOFT_ARGB },
    };
    groupRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    groupRow.height = 20;
    rowIndex += 1;

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
    titleRows: "3:3",
    footerText: `${labels.title} · ${rangeText}`,
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
