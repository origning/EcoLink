import type { InvoiceRecord, PickupRecord, Store } from "../types";

export type PickupPaymentStatus = "unpaid" | "partial" | "paid";

export function pickupPaidAmount(record: PickupRecord) {
  return record.payments.reduce(
    (sum, payment) => (payment.voidedAt ? sum : sum + payment.amount),
    0,
  );
}

export function pickupOutstanding(record: PickupRecord) {
  return Math.max(0, record.amount - pickupPaidAmount(record));
}

export function pickupPaymentStatus(
  record: PickupRecord,
): PickupPaymentStatus {
  const paid = pickupPaidAmount(record);
  if (paid <= 0) return "unpaid";
  if (paid + 0.0001 >= record.amount) return "paid";
  return "partial";
}

export function invoicePaidAmount(invoice: InvoiceRecord) {
  return invoice.payments.reduce(
    (sum, payment) => (payment.voidedAt ? sum : sum + payment.amount),
    0,
  );
}

export function invoiceTotal(invoice: InvoiceRecord) {
  return invoice.snapshot.total;
}

export function invoiceOutstanding(invoice: InvoiceRecord) {
  return Math.max(0, invoiceTotal(invoice) - invoicePaidAmount(invoice));
}

export function invoicePaymentStatus(
  invoice: InvoiceRecord,
): PickupPaymentStatus {
  const paid = invoicePaidAmount(invoice);
  if (paid <= 0) return "unpaid";
  if (paid + 0.0001 >= invoiceTotal(invoice)) return "paid";
  return "partial";
}

export function invoiceIsOverdue(invoice: InvoiceRecord, today: string) {
  if (invoiceOutstanding(invoice) <= 0) return false;
  return Boolean(invoice.snapshot.dueAt && invoice.snapshot.dueAt < today);
}

export function storeForRecord(
  record: PickupRecord,
  stores: Store[],
): Store | undefined {
  const name = record.storeName.trim().toLowerCase();
  return stores.find((store) => store.name.trim().toLowerCase() === name);
}

function isoFromDate(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + Math.max(0, days));
  return isoFromDate(date);
}

/**
 * 到期日：
 * - 现结 / 自定义：拣货日 + dueDays
 * - 月结：settlementDay 为 31 时按拣货当月最后一天；否则按下个月的第 N 天
 * - 未设置店铺档案时不计算逾期
 */
export function pickupDueDate(
  record: PickupRecord,
  store: Store | undefined,
) {
  if (!store) return null;
  if (store.settlementType !== "monthly") {
    return addDays(record.date, store.dueDays);
  }

  const date = new Date(`${record.date}T00:00:00`);
  if (store.settlementDay >= 31) {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return addDays(isoFromDate(lastDay), store.dueDays);
  }

  const due = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    store.settlementDay,
  );
  return addDays(isoFromDate(due), store.dueDays);
}

export function pickupIsOverdue(
  record: PickupRecord,
  store: Store | undefined,
  today: string,
) {
  if (pickupOutstanding(record) <= 0) return false;
  const due = pickupDueDate(record, store);
  return Boolean(due && due < today);
}
