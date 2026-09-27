export type Locale = "zh" | "en";

export type GroupI18nKey = "fresh" | "frozen" | "packaged";

export type Group = {
  id: string;
  name: string;
  i18nKey?: GroupI18nKey;
  sort: number;
};

export type Ingredient = {
  id: string;
  groupId: string;
  code: string;
  /** 中文名称，和 nameEn（名字）是两个独立的属性 */
  name: string;
  /** 名字（非中文名/英文名），和 name（中文）是两个独立的属性 */
  nameEn: string;
  remark: string;
  hasImage: boolean;
  imageRev: number;
};

export type Buyer = {
  id: string;
  name: string;
  sort: number;
};

export type OrderItem = {
  ingredientId: string;
  quantity: number;
};

export type Order = {
  id: string;
  date: string;
  buyerId: string;
  items: OrderItem[];
  updatedAt: number;
};

/** 固定订单保存数量，常用订单只保存常点的食材清单（数量为 0） */
export type OrderTemplateKind = "common" | "fixed";

export type OrderTemplate = {
  id: string;
  buyerId: string;
  kind: OrderTemplateKind;
  name: string;
  items: OrderItem[];
  updatedAt: number;
};

export type AppSettings = {
  locale: Locale;
  /** 导出 Excel 使用的字体名 */
  fontFamily: string;
};

export type AppDb = {
  settings: AppSettings;
  groups: Group[];
  ingredients: Ingredient[];
  buyers: Buyer[];
  orders: Order[];
  /** 客户常用 / 固定订单模板 */
  templates: OrderTemplate[];
};

export type BackupImages = Record<string, { preview: string; thumb: string }>;

export type BackupFile = {
  format: "ecolink-backup";
  version: 1;
  exportedAt: string;
  db: AppDb;
  images: BackupImages;
};

export type SummaryCell = {
  ingredientId: string;
  buyerId: string;
  quantity: number;
};

export type SummaryMatrix = {
  from: string;
  to: string;
  buyers: Buyer[];
  sections: {
    group: Group;
    rows: {
      ingredient: Ingredient;
      quantities: Record<string, number>;
      total: number;
    }[];
  }[];
};
