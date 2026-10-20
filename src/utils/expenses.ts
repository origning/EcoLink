import type { PickupRecord, Store } from "../types";
import {
  pickupIsOverdue,
  pickupOutstanding,
  pickupPaidAmount,
  storeForRecord,
} from "./payments";

export type StoreExpenseSummary = {
  storeName: string;
  store?: Store;
  count: number;
  amount: number;
  tax: number;
  paid: number;
  unpaid: number;
  overdue: number;
};

export type MonthExpenseSummary = {
  month: string;
  amount: number;
  paid: number;
  unpaid: number;
  overdue: number;
};

export function buildExpenseSummary(
  records: PickupRecord[],
  stores: Store[],
  from: string,
  to: string,
  today: string,
) {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const filtered = records.filter(
    (record) => record.date >= start && record.date <= end,
  );

  const totals = {
    amount: 0,
    tax: 0,
    paid: 0,
    unpaid: 0,
    overdue: 0,
  };
  const storeMap = new Map<string, StoreExpenseSummary>();
  const monthMap = new Map<string, MonthExpenseSummary>();

  for (const record of filtered) {
    const store = storeForRecord(record, stores);
    const paid = pickupPaidAmount(record);
    const unpaid = pickupOutstanding(record);
    const overdue = pickupIsOverdue(record, store, today) ? unpaid : 0;

    totals.amount += record.amount;
    totals.tax += record.tax;
    totals.paid += paid;
    totals.unpaid += unpaid;
    totals.overdue += overdue;

    const key = record.storeName.trim() || "—";
    const storeEntry =
      storeMap.get(key) ??
      ({
        storeName: key,
        store,
        count: 0,
        amount: 0,
        tax: 0,
        paid: 0,
        unpaid: 0,
        overdue: 0,
      } satisfies StoreExpenseSummary);
    storeEntry.count += 1;
    storeEntry.amount += record.amount;
    storeEntry.tax += record.tax;
    storeEntry.paid += paid;
    storeEntry.unpaid += unpaid;
    storeEntry.overdue += overdue;
    storeMap.set(key, storeEntry);

    const month = record.date.slice(0, 7);
    const monthEntry =
      monthMap.get(month) ??
      ({
        month,
        amount: 0,
        paid: 0,
        unpaid: 0,
        overdue: 0,
      } satisfies MonthExpenseSummary);
    monthEntry.amount += record.amount;
    monthEntry.paid += paid;
    monthEntry.unpaid += unpaid;
    monthEntry.overdue += overdue;
    monthMap.set(month, monthEntry);
  }

  return {
    start,
    end,
    totals,
    records: filtered.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
    ),
    stores: [...storeMap.values()].sort(
      (a, b) => b.unpaid - a.unpaid || a.storeName.localeCompare(b.storeName),
    ),
    months: [...monthMap.values()].sort((a, b) =>
      b.month.localeCompare(a.month),
    ),
  };
}
