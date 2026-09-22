import type { AppDb, BackupFile } from "../types";
import { createDefaultDb } from "./defaultDb";

const DB_NAME = "ecolink";
const DB_VERSION = 1;
const BACKUP_FORMAT = "ecolink-backup";
const BACKUP_VERSION = 1;

const blobUrls = new Map<string, string>();

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("images")) {
        db.createObjectStore("images");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("idb-open-failed"));
  });
}

function withStore<T>(
  storeName: "kv" | "images",
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = run(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("idb-request-failed"));
      }),
  );
}

function decodeBase64(value: string) {
  const cleaned = value.includes(",") ? (value.split(",")[1] ?? "") : value;
  if (!cleaned) return new Uint8Array();
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function blobFromBase64(value: string) {
  return new Blob([decodeBase64(value)], { type: "image/jpeg" });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? (result.split(",")[1] ?? "") : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function rememberUrl(key: string, blob: Blob) {
  const previous = blobUrls.get(key);
  if (previous) URL.revokeObjectURL(previous);
  const url = URL.createObjectURL(blob);
  blobUrls.set(key, url);
  return url;
}

export function idbImageUrl(id: string, kind: "preview" | "thumb", rev = 0) {
  return (
    blobUrls.get(`${kind}:${id}:${rev}`) || blobUrls.get(`${kind}:${id}`) || ""
  );
}

export async function idbHydrateImageUrls() {
  const db = await openDb();
  const images = await new Promise<Record<string, { preview?: Blob; thumb?: Blob }>>(
    (resolve, reject) => {
      const tx = db.transaction("images", "readonly");
      const request = tx.objectStore("images").openCursor();
      const next: Record<string, { preview?: Blob; thumb?: Blob }> = {};
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(next);
          return;
        }
        next[String(cursor.key)] = cursor.value as {
          preview?: Blob;
          thumb?: Blob;
        };
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error("idb-cursor-failed"));
    },
  );
  const dbJson = await withStore<AppDb | undefined>("kv", "readonly", (store) =>
    store.get("db"),
  );
  const revById = new Map(
    (dbJson?.ingredients ?? []).map((item) => [item.id, item.imageRev ?? 0]),
  );
  for (const [id, files] of Object.entries(images)) {
    const rev = revById.get(id) ?? 0;
    if (files.thumb) {
      rememberUrl(`thumb:${id}`, files.thumb);
      rememberUrl(`thumb:${id}:${rev}`, files.thumb);
    }
    if (files.preview) {
      rememberUrl(`preview:${id}`, files.preview);
      rememberUrl(`preview:${id}:${rev}`, files.preview);
    }
  }
}

export async function idbFetchDb() {
  const stored = await withStore<AppDb | undefined>("kv", "readonly", (store) =>
    store.get("db"),
  );
  if (stored) return stored;
  const initial = createDefaultDb();
  await withStore("kv", "readwrite", (store) => store.put(initial, "db"));
  return initial;
}

export async function idbPutDb(db: AppDb) {
  await withStore("kv", "readwrite", (store) => store.put(db, "db"));
  return db;
}

export async function idbPutImages(
  id: string,
  images: { preview: string; thumb: string },
) {
  const preview = blobFromBase64(images.preview);
  const thumb = blobFromBase64(images.thumb);
  await withStore("images", "readwrite", (store) =>
    store.put({ preview, thumb }, id),
  );
  rememberUrl(`preview:${id}`, preview);
  rememberUrl(`thumb:${id}`, thumb);
}

export async function idbDeleteImages(id: string) {
  for (const kind of ["preview", "thumb"] as const) {
    for (const key of [...blobUrls.keys()]) {
      if (key.startsWith(`${kind}:${id}`)) {
        const url = blobUrls.get(key);
        if (url) URL.revokeObjectURL(url);
        blobUrls.delete(key);
      }
    }
  }
  await withStore("images", "readwrite", (store) => store.delete(id));
}

async function readAllImages() {
  const native = await openDb();
  return new Promise<Record<string, { preview?: Blob; thumb?: Blob }>>(
    (resolve, reject) => {
      const tx = native.transaction("images", "readonly");
      const request = tx.objectStore("images").openCursor();
      const next: Record<string, { preview?: Blob; thumb?: Blob }> = {};
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(next);
          return;
        }
        next[String(cursor.key)] = cursor.value as {
          preview?: Blob;
          thumb?: Blob;
        };
        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error ?? new Error("idb-images-failed"));
    },
  );
}

export async function idbFetchBackup(): Promise<BackupFile> {
  const db = await idbFetchDb();
  const stored = await readAllImages();
  const images: BackupFile["images"] = {};
  for (const [id, files] of Object.entries(stored)) {
    const preview = files.preview ? await blobToBase64(files.preview) : "";
    const thumb = files.thumb ? await blobToBase64(files.thumb) : "";
    if (preview || thumb) images[id] = { preview, thumb };
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    db,
    images,
  };
}

export async function idbPutBackup(payload: BackupFile) {
  await idbPutDb(payload.db);
  const native = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = native.transaction("images", "readwrite");
    const store = tx.objectStore("images");
    const clear = store.clear();
    clear.onerror = () => reject(clear.error ?? new Error("idb-clear-failed"));
    clear.onsuccess = () => {
      for (const [id, files] of Object.entries(payload.images ?? {})) {
        store.put(
          {
            preview: files.preview ? blobFromBase64(files.preview) : undefined,
            thumb: files.thumb ? blobFromBase64(files.thumb) : undefined,
          },
          id,
        );
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("idb-import-failed"));
  });
  await idbHydrateImageUrls();
  return payload.db;
}
