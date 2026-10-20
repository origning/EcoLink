import type { AppDb, InvoiceSettings } from "../types";

export const DEFAULT_FONT_FAMILY = "微软雅黑";
export const DEFAULT_FONT_SIZE = 10;

export const FONT_OPTIONS = ["微软雅黑", "宋体", "黑体", "等线", "Arial"];

export const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14];

/** 发票默认信息（可在「数据」页修改） */
export const DEFAULT_INVOICE: InvoiceSettings = {
  companyName: "Ecolink Provisions",
  tagline: "Value Link to What You Need",
  phone: "0403160388",
  abn: "14787711324",
  email: "EcolinkPerth@gmail.com",
  address: "3 Vincent St Bayswater WA 6053",
  bankName: "NAB (National Australia bank)",
  accountName: "ECOLINK PROVISIONS",
  bsb: "086-164",
  accountNumber: "25-733-8146",
  paymentNote:
    "Preferred payment via bank transfer.\nPlease reference Invoice Number when paying.",
  deliveryNote:
    "Please inspect all goods upon delivery.\nAny claims for damaged or incorrect items must be made within 3 days of delivery.",
  currency: "$",
  taxRate: 0,
  dueDays: 7,
  invoicePrefix: "INV-",
  nextInvoiceNumber: 3262,
};

const text = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

const num = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeInvoice(
  input: Partial<InvoiceSettings> | undefined,
): InvoiceSettings {
  return {
    companyName: text(input?.companyName, DEFAULT_INVOICE.companyName),
    tagline: text(input?.tagline, DEFAULT_INVOICE.tagline),
    phone: text(input?.phone, DEFAULT_INVOICE.phone),
    abn: text(input?.abn, DEFAULT_INVOICE.abn),
    email: text(input?.email, DEFAULT_INVOICE.email),
    address: text(input?.address, DEFAULT_INVOICE.address),
    bankName: text(input?.bankName, DEFAULT_INVOICE.bankName),
    accountName: text(input?.accountName, DEFAULT_INVOICE.accountName),
    bsb: text(input?.bsb, DEFAULT_INVOICE.bsb),
    accountNumber: text(input?.accountNumber, DEFAULT_INVOICE.accountNumber),
    paymentNote: text(input?.paymentNote, DEFAULT_INVOICE.paymentNote),
    deliveryNote: text(input?.deliveryNote, DEFAULT_INVOICE.deliveryNote),
    currency: text(input?.currency, DEFAULT_INVOICE.currency),
    taxRate: Math.min(100, Math.max(0, num(input?.taxRate, DEFAULT_INVOICE.taxRate))),
    dueDays: Math.max(0, Math.round(num(input?.dueDays, DEFAULT_INVOICE.dueDays))),
    invoicePrefix: text(input?.invoicePrefix, DEFAULT_INVOICE.invoicePrefix),
    nextInvoiceNumber: Math.max(
      1,
      Math.round(num(input?.nextInvoiceNumber, DEFAULT_INVOICE.nextInvoiceNumber)),
    ),
  };
}

export function createDefaultDb(): AppDb {
  return {
    settings: {
      locale: "zh",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_FONT_SIZE,
      invoice: { ...DEFAULT_INVOICE },
    },
    groups: [
      { id: "group-fresh", name: "", i18nKey: "fresh", sort: 0 },
      { id: "group-frozen", name: "", i18nKey: "frozen", sort: 1 },
      { id: "group-packaged", name: "", i18nKey: "packaged", sort: 2 },
    ],
    ingredients: [],
    buyers: [],
    orders: [],
    templates: [],
    pickupRecords: [],
    packRecords: [],
    invoiceRecords: [],
  };
}
