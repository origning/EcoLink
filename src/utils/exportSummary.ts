import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ingredientThumbUrl } from "../api/db";
import type { Group, SummaryMatrix } from "../types";

type Labels = {
  sheet: string;
  image: string;
  code: string;
  item: string;
  nameEn: string;
  remark: string;
  total: string;
  groupName: (group: Group) => string;
  deleted: string;
};

async function fetchThumb(id: string, rev: number) {
  const url = ingredientThumbUrl(id, rev);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

export function summaryFileName(from: string, to: string, locale: "zh" | "en") {
  const prefix = locale === "zh" ? "采购汇总" : "procurement-summary";
  return from === to ? `${prefix}-${from}.xlsx` : `${prefix}-${from}_${to}.xlsx`;
}

export async function exportSummary(matrix: SummaryMatrix, labels: Labels) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EcoLink Procurement";
  const sheet = workbook.addWorksheet(labels.sheet, {
    views: [{ state: "frozen", ySplit: 1, xSplit: 5 }],
  });

  const buyerCount = matrix.buyers.length;
  const lastCol = 6 + buyerCount;

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 22;
  for (let i = 0; i < buyerCount; i += 1) {
    sheet.getColumn(6 + i).width = 14;
  }
  sheet.getColumn(lastCol).width = 10;

  const header = sheet.getRow(1);
  header.values = [
    labels.image,
    labels.code,
    labels.nameEn,
    labels.item,
    labels.remark,
    ...matrix.buyers.map((buyer) => buyer.name || labels.deleted),
    labels.total,
  ];
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B7A4E" },
  };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;

  let rowIndex = 2;
  for (const section of matrix.sections) {
    const groupRow = sheet.getRow(rowIndex);
    groupRow.values = [labels.groupName(section.group)];
    sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
    groupRow.font = { bold: true, color: { argb: "FF1B7A4E" } };
    groupRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F5EE" },
    };
    groupRow.alignment = { vertical: "middle" };
    groupRow.height = 20;
    rowIndex += 1;

    for (const row of section.rows) {
      const excelRow = sheet.getRow(rowIndex);
      excelRow.height = 32;
      excelRow.getCell(2).value = row.ingredient.code || "";
      excelRow.getCell(2).alignment = { vertical: "middle" };
      excelRow.getCell(3).value = row.ingredient.nameEn || labels.deleted;
      excelRow.getCell(3).alignment = { vertical: "middle" };
      excelRow.getCell(4).value = row.ingredient.name || "";
      excelRow.getCell(4).alignment = { vertical: "middle" };
      excelRow.getCell(5).value = row.ingredient.remark || "";
      excelRow.getCell(5).alignment = { vertical: "middle", wrapText: true };
      matrix.buyers.forEach((buyer, index) => {
        const quantity = row.quantities[buyer.id] ?? 0;
        const cell = excelRow.getCell(6 + index);
        cell.value = quantity > 0 ? quantity : "";
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      excelRow.getCell(lastCol).value = row.total;
      excelRow.getCell(lastCol).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      excelRow.getCell(lastCol).font = { bold: true };

      const thumb = row.ingredient.hasImage
        ? await fetchThumb(row.ingredient.id, row.ingredient.imageRev)
        : null;
      if (thumb) {
        const imageId = workbook.addImage({
          buffer: thumb as unknown as ExcelJS.Buffer,
          extension: "jpeg",
        });
        sheet.addImage(imageId, {
          tl: { col: 0.15, row: rowIndex - 1 + 0.15 },
          ext: { width: 36, height: 36 },
        });
      }
      rowIndex += 1;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    summaryFileName(matrix.from, matrix.to, labels.sheet === "汇总" ? "zh" : "en"),
  );
}
