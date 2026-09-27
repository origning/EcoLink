import type { AppDb } from "../types";

export const DEFAULT_FONT_FAMILY = "微软雅黑";

export const FONT_OPTIONS = ["微软雅黑", "宋体", "黑体", "等线", "Arial"];

export function createDefaultDb(): AppDb {
  return {
    settings: { locale: "zh", fontFamily: DEFAULT_FONT_FAMILY },
    groups: [
      { id: "group-fresh", name: "", i18nKey: "fresh", sort: 0 },
      { id: "group-frozen", name: "", i18nKey: "frozen", sort: 1 },
      { id: "group-packaged", name: "", i18nKey: "packaged", sort: 2 },
    ],
    ingredients: [],
    buyers: [],
    orders: [],
    templates: [],
  };
}
