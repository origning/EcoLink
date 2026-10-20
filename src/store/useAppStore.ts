import { create } from "zustand";
import {
  deleteIngredientImages,
  deletePackRecord as apiDeletePackRecord,
  deletePickupRecord as apiDeletePickupRecord,
  deleteRecord,
  fetchDb,
  getStorageKind,
  purgeData as apiPurgeData,
  putIngredientImages,
  saveBuyer,
  saveGroup,
  saveIngredient,
  saveInvoiceRecord as apiSaveInvoiceRecord,
  saveOrder,
  savePackRecord as apiSavePackRecord,
  savePickupRecord as apiSavePickupRecord,
  saveSettings,
  saveStore as apiSaveStore,
  saveTemplate,
} from "../api/db";
import i18n from "../i18n";
import {
  normalizeIngredient,
  normalizeInvoiceRecord,
  normalizePackRecord,
  normalizePickupRecord,
} from "../utils/format";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_INVOICE } from "../storage/defaultDb";
import type {
  AppDb,
  Buyer,
  Group,
  Ingredient,
  InvoiceRecord,
  InvoiceSettings,
  Locale,
  Order,
  OrderTemplate,
  OrderTemplateKind,
  PackRecord,
  PickupPayment,
  PickupRecord,
  PurgeResult,
  Store,
  SummaryMatrix,
} from "../types";
import type { StorageKind } from "../api/db";
import { useAuthStore } from "./useAuthStore";

type Notice = { type: "ok" | "error"; message: string } | null;

type BuyerInput = {
  name: string;
  code: string;
  address: string;
  phone: string;
  logistics: string;
  commonIngredientIds: string[];
};

type PhotoInput = {
  id: string;
  rev: number;
  preview?: string;
  thumb?: string;
};

type PickupInput = {
  id?: string;
  date: string;
  storeName: string;
  tax: number;
  amount: number;
  note: string;
  buyerId?: string;
  photos: PhotoInput[];
  invoicePhotos: PhotoInput[];
};

type PackInput = {
  id?: string;
  date: string;
  logistics: string;
  storeName: string;
  note: string;
  buyerId?: string;
  photos: PhotoInput[];
  invoicePhotos: PhotoInput[];
};

type AppState = AppDb & {
  loaded: boolean;
  saving: boolean;
  storageKind: StorageKind;
  notice: Notice;
  load: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
  addGroup: (name: string, parentId?: string) => Promise<void>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  saveIngredient: (input: {
    id?: string;
    code: string;
    name: string;
    nameEn: string;
    remark: string;
    unit: string;
    price: number;
    groupId: string;
    images?: { preview: string; thumb: string };
  }) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  addBuyer: (input: BuyerInput) => Promise<void>;
  updateBuyer: (id: string, input: BuyerInput) => Promise<void>;
  deleteBuyer: (id: string) => Promise<void>;
  saveStore: (input: {
    id?: string;
    name: string;
    settlementType: Store["settlementType"];
    settlementDay: number;
    dueDays: number;
    contact: string;
    phone: string;
    note: string;
  }) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;
  upsertOrder: (input: {
    date: string;
    buyerId: string;
    items: { ingredientId: string; quantity: number }[];
  }) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  saveTemplate: (input: {
    id?: string;
    buyerId: string;
    kind: OrderTemplateKind;
    name: string;
    items: { ingredientId: string; quantity: number }[];
  }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  savePickupRecord: (input: PickupInput) => Promise<void>;
  addPickupPayment: (
    recordId: string,
    input: {
      date: string;
      amount: number;
      method: string;
      note: string;
      proofPhotos?: PhotoInput[];
    },
  ) => Promise<void>;
  voidPickupPayment: (recordId: string, paymentId: string) => Promise<void>;
  deletePickupRecord: (id: string) => Promise<void>;
  savePackRecord: (input: PackInput) => Promise<void>;
  deletePackRecord: (id: string) => Promise<void>;
  saveInvoiceRecord: (record: InvoiceRecord) => Promise<InvoiceRecord>;
  purgeData: (input: {
    from: string;
    to: string;
    includeInvoices: boolean;
    confirm: string;
  }) => Promise<PurgeResult>;
  setFontFamily: (fontFamily: string) => Promise<void>;
  setFontSize: (fontSize: number) => Promise<void>;
  setInvoiceSettings: (invoice: InvoiceSettings) => Promise<void>;
  clearNotice: () => void;
  flash: (notice: Exclude<Notice, null>) => void;
};

const LOCALE_KEY = "ecolink:locale";

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LOCALE_KEY);
    return value === "zh" || value === "en" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // 隐私模式等情况下写不了 localStorage，不影响本次切换。
  }
}

function toState(db: AppDb) {
  return {
    settings: db.settings,
    groups: db.groups,
    ingredients: db.ingredients.map((item) => normalizeIngredient(item)),
    buyers: db.buyers,
    stores: db.stores ?? [],
    orders: db.orders,
    templates: db.templates,
    pickupRecords: (db.pickupRecords ?? []).map(normalizePickupRecord),
    packRecords: (db.packRecords ?? []).map(normalizePackRecord),
    invoiceRecords: (db.invoiceRecords ?? []).map(normalizeInvoiceRecord),
    storageKind: getStorageKind(),
  };
}

async function uploadPhotoInputs(photos: PhotoInput[]) {
  const refs: { id: string; rev: number }[] = [];
  for (const photo of photos) {
    if (photo.preview && photo.thumb) {
      await putIngredientImages(photo.id, {
        preview: photo.preview,
        thumb: photo.thumb,
      });
    }
    refs.push({
      id: photo.id,
      rev: photo.preview ? Math.max(1, photo.rev) : photo.rev,
    });
  }
  return refs;
}

export function buildSummary(
  db: Pick<AppDb, "groups" | "ingredients" | "buyers" | "orders">,
  from: string,
  to: string,
): SummaryMatrix {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const relevant = db.orders.filter((order) => order.date >= start && order.date <= end);
  const totals = new Map<string, number>();
  const buyerIds = new Set<string>();

  for (const order of relevant) {
    buyerIds.add(order.buyerId);
    for (const item of order.items) {
      if (item.quantity <= 0) continue;
      const key = `${item.ingredientId}::${order.buyerId}`;
      totals.set(key, (totals.get(key) ?? 0) + item.quantity);
    }
  }

  const usedIngredientIds = new Set(
    [...totals.keys()].map((key) => key.split("::")[0]),
  );

  const buyerMap = new Map(db.buyers.map((buyer) => [buyer.id, buyer]));
  const buyers = [...buyerIds]
    .map(
      (id) =>
        buyerMap.get(id) ?? {
          id,
          name: "",
          code: "",
          address: "",
          phone: "",
          logistics: "",
          commonIngredientIds: [],
          sort: 10_000,
        },
    )
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh"));

  const ingredientMap = new Map(
    db.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const missingIngredients = [...usedIngredientIds]
    .filter((id) => !ingredientMap.has(id))
    .map(
      (id) =>
        ({
          id,
          groupId: "__deleted",
          code: "",
          name: "",
          nameEn: "",
          remark: "",
          unit: "",
          price: 0,
          hasImage: false,
          imageRev: 0,
        }) satisfies Ingredient,
    );

  const allIngredients = [...db.ingredients, ...missingIngredients];

  const rowsFor = (groupId: string) =>
    allIngredients
      .filter(
        (ingredient) =>
          ingredient.groupId === groupId && usedIngredientIds.has(ingredient.id),
      )
      .map((ingredient) => {
        const quantities: Record<string, number> = {};
        let total = 0;
        for (const buyer of buyers) {
          const quantity = totals.get(`${ingredient.id}::${buyer.id}`) ?? 0;
          quantities[buyer.id] = quantity;
          total += quantity;
        }
        return { ingredient, quantities, total };
      })
      .filter((row) => row.total > 0)
      .sort(
        (a, b) =>
          a.ingredient.code.localeCompare(b.ingredient.code, "zh") ||
          a.ingredient.nameEn.localeCompare(b.ingredient.nameEn, "zh") ||
          a.ingredient.name.localeCompare(b.ingredient.name, "zh"),
      );

  const sortGroups = (list: Group[]) =>
    [...list].sort(
      (a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh"),
    );
  const sortedGroups = sortGroups(db.groups);
  const topLevel = sortedGroups.filter((group) => !group.parentId);
  const topIds = new Set(topLevel.map((group) => group.id));

  const sections: SummaryMatrix["sections"] = [];
  const groupsWithRows = new Set<string>();

  const pushSection = (group: Group, parent?: Group) => {
    const rows = rowsFor(group.id);
    if (rows.length === 0) return;
    groupsWithRows.add(group.id);
    sections.push({ group, parent, rows });
  };

  // 一级分组标题在前，紧跟它下面的二级分组。
  for (const top of topLevel) {
    pushSection(top);
    for (const group of sortedGroups) {
      if (group.parentId === top.id) pushSection(group, top);
    }
  }

  // 父级缺失的二级分组（数据异常时）当作一级分组处理。
  for (const group of sortedGroups) {
    if (groupsWithRows.has(group.id)) continue;
    if (group.parentId && topIds.has(group.parentId)) continue;
    pushSection(group);
  }

  if (missingIngredients.length > 0) {
    pushSection({ id: "__deleted", name: "", sort: 10_000 });
  }

  return { from: start, to: end, buyers, sections };
}

export const useAppStore = create<AppState>((set, get) => {
  async function mutate(run: () => Promise<AppDb>) {
    set({ saving: true });
    try {
      const db = await run();
      set({ ...toState(db), saving: false });
    } catch (error) {
      set({ saving: false });
      throw error;
    }
  }

  return {
    loaded: false,
    saving: false,
    storageKind: "files",
    notice: null,
    settings: {
      locale: "zh",
      fontFamily: DEFAULT_FONT_FAMILY,
      fontSize: DEFAULT_FONT_SIZE,
      invoice: { ...DEFAULT_INVOICE },
    },
    groups: [],
    ingredients: [],
    buyers: [],
    stores: [],
    orders: [],
    templates: [],
    pickupRecords: [],
    packRecords: [],
    invoiceRecords: [],

    flash: (notice) => {
      set({ notice });
      window.setTimeout(() => {
        if (get().notice === notice) set({ notice: null });
      }, 2400);
    },

    clearNotice: () => set({ notice: null }),

    load: async () => {
      const db = await fetchDb();
      // 语言是设备偏好：优先使用本机记住的语言，避免被旧后端设置覆盖。
      const locale = readStoredLocale() ?? db.settings.locale;
      await i18n.changeLanguage(locale);
      set({
        ...toState(db),
        settings: { ...db.settings, locale },
        loaded: true,
      });
    },

    setLocale: async (locale) => {
      await i18n.changeLanguage(locale);
      writeStoredLocale(locale);
      // 语言是界面偏好：先立即生效，不依赖后端返回的旧设置。
      set((state) => ({
        settings: { ...state.settings, locale },
      }));
      try {
        await saveSettings({ locale });
      } catch (error) {
        // 旧后端或离线时保存可能失败，但本次切换仍然有效。
        console.warn("Failed to save locale", error);
      }
    },

    addGroup: async (name, parentId) => {
      const groups = get().groups;
      const siblings = groups.filter(
        (item) => (item.parentId ?? "") === (parentId ?? ""),
      );
      const group: Group = {
        id: newId("group"),
        name: name.trim(),
        parentId,
        sort: siblings.length
          ? Math.max(...siblings.map((item) => item.sort)) + 1
          : 0,
      };
      await mutate(() => saveGroup(group));
    },

    updateGroup: async (id, name) => {
      const existing = get().groups.find((group) => group.id === id);
      if (!existing) return;
      await mutate(() =>
        saveGroup({ ...existing, name: name.trim(), i18nKey: undefined }),
      );
    },

    deleteGroup: async (id) => {
      const groups = get().groups;
      const childIds = groups
        .filter((group) => group.parentId === id)
        .map((group) => group.id);
      const ids = new Set([id, ...childIds]);
      if (get().ingredients.some((ingredient) => ids.has(ingredient.groupId))) {
        throw new Error("group-in-use");
      }
      for (const childId of childIds) {
        await mutate(() => deleteRecord("groups", childId));
      }
      await mutate(() => deleteRecord("groups", id));
    },

    saveIngredient: async ({
      id,
      code,
      name,
      nameEn,
      remark,
      unit,
      price,
      groupId,
      images,
    }) => {
      const ingredients = get().ingredients;
      const existing = id
        ? ingredients.find((item) => item.id === id)
        : undefined;
      const nextId = existing?.id ?? newId("ing");
      const nextCode = code.trim();

      if (
        nextCode &&
        ingredients.some(
          (item) =>
            item.id !== nextId &&
            item.code.trim().toLowerCase() === nextCode.toLowerCase(),
        )
      ) {
        throw new Error("code-taken");
      }

      if (images) {
        await putIngredientImages(nextId, images);
      }

      const nextIngredient: Ingredient = {
        id: nextId,
        groupId,
        code: nextCode,
        name: name.trim(),
        nameEn: nameEn.trim(),
        remark: remark.trim(),
        unit: unit.trim(),
        price: Number(price) > 0 ? Number(price) : 0,
        hasImage: Boolean(images) || Boolean(existing?.hasImage),
        imageRev: (existing?.imageRev ?? 0) + (images ? 1 : 0),
      };

      await mutate(() => saveIngredient(nextIngredient));
    },

    deleteIngredient: async (id) => {
      await mutate(() => deleteRecord("ingredients", id));
      try {
        await deleteIngredientImages(id);
      } catch {
        // Keep metadata deletion even if image files are already gone.
      }
    },

    addBuyer: async ({
      name,
      code,
      address,
      phone,
      logistics,
      commonIngredientIds,
    }) => {
      const buyers = get().buyers;
      const nextCode = code.trim();
      if (
        nextCode &&
        buyers.some(
          (buyer) => buyer.code.trim().toLowerCase() === nextCode.toLowerCase(),
        )
      ) {
        throw new Error("code-taken");
      }
      const buyer: Buyer = {
        id: newId("buyer"),
        name: name.trim(),
        code: nextCode,
        address: address.trim(),
        phone: phone.trim(),
        logistics: logistics.trim(),
        commonIngredientIds: [...commonIngredientIds],
        sort: buyers.length ? Math.max(...buyers.map((item) => item.sort)) + 1 : 0,
      };
      await mutate(() => saveBuyer(buyer));
    },

    updateBuyer: async (
      id,
      { name, code, address, phone, logistics, commonIngredientIds },
    ) => {
      const existing = get().buyers.find((buyer) => buyer.id === id);
      if (!existing) return;
      const nextCode = code.trim();
      if (
        nextCode &&
        get().buyers.some(
          (buyer) =>
            buyer.id !== id &&
            buyer.code.trim().toLowerCase() === nextCode.toLowerCase(),
        )
      ) {
        throw new Error("code-taken");
      }
      await mutate(() =>
        saveBuyer({
          ...existing,
          name: name.trim(),
          code: nextCode,
          address: address.trim(),
          phone: phone.trim(),
          logistics: logistics.trim(),
          commonIngredientIds: [...commonIngredientIds],
        }),
      );
    },

    deleteBuyer: async (id) => {
      await mutate(() => deleteRecord("buyers", id));
    },

    saveStore: async ({
      id,
      name,
      settlementType,
      settlementDay,
      dueDays,
      contact,
      phone,
      note,
    }) => {
      const stores = get().stores;
      const existing = id ? stores.find((item) => item.id === id) : undefined;
      const nextName = name.trim();
      if (
        stores.some(
          (item) =>
            item.id !== existing?.id &&
            item.name.trim().toLowerCase() === nextName.toLowerCase(),
        )
      ) {
        throw new Error("store-name-taken");
      }
      const next: Store = {
        id: existing?.id ?? newId("store"),
        name: nextName,
        settlementType,
        settlementDay,
        dueDays,
        contact: contact.trim(),
        phone: phone.trim(),
        note: note.trim(),
        sort: existing?.sort ?? (stores.length ? Math.max(...stores.map((item) => item.sort)) + 1 : 0),
      };
      await mutate(() => apiSaveStore(next));
    },

    deleteStore: async (id) => {
      await mutate(() => deleteRecord("stores", id));
    },

    upsertOrder: async ({ date, buyerId, items }) => {
      const cleaned = items.filter((item) => item.quantity > 0);
      const orders = get().orders;
      const existing = orders.find(
        (order) => order.date === date && order.buyerId === buyerId,
      );
      const next: Order = {
        id: existing?.id ?? newId("order"),
        date,
        buyerId,
        items: cleaned,
        updatedAt: Date.now(),
      };
      await mutate(() => saveOrder(next));
    },

    deleteOrder: async (id) => {
      await mutate(() => deleteRecord("orders", id));
    },

    saveTemplate: async ({ id, buyerId, kind, name, items }) => {
      const templates = get().templates;
      const existing = id ? templates.find((item) => item.id === id) : undefined;
      const cleaned = items
        .filter((item) => (kind === "fixed" ? item.quantity > 0 : true))
        .map((item) => ({
          ingredientId: item.ingredientId,
          quantity: kind === "fixed" ? item.quantity : 0,
        }));
      const next: OrderTemplate = {
        id: existing?.id ?? newId("template"),
        buyerId,
        kind,
        name: name.trim(),
        items: cleaned,
        updatedAt: Date.now(),
      };
      await mutate(() => saveTemplate(next));
    },

    deleteTemplate: async (id) => {
      await mutate(() => deleteRecord("templates", id));
    },

    savePickupRecord: async (input) => {
      const existing = get().pickupRecords.find((item) => item.id === input.id);
      const id = existing?.id ?? input.id ?? `pickup-${crypto.randomUUID()}`;
      const photos = await uploadPhotoInputs(input.photos);
      const invoicePhotos = await uploadPhotoInputs(input.invoicePhotos);
      const user = useAuthStore.getState().user;
      const now = Date.now();
      const amount = Number(input.amount) > 0 ? Number(input.amount) : 0;
      const paid = (existing?.payments ?? []).reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      if (paid > amount) throw new Error("amount-below-paid");
      const record: PickupRecord = {
        id,
        date: input.date,
        storeName: input.storeName.trim(),
        tax: Number(input.tax) > 0 ? Number(input.tax) : 0,
        amount,
        note: input.note.trim(),
        buyerId: input.buyerId || undefined,
        photos,
        invoicePhotos,
        payments: existing?.payments ?? [],
        createdBy: existing?.createdBy ?? user?.id ?? "local",
        createdByName: existing?.createdByName ?? user?.username ?? "local",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await mutate(() => apiSavePickupRecord(record));
      const oldIds = new Set(
        [...(existing?.photos ?? []), ...(existing?.invoicePhotos ?? [])].map(
          (photo) => photo.id,
        ),
      );
      const newIds = new Set(
        [...photos, ...invoicePhotos].map((photo) => photo.id),
      );
      for (const photoId of oldIds) {
        if (newIds.has(photoId)) continue;
        try {
          await deleteIngredientImages(photoId);
        } catch {
          // 记录已保存，照片删除失败时由清理功能兜底。
        }
      }
    },

    addPickupPayment: async (recordId, input) => {
      const existing = get().pickupRecords.find((item) => item.id === recordId);
      if (!existing) throw new Error("pickup-not-found");
      const paid = existing.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const outstanding = Math.max(0, existing.amount - paid);
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("invalid-payment-amount");
      }
      if (amount > outstanding + 0.0001) {
        throw new Error("payment-over-amount");
      }
      const user = useAuthStore.getState().user;
      const proofPhotos = await uploadPhotoInputs(input.proofPhotos ?? []);
      const payment: PickupPayment = {
        id: `payment-${crypto.randomUUID()}`,
        date: input.date,
        amount,
        method: input.method.trim(),
        note: input.note.trim(),
        proofPhotos,
        createdBy: user?.id ?? "local",
        createdByName: user?.username ?? "local",
        createdAt: Date.now(),
      };
      await mutate(() =>
        apiSavePickupRecord({
          ...existing,
          payments: [...existing.payments, payment],
          updatedAt: Date.now(),
        }),
      );
    },

    voidPickupPayment: async (recordId, paymentId) => {
      const existing = get().pickupRecords.find((item) => item.id === recordId);
      if (!existing) throw new Error("pickup-not-found");
      const user = useAuthStore.getState().user;
      const now = Date.now();
      await mutate(() =>
        apiSavePickupRecord({
          ...existing,
          payments: existing.payments.map((payment) =>
            payment.id === paymentId
              ? {
                  ...payment,
                  voidedAt: now,
                  voidedBy: user?.id ?? "local",
                  voidedByName: user?.username ?? "local",
                }
              : payment,
          ),
          updatedAt: now,
        }),
      );
    },

    deletePickupRecord: async (id) => {
      const existing = get().pickupRecords.find((item) => item.id === id);
      if (existing && existing.payments.length > 0) {
        throw new Error("pickup-has-payments");
      }
      await mutate(() => apiDeletePickupRecord(id));
    },

    savePackRecord: async (input) => {
      const existing = get().packRecords.find((item) => item.id === input.id);
      const id = existing?.id ?? input.id ?? `pack-${crypto.randomUUID()}`;
      const photos = await uploadPhotoInputs(input.photos);
      const invoicePhotos = await uploadPhotoInputs(input.invoicePhotos);
      const user = useAuthStore.getState().user;
      const now = Date.now();
      const record: PackRecord = {
        id,
        date: input.date,
        logistics: input.logistics.trim(),
        storeName: input.storeName.trim(),
        note: input.note.trim(),
        buyerId: input.buyerId || undefined,
        photos,
        invoicePhotos,
        createdBy: existing?.createdBy ?? user?.id ?? "local",
        createdByName: existing?.createdByName ?? user?.username ?? "local",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await mutate(() => apiSavePackRecord(record));
      const oldIds = new Set(
        [...(existing?.photos ?? []), ...(existing?.invoicePhotos ?? [])].map(
          (photo) => photo.id,
        ),
      );
      const newIds = new Set(
        [...photos, ...invoicePhotos].map((photo) => photo.id),
      );
      for (const photoId of oldIds) {
        if (newIds.has(photoId)) continue;
        try {
          await deleteIngredientImages(photoId);
        } catch {
          // 记录已保存，照片删除失败时由清理功能兜底。
        }
      }
    },

    deletePackRecord: async (id) => {
      await mutate(() => apiDeletePackRecord(id));
    },

    saveInvoiceRecord: async (record) => {
      set({ saving: true });
      try {
        const res = await apiSaveInvoiceRecord(record);
        set({ ...toState(res.db), saving: false });
        return res.record;
      } catch (error) {
        set({ saving: false });
        throw error;
      }
    },

    purgeData: async (input) => {
      const result = await apiPurgeData(input);
      const db = await fetchDb();
      set({ ...toState(db), loaded: true });
      return result;
    },

    setFontFamily: async (fontFamily) => {
      await mutate(() => saveSettings({ fontFamily }));
    },

    setFontSize: async (fontSize) => {
      await mutate(() => saveSettings({ fontSize }));
    },

    setInvoiceSettings: async (invoice) => {
      await mutate(() => saveSettings({ invoice }));
    },
  };
});
