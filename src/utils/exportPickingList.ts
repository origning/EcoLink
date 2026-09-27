import ExcelJS from "exceljs";
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
  item: string;
  code: string;
  nameEn: string;
  quantity: string;
  remark: string;
  groupName: (group: Group) => string;
  fontFamily: string;
  buyerName?: string;
};

export function pickingFileName(
  from: string,
  to: string,
  locale: "zh" | "en",
  buyerName?: string,
) {
  const prefix = locale === "zh" ? "拣货单" : "picking-list";
  const who = buyerName ? `-${buyerName.replace(/[\\/:*?"<>|]/g, "_")}` : "";
  return from === to
    ? `${prefix}${who}-${from}.xlsx`
    : `${prefix}${who}-${from}_${to}.xlsx`;
}

/**
 * 拣货单：按分组逐行。一行分组标题，下面是该组每样食材一行。
 * 列顺序按需求：中文、CODE、名字、数量、备注。数量为所选范围内客户的合计。
 */
export async function exportPickingList(
  matrix: SummaryMatrix,
  labels: Labels,
  options: { buyerId?: string } = {},
) {
  const singleBuyer = options.buyerId
    ? matrix.buyers.find((buyer) => buyer.id === options.buyerId)
    : undefined;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EcoLink Procurement";
  const sheet = workbook.addWorksheet(labels.sheet, {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const lastCol = 5;
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 24;

  styleTitleRow(sheet, 1, lastCol, labels.title, labels.fontFamily);
  const rangeText =
    matrix.from === matrix.to ? matrix.from : `${matrix.from} ~ ${matrix.to}`;
  const scopeText = singleBuyer ? ` · ${singleBuyer.name}` : "";
  styleMetaRow(
    sheet,
    2,
    lastCol,
    `${labels.rangeLabel}: ${rangeText}${scopeText}    ${labels.exportedAtLabel}: ${formatDateTime()}`,
    labels.fontFamily,
  );

  const header = sheet.getRow(3);
  header.values = [
    labels.item,
    labels.code,
    labels.nameEn,
    labels.quantity,
    labels.remark,
  ];
  header.eachCell((cell) => {
    cell.font = fontFor(labels.fontFamily, 10, true, "FFFFFFFF");
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
    const rows = section.rows
      .map((row) => ({
        row,
        quantity: singleBuyer
          ? row.quantities[singleBuyer.id] ?? 0
          : row.total,
      }))
      .filter((entry) => entry.quantity > 0);
    if (rows.length === 0) continue;

    const groupRow = sheet.getRow(rowIndex);
    groupRow.getCell(1).value = labels.groupName(section.group);
    sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
    groupRow.getCell(1).font = fontFor(labels.fontFamily, 11, true, BRAND_ARGB);
    groupRow.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_SOFT_ARGB },
    };
    groupRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    groupRow.height = 22;
    rowIndex += 1;

    for (const { row, quantity } of rows) {
      const excelRow = sheet.getRow(rowIndex);
      excelRow.height = 22;
      excelRow.getCell(1).value = row.ingredient.name || "";
      excelRow.getCell(2).value = row.ingredient.code || "";
      excelRow.getCell(3).value = row.ingredient.nameEn || "";
      excelRow.getCell(4).value = quantity;
      excelRow.getCell(5).value = row.ingredient.remark || "";
      excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = fontFor(labels.fontFamily, 10);
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 3 ? "left" : "center",
          wrapText: colNumber === 5,
        };
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
    orientation: "portrait",
    titleRows: "3:3",
    footerText: `${labels.title} · ${rangeText}`,
    fontFamily: labels.fontFamily,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const locale = labels.sheet === "拣货单" ? "zh" : "en";
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    pickingFileName(
      matrix.from,
      matrix.to,
      locale,
      singleBuyer?.name || labels.buyerName,
    ),
  );
}
