import type { AppDb, BackupFile } from "../types";
import * as httpDb from "../api/httpDb";
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
  return kind === "files" ? httpDb.fetchDb() : idbFetchDb();
}

export async function putDb(db: AppDb) {
  await initStorage();
  return kind === "files" ? httpDb.putDb(db) : idbPutDb(db);
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
