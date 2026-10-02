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
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("ecolink:unauthorized"));
    }
    const error = (parsed as { error?: string } | null)?.error;
    throw new Error(error || text || `HTTP ${res.status}`);
  }
  return parsed as T;
}

function sendDb(url: string, init: RequestInit) {
  return fetch(url, { credentials: "include", ...init }).then((res) =>
    parseJson<AppDb>(res),
  );
}

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function fetchDb() {
  return fetch("/api/db", { credentials: "include" }).then((res) =>
    parseJson<AppDb>(res),
  );
}

export function putDb(db: AppDb) {
  return fetch("/api/db", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(db),
  }).then((res) => parseJson<AppDb>(res));
}

// ---- 按实体增删改（返回整份最新数据）----

export function saveSettings(patch: Partial<AppSettings>) {
  return sendDb("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function saveGroup(group: Group) {
  return sendDb("/api/groups", post(group));
}

export function saveIngredient(ingredient: Ingredient) {
  return sendDb("/api/ingredients", post(ingredient));
}

export function saveBuyer(buyer: Buyer) {
  return sendDb("/api/buyers", post(buyer));
}

export function saveOrder(order: Order) {
  return sendDb("/api/orders", post(order));
}

export function saveTemplate(template: OrderTemplate) {
  return sendDb("/api/templates", post(template));
}

export function deleteRecord(
  collection: "groups" | "ingredients" | "buyers" | "orders" | "templates",
  id: string,
) {
  return sendDb(`/api/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
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
  return fetch("/api/backup", { credentials: "include" }).then((res) =>
    parseJson<BackupFile>(res),
  );
}

export function putBackup(payload: BackupFile) {
  return fetch("/api/backup", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => parseJson<AppDb>(res));
}
