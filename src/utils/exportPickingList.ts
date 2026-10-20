import { saveAs } from "file-saver";
import type { Workbook } from "exceljs";
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

export type PickingListLabels = {
  sheet: string;
  title: string;
  titleForBuyer: (name: string) => string;
  rangeLabel: string;
  exportedAtLabel: string;
  item: string;
  code: string;
  nameEn: string;
  quantity: string;
  remark: string;
  groupName: (group: Group) => string;
  fontFamily: string;
  fontSize: number;
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
 * 拣货单：按分组逐行。一级分组一行标题，二级分组再一行标题，下面是该组每样食材一行。
 * 列顺序按需求：中文、CODE、名字、数量、备注。数量为所选范围内客户的合计。
 */
export function addPickingListSheet(
  workbook: Workbook,
  matrix: SummaryMatrix,
  labels: PickingListLabels,
  options: { buyerIds?: string[] } = {},
) {
  const isSelection = Boolean(options.buyerIds && options.buyerIds.length > 0);
  const selectedIds = new Set(options.buyerIds ?? []);
  const selectedBuyers = isSelection
    ? matrix.buyers.filter((buyer) => selectedIds.has(buyer.id))
    : matrix.buyers;
  const singleBuyer =
    isSelection && selectedBuyers.length === 1 ? selectedBuyers[0] : undefined;

  workbook.creator = "EcoLink Procurement";
  const sheet = workbook.addWorksheet(labels.sheet, {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  const lastCol = 5;
  sheet.getColumn(1).width = 13;
  sheet.getColumn(2).width = 9;
  sheet.getColumn(3).width = 38;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 12;

  const title =
    singleBuyer?.name && labels.titleForBuyer
      ? labels.titleForBuyer(singleBuyer.name)
      : labels.title;

  styleTitleRow(sheet, 1, lastCol, title, labels.fontFamily, labels.fontSize);
  const rangeText =
    matrix.from === matrix.to ? matrix.from : `${matrix.from} ~ ${matrix.to}`;
  const scopeText = singleBuyer ? ` · ${singleBuyer.name}` : "";
  styleMetaRow(
    sheet,
    2,
    lastCol,
    `${labels.rangeLabel}: ${rangeText}${scopeText}    ${labels.exportedAtLabel}: ${formatDateTime()}`,
    labels.fontFamily,
    labels.fontSize,
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
    groupRow.height = isTop ? 22 : 18;
    return rowIndex + 1;
  };

  let rowIndex = 4;
  let currentTopId: string | null = null;
  for (const section of matrix.sections) {
    const rows = section.rows
      .map((row) => ({
        row,
        quantity: isSelection
          ? selectedBuyers.reduce(
              (sum, buyer) => sum + (row.quantities[buyer.id] ?? 0),
              0,
            )
          : row.total,
      }))
      .filter((entry) => entry.quantity > 0);
    if (rows.length === 0) continue;

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

    for (const { row, quantity } of rows) {
      const excelRow = sheet.getRow(rowIndex);
      excelRow.getCell(1).value = row.ingredient.name || "";
      excelRow.getCell(2).value = row.ingredient.code || "";
      excelRow.getCell(3).value = row.ingredient.nameEn || "";
      excelRow.getCell(4).value = quantity;
      excelRow.getCell(5).value = row.ingredient.remark || "";
      excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = fontFor(labels.fontFamily, labels.fontSize);
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 3 ? "left" : "center",
          wrapText: colNumber === 1 || colNumber === 3 || colNumber === 5,
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
    footerText: `${title} · ${rangeText}`,
    fontFamily: labels.fontFamily,
  });

}

export async function buildPickingListBuffer(
  matrix: SummaryMatrix,
  labels: PickingListLabels,
  options: { buyerIds?: string[] } = {},
) {
  // 按需加载 exceljs：只有点「导出」时才下载这部分代码，首屏更快。
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  addPickingListSheet(workbook, matrix, labels, options);
  return workbook.xlsx.writeBuffer();
}

export async function exportPickingList(
  matrix: SummaryMatrix,
  labels: PickingListLabels,
  options: { buyerIds?: string[] } = {},
) {
  const buffer = await buildPickingListBuffer(matrix, labels, options);
  const locale = labels.sheet === "拣货单" ? "zh" : "en";
  const isSelection = Boolean(options.buyerIds && options.buyerIds.length > 0);
  const selectedIds = new Set(options.buyerIds ?? []);
  const selectedBuyers = isSelection
    ? matrix.buyers.filter((buyer) => selectedIds.has(buyer.id))
    : matrix.buyers;
  const singleBuyer =
    isSelection && selectedBuyers.length === 1 ? selectedBuyers[0] : undefined;
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
