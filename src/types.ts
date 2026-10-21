export type Locale = "zh" | "en";

export type UserRole =
  | "admin"
  | "editor"
  | "uploader"
  | "picker"
  | "packer"
  | "summarizer";

/** 已登录用户（不含密码哈希） */
export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
};

export type GroupI18nKey = "fresh" | "frozen" | "packaged" | "uncategorized";

export type Group = {
  id: string;
  name: string;
  i18nKey?: GroupI18nKey;
  /** 二级分组所属的一级分组 id；一级分组没有这个字段 */
  parentId?: string;
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
  /** 单位（如 kg / ctn / pcs），选填，主要用在发票明细 */
  unit: string;
  /** 单价（元），用于导出汇总时计算金额 */
  price: number;
  hasImage: boolean;
  imageRev: number;
};

export type Buyer = {
  id: string;
  name: string;
  /** 客户代码（选填，填了要唯一）；订单页用它代替名字显示 */
  code: string;
  /** 地址（选填），用于单客户汇总表头 */
  address: string;
  /** 电话（选填），用于单客户汇总表头 */
  phone: string;
  /** 物流公司（选填），用于单客户汇总表头 */
  logistics: string;
  /** 常用产品库：该客户的常用食材 id 列表（只存清单，不存数量） */
  commonIngredientIds: string[];
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

/** 一张照片的图片 id 与缓存版本 */
export type PhotoRef = {
  id: string;
  rev: number;
};

/** 拣货记录的一笔付款 */
export type PickupPayment = {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  proofPhotos: PhotoRef[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  /** 作废时间；作废后仍保留记录用于审计，但不再计入已付金额 */
  voidedAt?: number;
  voidedBy?: string;
  voidedByName?: string;
};

export type StoreSettlementType = "immediate" | "monthly" | "custom";

/** 拣货店铺档案：用于月结账期和到期日 */
export type Store = {
  id: string;
  name: string;
  settlementType: StoreSettlementType;
  /** 月结日，1-31；31 表示当月最后一天，仅 monthly 使用 */
  settlementDay: number;
  /** 账期天数，用于计算到期日 */
  dueDays: number;
  contact: string;
  phone: string;
  note: string;
  sort: number;
};

/** 取货员记录：多张取货照片、发票照片、税、金额、取货店名 */
export type PickupRecord = {
  id: string;
  date: string;
  storeName: string;
  tax: number;
  amount: number;
  note: string;
  buyerId?: string;
  photos: PhotoRef[];
  invoicePhotos: PhotoRef[];
  /** 已登记的付款；为空或未定义表示未付款 */
  payments: PickupPayment[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
};

/** 一张发票的一笔收款 */
export type InvoicePayment = {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  proofPhotos: PhotoRef[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  /** 作废时间；作废后不计入已收金额 */
  voidedAt?: number;
  voidedBy?: string;
  voidedByName?: string;
};

/** 打包发货员记录：多张打包照片、发票照片、物流、发货店名 */
export type PackRecord = {
  id: string;
  date: string;
  logistics: string;
  trackingNo: string;
  storeName: string;
  note: string;
  buyerId?: string;
  /** 关联的发票 id，可关联多张 */
  invoiceIds: string[];
  photos: PhotoRef[];
  invoicePhotos: PhotoRef[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
};

export type InvoiceLineRecord = {
  description: string;
  quantity: number;
  price: number;
  amount: number;
};

/** 导出时的完整发票快照；汇总订单员可编辑，保存后不受后续设置变化影响 */
export type InvoiceSnapshot = {
  companyName: string;
  tagline: string;
  phone: string;
  abn: string;
  email: string;
  address: string;
  bankName: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
  paymentNote: string;
  deliveryNote: string;
  currency: string;
  /** 旧版税率，仅用于兼容旧数据；现在税额使用 tax 字段的具体金额 */
  taxRate: number;
  dueDays: number;
  billTo: { name: string; address: string; phone: string };
  shipTo: { name: string; address: string; phone: string };
  /** 这张发票包含的食材类别名称（替代具体产品明细） */
  ingredientCategories: string[];
  lines: InvoiceLineRecord[];
  subtotal: number;
  tax: number;
  total: number;
  issuedAt: string;
  dueAt: string;
};

export type InvoiceRecord = {
  id: string;
  invoiceNo: string;
  invoiceNumber: number;
  buyerId: string;
  buyerName: string;
  from: string;
  to: string;
  snapshot: InvoiceSnapshot;
  /** 已登记的客户收款 */
  payments: InvoicePayment[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
};

export type PurgePreview = {
  from: string;
  to: string;
  orders: number;
  pickups: number;
  packs: number;
  invoices: number;
  photos: number;
  bytes: number;
};

export type PurgeResult = PurgePreview & {
  photosDeleted: number;
  bytesFreed: number;
  backupFile?: string;
};

export type StorageStats = {
  dbBytes: number;
  imageCount: number;
  imageBytes: number;
  orders: number;
  pickups: number;
  packs: number;
  invoices: number;
};

export type InvoiceSettings = {
  companyName: string;
  tagline: string;
  phone: string;
  abn: string;
  email: string;
  address: string;
  bankName: string;
  accountName: string;
  bsb: string;
  accountNumber: string;
  paymentNote: string;
  deliveryNote: string;
  currency: string;
  /** 税率（%），默认 0 */
  taxAmount: number;
  /** 旧版税率，仅用于兼容旧备份 */
  taxRate?: number;
  /** 账期（天），默认 7 */
  dueDays: number;
  invoicePrefix: string;
  /** 下一个要用的发票号；每次导出后 +1 */
  nextInvoiceNumber: number;
};

export type AppSettings = {
  locale: Locale;
  /** 导出 Excel 使用的字体名 */
  fontFamily: string;
  /** 导出 Excel 使用的字号 */
  fontSize: number;
  /** 发票抬头 / 银行 / 编号等设置 */
  invoice: InvoiceSettings;
};

export type AppDb = {
  settings: AppSettings;
  groups: Group[];
  ingredients: Ingredient[];
  buyers: Buyer[];
  /** 拣货店铺档案 */
  stores: Store[];
  orders: Order[];
  /** 客户常用 / 固定订单模板 */
  templates: OrderTemplate[];
  /** 取货员上传的照片与金额记录 */
  pickupRecords: PickupRecord[];
  /** 打包发货员上传的照片与物流记录 */
  packRecords: PackRecord[];
  /** 已导出的发票快照 */
  invoiceRecords: InvoiceRecord[];
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
    /** 叶子分组：二级分组，或直接挂食材的一级分组 */
    group: Group;
    /** 若 group 是二级分组，这里是它所属的一级分组 */
    parent?: Group;
    rows: {
      ingredient: Ingredient;
      quantities: Record<string, number>;
      total: number;
    }[];
  }[];
};
