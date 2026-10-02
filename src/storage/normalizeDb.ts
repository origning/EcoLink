import type { AppDb, AppSettings } from "../types";
import { createDefaultDb, DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from "./defaultDb";

/**
 * 兼容旧数据：旧 db.json / 旧备份没有 templates、settings.fontFamily、settings.fontSize。
 * 读取时统一补默认值，避免 undefined 传到页面。
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
  };
  return {
    settings,
    groups: Array.isArray(input?.groups) ? input.groups : fallback.groups,
    ingredients: Array.isArray(input?.ingredients) ? input.ingredients : [],
    buyers: Array.isArray(input?.buyers) ? input.buyers : [],
    orders: Array.isArray(input?.orders) ? input.orders : [],
    templates: Array.isArray(input?.templates) ? input.templates : [],
  };
}
