import type { AppDb } from "../types";

export function createDefaultDb(): AppDb {
  return {
    settings: { locale: "zh" },
    groups: [
      { id: "group-fresh", name: "", i18nKey: "fresh", sort: 0 },
      { id: "group-frozen", name: "", i18nKey: "frozen", sort: 1 },
      { id: "group-packaged", name: "", i18nKey: "packaged", sort: 2 },
    ],
    ingredients: [],
    buyers: [],
    orders: [],
  };
}
