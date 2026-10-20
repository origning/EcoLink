import type { TFunction } from "i18next";
import type {
  Buyer,
  Group,
  Ingredient,
  InvoiceRecord,
  InvoiceSnapshot,
  PackRecord,
  PhotoRef,
  PickupPayment,
  PickupRecord,
  Store,
} from "../types";

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

/** 导出时标注的本地时间，例如 2026-09-26 14:30 */
export function formatDateTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function groupLabel(group: Group | undefined, t: TFunction) {
  if (!group || group.id === "__deleted") return t("common.deletedItem");
  if (group.i18nKey) return t(`groups.${group.i18nKey}`);
  return group.name || t("common.unnamed");
}

export function displayName(name: string, fallback: string) {
  return name.trim() || fallback;
}

export function normalizeIngredient(
  item: Partial<Ingredient> & Pick<Ingredient, "id" | "groupId">,
): Ingredient {
  return {
    id: item.id,
    groupId: item.groupId,
    code: (item.code ?? "").trim(),
    name: (item.name ?? "").trim(),
    nameEn: (item.nameEn ?? "").trim(),
    remark: (item.remark ?? "").trim(),
    unit: (item.unit ?? "").trim(),
    price: Number(item.price) > 0 ? Number(item.price) : 0,
    hasImage: Boolean(item.hasImage),
    imageRev: item.imageRev ?? 0,
  };
}

export function normalizeStore(
  item: Partial<Store> & Pick<Store, "id">,
): Store {
  const settlementType =
    item.settlementType === "monthly" || item.settlementType === "custom"
      ? item.settlementType
      : "immediate";
  return {
    id: item.id,
    name: (item.name ?? "").trim(),
    settlementType,
    settlementDay:
      Number(item.settlementDay) >= 1 && Number(item.settlementDay) <= 31
        ? Math.round(Number(item.settlementDay))
        : 31,
    dueDays: Number(item.dueDays) > 0 ? Math.round(Number(item.dueDays)) : 0,
    contact: (item.contact ?? "").trim(),
    phone: (item.phone ?? "").trim(),
    note: (item.note ?? "").trim(),
    sort: Number(item.sort) || 0,
  };
}

export function normalizeBuyer(
  item: Partial<Buyer> & Pick<Buyer, "id">,
): Buyer {
  return {
    id: item.id,
    name: (item.name ?? "").trim(),
    code: (item.code ?? "").trim(),
    address: (item.address ?? "").trim(),
    phone: (item.phone ?? "").trim(),
    logistics: (item.logistics ?? "").trim(),
    commonIngredientIds: Array.isArray(item.commonIngredientIds)
      ? item.commonIngredientIds.filter((id): id is string => typeof id === "string")
      : [],
    sort: Number(item.sort) || 0,
  };
}

export function ingredientMatches(item: Ingredient, keyword: string) {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  return [item.code, item.name, item.nameEn, item.remark].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

/** 当前月份第一天，YYYY-MM-01 */
export function monthStartIso() {
  return `${todayIso().slice(0, 7)}-01`;
}

/** N 天前的本地日期，YYYY-MM-DD */
export function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return todayIsoFrom(date);
}

function todayIsoFrom(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const number = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type LegacyPhotoFields = {
  hasPhoto?: boolean;
  photoRev?: number;
  invoiceHasPhoto?: boolean;
  invoicePhotoRev?: number;
};

function normalizePhotoRefs(
  value: unknown,
  legacyId: string,
  legacyHasPhoto: unknown,
  legacyPhotoRev: unknown,
): PhotoRef[] {
  if (Array.isArray(value)) {
    const refs = value.flatMap((item) => {
      if (typeof item === "string") return [{ id: item, rev: 0 }];
      if (!item || typeof item !== "object") return [];
      const id = text((item as { id?: unknown }).id);
      if (!id) return [];
      return [{ id, rev: number((item as { rev?: unknown }).rev) }];
    });
    if (refs.length > 0) return refs;
  }
  if (legacyHasPhoto) return [{ id: legacyId, rev: number(legacyPhotoRev) }];
  return [];
}

export function normalizePickupPayments(value: unknown): PickupPayment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Partial<PickupPayment>;
    const amount = number(item.amount);
    if (amount <= 0) return [];
    return [
      {
        id: text(item.id) || `payment-${index}-${number(item.createdAt)}`,
        date: text(item.date),
        amount,
        method: text(item.method),
        note: text(item.note),
        proofPhotos: normalizePhotoRefs(
          item.proofPhotos,
          `${text(item.id) || `payment-${index}`}-proof`,
          false,
          0,
        ),
        createdBy: text(item.createdBy, "local"),
        createdByName: text(item.createdByName, "local"),
        createdAt: number(item.createdAt),
        voidedAt: item.voidedAt ? number(item.voidedAt) : undefined,
        voidedBy: text(item.voidedBy) || undefined,
        voidedByName: text(item.voidedByName) || undefined,
      },
    ];
  });
}

export function normalizePickupRecord(
  item: Partial<PickupRecord> &
    Pick<PickupRecord, "id"> &
    LegacyPhotoFields,
): PickupRecord {
  return {
    id: item.id,
    date: text(item.date),
    storeName: text(item.storeName),
    tax: number(item.tax),
    amount: number(item.amount),
    note: text(item.note),
    buyerId: text(item.buyerId) || undefined,
    photos: normalizePhotoRefs(
      item.photos,
      item.id,
      item.hasPhoto,
      item.photoRev,
    ),
    invoicePhotos: normalizePhotoRefs(
      item.invoicePhotos,
      `${item.id}-invoice`,
      item.invoiceHasPhoto,
      item.invoicePhotoRev,
    ),
    payments: normalizePickupPayments(item.payments),
    createdBy: text(item.createdBy, "local"),
    createdByName: text(item.createdByName, "local"),
    createdAt: number(item.createdAt),
    updatedAt: number(item.updatedAt),
  };
}

export function normalizePackRecord(
  item: Partial<PackRecord> &
    Pick<PackRecord, "id"> &
    LegacyPhotoFields,
): PackRecord {
  return {
    id: item.id,
    date: text(item.date),
    logistics: text(item.logistics),
    storeName: text(item.storeName),
    note: text(item.note),
    buyerId: text(item.buyerId) || undefined,
    photos: normalizePhotoRefs(
      item.photos,
      item.id,
      item.hasPhoto,
      item.photoRev,
    ),
    invoicePhotos: normalizePhotoRefs(
      item.invoicePhotos,
      `${item.id}-invoice`,
      item.invoiceHasPhoto,
      item.invoicePhotoRev,
    ),
    createdBy: text(item.createdBy, "local"),
    createdByName: text(item.createdByName, "local"),
    createdAt: number(item.createdAt),
    updatedAt: number(item.updatedAt),
  };
}

export function normalizeInvoiceRecord(
  item: Partial<InvoiceRecord> & Pick<InvoiceRecord, "id" | "invoiceNo">,
): InvoiceRecord {
  const snapshotInput = (item.snapshot ?? {}) as Partial<InvoiceSnapshot>;
  const billTo = snapshotInput.billTo ?? { name: "", address: "", phone: "" };
  const shipTo = snapshotInput.shipTo ?? { name: "", address: "", phone: "" };
  const lines = Array.isArray(snapshotInput.lines)
    ? snapshotInput.lines.map((line) => ({
        description: text(line.description),
        quantity: number(line.quantity),
        price: number(line.price),
        amount: number(line.amount),
      }))
    : [];
  return {
    id: item.id,
    invoiceNo: text(item.invoiceNo),
    invoiceNumber: number(item.invoiceNumber),
    buyerId: text(item.buyerId),
    buyerName: text(item.buyerName),
    from: text(item.from),
    to: text(item.to),
    snapshot: {
      companyName: text(snapshotInput.companyName),
      tagline: text(snapshotInput.tagline),
      phone: text(snapshotInput.phone),
      abn: text(snapshotInput.abn),
      email: text(snapshotInput.email),
      address: text(snapshotInput.address),
      bankName: text(snapshotInput.bankName),
      accountName: text(snapshotInput.accountName),
      bsb: text(snapshotInput.bsb),
      accountNumber: text(snapshotInput.accountNumber),
      paymentNote: text(snapshotInput.paymentNote),
      deliveryNote: text(snapshotInput.deliveryNote),
      currency: text(snapshotInput.currency, "$"),
      taxRate: number(snapshotInput.taxRate),
      dueDays: number(snapshotInput.dueDays),
      billTo: {
        name: text(billTo.name),
        address: text(billTo.address),
        phone: text(billTo.phone),
      },
      shipTo: {
        name: text(shipTo.name),
        address: text(shipTo.address),
        phone: text(shipTo.phone),
      },
      lines,
      subtotal: number(snapshotInput.subtotal),
      tax: number(snapshotInput.tax),
      total: number(snapshotInput.total),
      issuedAt: text(snapshotInput.issuedAt),
      dueAt: text(snapshotInput.dueAt),
    },
    createdBy: text(item.createdBy, "local"),
    createdByName: text(item.createdByName, "local"),
    createdAt: number(item.createdAt),
  };
}
