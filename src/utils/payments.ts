import type { PickupRecord } from "../types";

export type PickupPaymentStatus = "unpaid" | "partial" | "paid";

export function pickupPaidAmount(record: PickupRecord) {
  return record.payments.reduce((sum, payment) => sum + payment.amount, 0);
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
