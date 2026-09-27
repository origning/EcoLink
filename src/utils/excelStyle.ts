import ExcelJS from "exceljs";

/** ExcelJS paperSize 9 = A4 */
export const A4_PAPER_SIZE = 9;

export const BRAND_ARGB = "FF1B7A4E";
export const BRAND_SOFT_ARGB = "FFE8F5EE";

export function fontFor(
  fontFamily: string,
  size = 10,
  bold = false,
  color?: string,
): Partial<ExcelJS.Font> {
  return { name: fontFamily, size, bold, color: color ? { argb: color } : undefined };
}

/**
 * 统一设置 A4 打印：缩放到一页宽、每页重复表头、页脚显示页码。
 * 注意：A4 只影响打印/打印预览，xlsx 文件本身不变。
 */
export function applyPageSetup(
  sheet: ExcelJS.Worksheet,
  options: {
    orientation: "portrait" | "landscape";
    titleRows?: string;
    footerText?: string;
    fontFamily: string;
  },
) {
  sheet.pageSetup = {
    paperSize: A4_PAPER_SIZE,
    orientation: options.orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.6,
      bottom: 0.6,
      header: 0.2,
      footer: 0.3,
    },
    ...(options.titleRows ? { printTitlesRow: options.titleRows } : {}),
  };
  const font = options.fontFamily;
  const footer = options.footerText ?? "";
  sheet.headerFooter = {
    oddFooter: `&L&"${font}"&8${footer}&R&"${font}"&8&P / &N`,
  };
}

export function styleTitleRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  lastCol: number,
  text: string,
  fontFamily: string,
) {
  const row = sheet.getRow(rowIndex);
  row.getCell(1).value = text;
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  row.getCell(1).font = fontFor(fontFamily, 15, true, BRAND_ARGB);
  row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  row.height = 28;
}

export function styleMetaRow(
  sheet: ExcelJS.Worksheet,
  rowIndex: number,
  lastCol: number,
  text: string,
  fontFamily: string,
) {
  const row = sheet.getRow(rowIndex);
  row.getCell(1).value = text;
  sheet.mergeCells(rowIndex, 1, rowIndex, lastCol);
  row.getCell(1).font = fontFor(fontFamily, 9, false, "FF6B7280");
  row.getCell(1).alignment = { vertical: "middle", horizontal: "center" };
  row.height = 18;
}
