import type { AppDb, AppSettings, Group } from "../types";
import {
  normalizeBuyer,
  normalizeIngredient,
  normalizeInvoiceRecord,
  normalizePackRecord,
  normalizePickupRecord,
} from "../utils/format";
import {
  createDefaultDb,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  normalizeInvoice,
} from "./defaultDb";

/**
 * 兼容旧数据：
 * - 旧 db.json / 旧备份没有 templates、settings.fontFamily、settings.fontSize、食材 price。
 * - 旧数据里食材直接挂在一级分组上，这里会自动在每个一级分组下建一个「未分类」二级分组，
 *   把旧的食材移进去，保证食材都落在二级分组。
 * 读取时统一补默认值，避免 undefined 传到页面。多次执行结果一致（幂等）。
 */
export function normalizeDb(input: Partial<AppDb> | undefined): AppDb {
  const fallback = createDefaultDb();
  const rawSize = Number(input?.settings?.fontSize);
  const settings: AppSettings = {
    locale: input?.settings?.locale === "en" ? "en" : "zh",
    fontFamily: (input?.settings?.fontFamily ?? "").trim() || DEFAULT_FONT_FAMILY,
    fontSize:
      Number.isFinite(rawSize) && rawSize >= 6 && rawSize <= 30
        ? Math.round(rawSize)
        : DEFAULT_FONT_SIZE,
    invoice: normalizeInvoice(input?.settings?.invoice),
  };

  const groups: Group[] = (Array.isArray(input?.groups) ? input.groups : fallback.groups).map(
    (group) => ({ ...group, parentId: group.parentId || undefined }),
  );

  let ingredients = (
    Array.isArray(input?.ingredients) ? input.ingredients : []
  ).map(normalizeIngredient);

  // 迁移：仍直接挂在一级分组上的食材，移入自动创建的「未分类」二级分组。
  const topLevelIds = new Set(
    groups.filter((group) => !group.parentId).map((group) => group.id),
  );
  const moved = new Map<string, string>();
  for (const item of ingredients) {
    if (!item.groupId || !topLevelIds.has(item.groupId)) continue;
    const parentId = item.groupId;
    const defaultId = `${parentId}__uncategorized`;
    if (
      !groups.some((group) => group.id === defaultId && group.parentId === parentId)
    ) {
      groups.push({
        id: defaultId,
        name: "",
        i18nKey: "uncategorized",
        parentId,
        sort: 0,
      });
    }
    moved.set(item.id, defaultId);
  }
  if (moved.size > 0) {
    ingredients = ingredients.map((item) =>
      moved.has(item.id) ? { ...item, groupId: moved.get(item.id)! } : item,
    );
  }

  return {
    settings,
    groups,
    ingredients,
    buyers: (Array.isArray(input?.buyers) ? input.buyers : []).map(normalizeBuyer),
    orders: Array.isArray(input?.orders) ? input.orders : [],
    templates: Array.isArray(input?.templates) ? input.templates : [],
    pickupRecords: (Array.isArray(input?.pickupRecords) ? input.pickupRecords : []).map(
      normalizePickupRecord,
    ),
    packRecords: (Array.isArray(input?.packRecords) ? input.packRecords : []).map(
      normalizePackRecord,
    ),
    invoiceRecords: (
      Array.isArray(input?.invoiceRecords) ? input.invoiceRecords : []
    ).map(normalizeInvoiceRecord),
  };
}
