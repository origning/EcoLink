import { create } from "zustand";
import {
  deleteIngredientImages,
  deleteRecord,
  fetchDb,
  getStorageKind,
  putIngredientImages,
  saveBuyer,
  saveGroup,
  saveIngredient,
  saveOrder,
  saveSettings,
  saveTemplate,
} from "../api/db";
import i18n from "../i18n";
import { normalizeIngredient } from "../utils/format";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "../storage/defaultDb";
import type {
  AppDb,
  Buyer,
  Group,
  Ingredient,
  Locale,
  Order,
  OrderTemplate,
  OrderTemplateKind,
  SummaryMatrix,
} from "../types";
import type { StorageKind } from "../api/db";

type Notice = { type: "ok" | "error"; message: string } | null;

type AppState = AppDb & {
  loaded: boolean;
  saving: boolean;
  storageKind: StorageKind;
  notice: Notice;
  load: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  updateGroup: (id: string, name: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  saveIngredient: (input: {
    id?: string;
    code: string;
    name: string;
    nameEn: string;
    remark: string;
    groupId: string;
    images?: { preview: string; thumb: string };
  }) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  addBuyer: (name: string) => Promise<void>;
  updateBuyer: (id: string, name: string) => Promise<void>;
  deleteBuyer: (id: string) => Promise<void>;
  upsertOrder: (input: {
    date: string;
    buyerId: string;
    items: { ingredientId: string; quantity: number }[];
  }) => Promise<void>;
  saveTemplate: (input: {
    id?: string;
    buyerId: string;
    kind: OrderTemplateKind;
    name: string;
    items: { ingredientId: string; quantity: number }[];
  }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setFontFamily: (fontFamily: string) => Promise<void>;
  setFontSize: (fontSize: number) => Promise<void>;
  clearNotice: () => void;
  flash: (notice: Exclude<Notice, null>) => void;
};

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toState(db: AppDb) {
  return {
    settings: db.settings,
    groups: db.groups,
    ingredients: db.ingredients.map((item) => normalizeIngredient(item)),
    buyers: db.buyers,
    orders: db.orders,
    templates: db.templates,
    storageKind: getStorageKind(),
  };
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
          hasImage: false,
          imageRev: 0,
        }) satisfies Ingredient,
    );

  const groups = [
    ...db.groups.slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "zh")),
    ...(missingIngredients.length
      ? [{ id: "__deleted", name: "", sort: 10_000 } satisfies Group]
      : []),
  ];

  const allIngredients = [...db.ingredients, ...missingIngredients];

  const sections = groups
    .map((group) => {
      const rows = allIngredients
        .filter(
          (ingredient) =>
            ingredient.groupId === group.id && usedIngredientIds.has(ingredient.id),
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
      return { group, rows };
    })
    .filter((section) => section.rows.length > 0);

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
    settings: { locale: "zh", fontFamily: DEFAULT_FONT_FAMILY, fontSize: DEFAULT_FONT_SIZE },
    groups: [],
    ingredients: [],
    buyers: [],
    orders: [],
    templates: [],

    flash: (notice) => {
      set({ notice });
      window.setTimeout(() => {
        if (get().notice === notice) set({ notice: null });
      }, 2400);
    },

    clearNotice: () => set({ notice: null }),

    load: async () => {
      const db = await fetchDb();
      await i18n.changeLanguage(db.settings.locale);
      set({ ...toState(db), loaded: true });
    },

    setLocale: async (locale) => {
      await i18n.changeLanguage(locale);
      await mutate(() => saveSettings({ locale }));
    },

    addGroup: async (name) => {
      const groups = get().groups;
      const group: Group = {
        id: newId("group"),
        name: name.trim(),
        sort: groups.length ? Math.max(...groups.map((item) => item.sort)) + 1 : 0,
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
      if (get().ingredients.some((ingredient) => ingredient.groupId === id)) {
        throw new Error("group-in-use");
      }
      await mutate(() => deleteRecord("groups", id));
    },

    saveIngredient: async ({ id, code, name, nameEn, remark, groupId, images }) => {
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

    addBuyer: async (name) => {
      const buyers = get().buyers;
      const buyer: Buyer = {
        id: newId("buyer"),
        name: name.trim(),
        sort: buyers.length ? Math.max(...buyers.map((item) => item.sort)) + 1 : 0,
      };
      await mutate(() => saveBuyer(buyer));
    },

    updateBuyer: async (id, name) => {
      const existing = get().buyers.find((buyer) => buyer.id === id);
      if (!existing) return;
      await mutate(() => saveBuyer({ ...existing, name: name.trim() }));
    },

    deleteBuyer: async (id) => {
      await mutate(() => deleteRecord("buyers", id));
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

    setFontFamily: async (fontFamily) => {
      await mutate(() => saveSettings({ fontFamily }));
    },

    setFontSize: async (fontSize) => {
      await mutate(() => saveSettings({ fontSize }));
    },
  };
});
