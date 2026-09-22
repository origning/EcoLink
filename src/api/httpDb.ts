import type { AppDb, BackupFile } from "../types";

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    const error = (parsed as { error?: string } | null)?.error;
    throw new Error(error || text || `HTTP ${res.status}`);
  }
  return parsed as T;
}

export function fetchDb() {
  return fetch("/api/db").then((res) => parseJson<AppDb>(res));
}

export function putDb(db: AppDb) {
  return fetch("/api/db", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(db),
  }).then((res) => parseJson<AppDb>(res));
}

export function putIngredientImages(
  id: string,
  images: { preview: string; thumb: string },
) {
  return fetch(`/api/images/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(images),
  }).then((res) => parseJson<{ ok: boolean }>(res));
}

export function deleteIngredientImages(id: string) {
  return fetch(`/api/images/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).then((res) => parseJson<{ ok: boolean }>(res));
}

export function fetchBackup() {
  return fetch("/api/backup").then((res) => parseJson<BackupFile>(res));
}

export function putBackup(payload: BackupFile) {
  return fetch("/api/backup", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => parseJson<AppDb>(res));
}
