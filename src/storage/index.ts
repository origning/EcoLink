import type {
  AppDb,
  AppSettings,
  BackupFile,
  Buyer,
  Group,
  Ingredient,
  Order,
  OrderTemplate,
} from "../types";
import * as httpDb from "../api/httpDb";
import { normalizeDb } from "./normalizeDb";
import {
  idbDeleteImages,
  idbFetchBackup,
  idbFetchDb,
  idbHydrateImageUrls,
  idbImageUrl,
  idbPutBackup,
  idbPutDb,
  idbPutImages,
} from "./idb";

export type StorageKind = "files" | "device";

type CollectionKey = "groups" | "ingredients" | "buyers" | "orders" | "templates";

let kind: StorageKind | null = null;
let initPromise: Promise<StorageKind> | null = null;

async function probeFileApi() {
  try {
    const res = await fetch("/api/db", { cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && type.includes("json");
  } catch {
    return false;
  }
}

export function getStorageKind(): StorageKind {
  return kind ?? "device";
}

export function initStorage() {
  if (!initPromise) {
    initPromise = probeFileApi().then(async (hasApi) => {
      kind = hasApi ? "files" : "device";
      if (kind === "device") await idbHydrateImageUrls();
      return kind;
    });
  }
  return initPromise;
}

export async function fetchDb() {
  await initStorage();
  const db = kind === "files" ? await httpDb.fetchDb() : await idbFetchDb();
  return normalizeDb(db);
}

export async function putDb(db: AppDb) {
  await initStorage();
  return kind === "files" ? httpDb.putDb(db) : idbPutDb(db);
}

// ---- 按实体增删改 ----
// 文件模式：调用服务端按实体接口，服务端只改动这一条，避免整份覆盖。
// 设备模式：本来就是单设备本地数据，直接在 IndexedDB 上增删改。

function upsertList<T extends { id: string }>(list: T[], entity: T): T[] {
  const index = list.findIndex((item) => item.id === entity.id);
  if (index === -1) return [...list, entity];
  return list.map((item) => (item.id === entity.id ? entity : item));
}

async function mutateLocal(key: CollectionKey, entity: { id: string }) {
  const db = await idbFetchDb();
  (db as unknown as Record<string, unknown>)[key] = upsertList(
    db[key] as unknown as { id: string }[],
    entity,
  );
  return idbPutDb(db);
}

async function removeLocal(key: CollectionKey, id: string) {
  const db = await idbFetchDb();
  (db as unknown as Record<string, unknown>)[key] = (
    db[key] as unknown as { id: string }[]
  ).filter((item) => item.id !== id);
  return idbPutDb(db);
}

export async function saveSettings(patch: Partial<AppSettings>) {
  await initStorage();
  if (kind === "files") return httpDb.saveSettings(patch);
  const db = await idbFetchDb();
  db.settings = { ...db.settings, ...patch };
  return idbPutDb(db);
}

export async function saveGroup(group: Group) {
  await initStorage();
  return kind === "files" ? httpDb.saveGroup(group) : mutateLocal("groups", group);
}

export async function saveIngredient(ingredient: Ingredient) {
  await initStorage();
  return kind === "files"
    ? httpDb.saveIngredient(ingredient)
    : mutateLocal("ingredients", ingredient);
}

export async function saveBuyer(buyer: Buyer) {
  await initStorage();
  return kind === "files" ? httpDb.saveBuyer(buyer) : mutateLocal("buyers", buyer);
}

export async function saveOrder(order: Order) {
  await initStorage();
  return kind === "files" ? httpDb.saveOrder(order) : mutateLocal("orders", order);
}

export async function saveTemplate(template: OrderTemplate) {
  await initStorage();
  return kind === "files"
    ? httpDb.saveTemplate(template)
    : mutateLocal("templates", template);
}

export async function deleteRecord(key: CollectionKey, id: string) {
  await initStorage();
  return kind === "files" ? httpDb.deleteRecord(key, id) : removeLocal(key, id);
}

export function ingredientThumbUrl(id: string, rev = 0) {
  if (kind === "files") {
    return `/api/images/${encodeURIComponent(id)}/thumb?v=${rev}`;
  }
  return idbImageUrl(id, "thumb", rev);
}

export function ingredientPreviewUrl(id: string, rev = 0) {
  if (kind === "files") {
    return `/api/images/${encodeURIComponent(id)}?v=${rev}`;
  }
  return idbImageUrl(id, "preview", rev);
}

export async function putIngredientImages(
  id: string,
  images: { preview: string; thumb: string },
) {
  await initStorage();
  if (kind === "files") return httpDb.putIngredientImages(id, images);
  await idbPutImages(id, images);
  return { ok: true };
}

export async function deleteIngredientImages(id: string) {
  await initStorage();
  if (kind === "files") return httpDb.deleteIngredientImages(id);
  await idbDeleteImages(id);
  return { ok: true };
}

export async function fetchBackup() {
  await initStorage();
  return kind === "files" ? httpDb.fetchBackup() : idbFetchBackup();
}

export async function putBackup(payload: BackupFile) {
  await initStorage();
  return kind === "files" ? httpDb.putBackup(payload) : idbPutBackup(payload);
}
