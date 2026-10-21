import crypto from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type {
  AppDb,
  AuthUser,
  BackupFile,
  Buyer,
  InvoicePayment,
  InvoiceRecord,
  InvoiceSettings,
  PackRecord,
  PhotoRef,
  PickupRecord,
  PurgePreview,
  PurgeResult,
  StorageStats,
  UserRole,
} from "../src/types";
import {
  createDefaultDb,
  DEFAULT_INVOICE,
  normalizeInvoice,
} from "../src/storage/defaultDb";
import { normalizeDb } from "../src/storage/normalizeDb";
import {
  normalizeInvoiceRecord,
  normalizePickupPayments,
} from "../src/utils/format";
import type { AuthStore } from "./authStore";
import {
  SESSION_TTL_MS,
  clearSessionCookie,
  getSessionToken,
  sessionCookie,
} from "./authStore";

const BACKUP_FORMAT = "ecolink-backup";
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_THUMB_BYTES = 512 * 1024;

type CollectionKey =
  | "groups"
  | "ingredients"
  | "buyers"
  | "stores"
  | "orders"
  | "templates"
  | "pickupRecords"
  | "packRecords"
  | "invoiceRecords";

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rangeOf(from: unknown, to: unknown) {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  return from <= to ? { start: from, end: to } : { start: to, end: from };
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

function photoRefs(value: unknown, prefix: string): PhotoRef[] {
  if (!Array.isArray(value)) return [];
  const refs: PhotoRef[] = [];
  for (const item of value) {
    const id =
      typeof item === "string" ? item : text((item as { id?: unknown })?.id);
    if (!id || !id.startsWith(prefix)) continue;
    const rev =
      item && typeof item === "object"
        ? numberValue((item as { rev?: unknown }).rev)
        : 0;
    refs.push({ id, rev });
  }
  return refs;
}

function minimalBuyers(buyers: Buyer[]): Buyer[] {
  return buyers.map((buyer) => ({
    id: buyer.id,
    name: buyer.name,
    code: buyer.code,
    address: "",
    phone: "",
    logistics: "",
    commonIngredientIds: [],
    sort: buyer.sort,
  }));
}

export function createFileStore(
  dataDir: string,
  options: { auth?: AuthStore | null } = {},
) {
  const auth = options.auth ?? null;
  const imagesDir = path.join(dataDir, "images");
  const prePurgeDir = path.join(dataDir, "pre-purge");
  const cleanupLogPath = path.join(dataDir, "cleanup-log.json");
  const dbPath = path.join(dataDir, "db.json");

  function upsertInto(db: AppDb, key: CollectionKey, entity: { id: string }) {
    const list = db[key] as unknown as { id: string }[];
    const index = list.findIndex((item) => item.id === entity.id);
    if (index === -1) list.push(entity);
    else list[index] = entity;
  }

  function removeFrom(db: AppDb, key: CollectionKey, id: string) {
    const list = db[key] as unknown as { id: string }[];
    (db as unknown as Record<string, unknown>)[key] = list.filter(
      (item) => item.id !== id,
    );
  }

  function defaultDb(): AppDb {
    return createDefaultDb();
  }

  function writeDbAtomic(data: unknown) {
    fs.mkdirSync(dataDir, { recursive: true });
    const normalized = normalizeDb(data as Partial<AppDb>);
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(normalized, null, 2), "utf8");
    fs.renameSync(tmp, dbPath);
  }

  function ensureData() {
    fs.mkdirSync(imagesDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      writeDbAtomic(defaultDb());
    }
  }

  function readDb(): AppDb {
    ensureData();
    return normalizeDb(
      JSON.parse(fs.readFileSync(dbPath, "utf8")) as Partial<AppDb>,
    );
  }

  function sendJson(res: ServerResponse, status: number, body: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  }

  function sendText(res: ServerResponse, status: number, text: string) {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(text);
  }

  function sendForbidden(res: ServerResponse) {
    sendJson(res, 403, { error: "forbidden" });
  }

  function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
    const textBody = (await readBody(req)).toString("utf8");
    if (!textBody) return {} as T;
    return JSON.parse(textBody) as T;
  }

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function isSecureRequest(req: IncomingMessage) {
    const proto = String(req.headers["x-forwarded-proto"] ?? "")
      .split(",")[0]
      .trim();
    if (proto) return proto === "https";
    return Boolean((req.socket as { encrypted?: boolean }).encrypted);
  }

  function imagePath(id: string, kind: "preview" | "thumb") {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safe || safe !== id) return null;
    return path.join(
      imagesDir,
      kind === "thumb" ? `${safe}.thumb.jpg` : `${safe}.jpg`,
    );
  }

  function sendImage(res: ServerResponse, filePath: string) {
    if (!fs.existsSync(filePath)) {
      sendText(res, 404, "Not found");
      return;
    }
    const data = fs.readFileSync(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.end(data);
  }

  function decodeBase64Image(value: unknown): Buffer | null {
    if (typeof value !== "string" || !value) return null;
    const cleaned = value.includes(",") ? value.split(",")[1] : value;
    if (!cleaned) return null;
    const buf = Buffer.from(cleaned, "base64");
    return buf.length ? buf : null;
  }

  function deleteImageFiles(id: string) {
    for (const kind of ["preview", "thumb"] as const) {
      const file = imagePath(id, kind);
      if (file && fs.existsSync(file)) fs.unlinkSync(file);
    }
  }

  function isAppDb(value: unknown): value is AppDb {
    if (!value || typeof value !== "object") return false;
    const db = value as AppDb;
    return (
      !!db.settings &&
      (db.settings.locale === "zh" || db.settings.locale === "en") &&
      Array.isArray(db.groups) &&
      Array.isArray(db.ingredients) &&
      Array.isArray(db.buyers) &&
      Array.isArray(db.orders)
    );
  }

  function listImageIds() {
    ensureData();
    const ids = new Set<string>();
    for (const file of fs.readdirSync(imagesDir)) {
      const match = file.match(/^([a-zA-Z0-9_-]+)(?:\.thumb)?\.jpg$/);
      if (match) ids.add(match[1]);
    }
    return [...ids];
  }

  function imageBytes(ids: Iterable<string>) {
    let bytes = 0;
    for (const id of ids) {
      for (const kind of ["preview", "thumb"] as const) {
        const file = imagePath(id, kind);
        if (file && fs.existsSync(file)) bytes += fs.statSync(file).size;
      }
    }
    return bytes;
  }

  function buildBackup(): BackupFile {
    const images: BackupFile["images"] = {};
    for (const id of listImageIds()) {
      const previewPath = imagePath(id, "preview");
      const thumbPath = imagePath(id, "thumb");
      const preview =
        previewPath && fs.existsSync(previewPath)
          ? fs.readFileSync(previewPath).toString("base64")
          : "";
      const thumb =
        thumbPath && fs.existsSync(thumbPath)
          ? fs.readFileSync(thumbPath).toString("base64")
          : "";
      if (!preview && !thumb) continue;
      images[id] = { preview, thumb };
    }
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      db: readDb(),
      images,
    };
  }

  function restoreBackup(payload: BackupFile) {
    const decoded: { id: string; preview: Buffer | null; thumb: Buffer | null }[] =
      [];
    for (const [id, files] of Object.entries(payload.images ?? {})) {
      const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
      if (!safe || safe !== id) continue;
      decoded.push({
        id,
        preview: decodeBase64Image(files?.preview),
        thumb: decodeBase64Image(files?.thumb),
      });
    }

    writeDbAtomic(payload.db);
    fs.mkdirSync(imagesDir, { recursive: true });

    const keep = new Set<string>();
    for (const item of decoded) {
      const previewFile = imagePath(item.id, "preview");
      const thumbFile = imagePath(item.id, "thumb");
      if (item.preview && previewFile) {
        fs.writeFileSync(previewFile, item.preview);
        keep.add(path.basename(previewFile));
      }
      if (item.thumb && thumbFile) {
        fs.writeFileSync(thumbFile, item.thumb);
        keep.add(path.basename(thumbFile));
      }
    }

    for (const file of fs.readdirSync(imagesDir)) {
      if (!keep.has(file)) {
        fs.unlinkSync(path.join(imagesDir, file));
      }
    }
  }

  function currentUser(req: IncomingMessage): AuthUser | null {
    return auth ? auth.readToken(getSessionToken(req)) : null;
  }

  function isAdmin(user: AuthUser | null) {
    return !auth || user?.role === "admin";
  }

  function roleAllowed(user: AuthUser | null, roles: UserRole[]) {
    if (!auth) return true;
    return Boolean(user && roles.includes(user.role));
  }

  function filterDbForUser(db: AppDb, user: AuthUser | null): AppDb {
    if (!auth || !user || user.role === "admin") return db;

    const restrictedSettings = {
      ...db.settings,
      invoice: { ...DEFAULT_INVOICE },
    };

    if (user.role === "editor") {
      return {
        ...db,
        settings: restrictedSettings,
        pickupRecords: [],
        packRecords: [],
        invoiceRecords: [],
      };
    }

    if (user.role === "uploader") {
      return {
        ...db,
        settings: restrictedSettings,
        groups: [],
        ingredients: [],
        buyers: minimalBuyers(db.buyers),
        orders: [],
        templates: [],
        pickupRecords: db.pickupRecords.filter(
          (record) => record.createdBy === user.id,
        ),
        packRecords: db.packRecords.filter(
          (record) => record.createdBy === user.id,
        ),
        invoiceRecords: [],
      };
    }

    if (user.role === "picker") {
      return {
        ...db,
        settings: restrictedSettings,
        groups: [],
        ingredients: [],
        buyers: minimalBuyers(db.buyers),
        orders: [],
        templates: [],
        pickupRecords: db.pickupRecords.filter(
          (record) => record.createdBy === user.id,
        ),
        packRecords: [],
        invoiceRecords: [],
      };
    }

    if (user.role === "packer") {
      return {
        ...db,
        settings: restrictedSettings,
        groups: [],
        ingredients: [],
        buyers: minimalBuyers(db.buyers),
        orders: [],
        templates: [],
        pickupRecords: [],
        packRecords: db.packRecords.filter(
          (record) => record.createdBy === user.id,
        ),
        invoiceRecords: db.invoiceRecords,
      };
    }

    // summarizer：只读业务数据，可查看发票记录。
    return {
      ...db,
      templates: [],
    };
  }

  function dbForUser(user: AuthUser | null) {
    return filterDbForUser(readDb(), user);
  }

  function refreshForUser(res: ServerResponse, user: AuthUser | null) {
    sendJson(res, 200, dbForUser(user));
  }

  function parseRange(body: { from?: unknown; to?: unknown }) {
    return rangeOf(body.from, body.to);
  }

  function previewPurge(
    db: AppDb,
    start: string,
    end: string,
    includeInvoices: boolean,
  ): PurgePreview {
    const pickups = db.pickupRecords.filter((record) =>
      inRange(record.date, start, end),
    );
    const packs = db.packRecords.filter((record) =>
      inRange(record.date, start, end),
    );
    const invoiceCount = includeInvoices
      ? db.invoiceRecords.filter((record) =>
          inRange(record.snapshot.issuedAt, start, end),
        ).length
      : 0;
    const photoIds = new Set<string>();
    for (const record of [...pickups, ...packs]) {
      for (const photo of [...record.photos, ...record.invoicePhotos]) {
        photoIds.add(photo.id);
      }
    }
    return {
      from: start,
      to: end,
      orders: db.orders.filter((order) => inRange(order.date, start, end)).length,
      pickups: pickups.length,
      packs: packs.length,
      invoices: invoiceCount,
      photos: photoIds.size,
      bytes: imageBytes(photoIds),
    };
  }

  function referencedImageIds(db: AppDb) {
    const ids = new Set<string>();
    for (const ingredient of db.ingredients) {
      if (ingredient.hasImage) ids.add(ingredient.id);
    }
    for (const record of db.pickupRecords) {
      for (const photo of [...record.photos, ...record.invoicePhotos]) {
        ids.add(photo.id);
      }
    }
    for (const record of db.packRecords) {
      for (const photo of [...record.photos, ...record.invoicePhotos]) {
        ids.add(photo.id);
      }
    }
    return ids;
  }

  function sweepOrphanImages(db: AppDb) {
    const referenced = referencedImageIds(db);
    let photosDeleted = 0;
    let bytesFreed = 0;
    for (const id of listImageIds()) {
      if (referenced.has(id)) continue;
      for (const kind of ["preview", "thumb"] as const) {
        const file = imagePath(id, kind);
        if (file && fs.existsSync(file)) {
          bytesFreed += fs.statSync(file).size;
          fs.unlinkSync(file);
        }
      }
      photosDeleted += 1;
    }
    return { photosDeleted, bytesFreed };
  }

  function createPrePurgeBackup() {
    fs.mkdirSync(prePurgeDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `backup-${stamp}.json`;
    const file = path.join(prePurgeDir, name);
    fs.writeFileSync(file, JSON.stringify(buildBackup()), "utf8");

    const files = fs
      .readdirSync(prePurgeDir)
      .filter((item) => item.endsWith(".json"))
      .sort()
      .reverse();
    for (const old of files.slice(3)) {
      fs.unlinkSync(path.join(prePurgeDir, old));
    }
    return name;
  }

  function appendCleanupLog(entry: Record<string, unknown>) {
    let list: unknown[] = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(cleanupLogPath, "utf8"));
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      // 第一次清理时文件不存在，直接新建。
    }
    list.push({ ...entry, at: new Date().toISOString() });
    fs.writeFileSync(cleanupLogPath, JSON.stringify(list.slice(-200), null, 2), "utf8");
  }

  function storageStats(): StorageStats {
    const db = readDb();
    const ids = listImageIds();
    return {
      dbBytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
      imageCount: ids.length,
      imageBytes: imageBytes(ids),
      orders: db.orders.length,
      pickups: db.pickupRecords.length,
      packs: db.packRecords.length,
      invoices: db.invoiceRecords.length,
    };
  }

  function canWriteImage(user: AuthUser | null, id: string) {
    if (!auth || !user) return true;
    if (user.role === "admin") return true;
    if (user.role === "summarizer") {
      return (
        id.startsWith("pickup-") ||
        id.startsWith("pack-") ||
        id.startsWith("invoice-")
      );
    }
    if (user.role === "uploader" || user.role === "picker") {
      return id.startsWith("pickup-") || id.startsWith("pack-");
    }
    if (user.role === "packer") return id.startsWith("pack-");
    return false;
  }

  // 返回 true 表示该请求已由认证相关路由处理。
  async function handleAuthRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    url: string,
    method: string,
  ): Promise<boolean> {
    if (url === "/api/auth/me" && method === "GET") {
      sendJson(res, 200, {
        authEnabled: Boolean(auth),
        user: auth
          ? auth.readToken(getSessionToken(req))
          : { id: "local", username: "local", role: "admin" as UserRole },
      });
      return true;
    }

    if (url === "/api/auth/login" && method === "POST") {
      if (!auth) {
        sendJson(res, 400, { error: "auth-disabled" });
        return true;
      }
      const body = await readJsonBody<{ username?: string; password?: string }>(req);
      const user = auth.verifyCredentials(
        String(body.username ?? ""),
        String(body.password ?? ""),
      );
      if (!user) {
        sendJson(res, 401, { error: "bad-credentials" });
        return true;
      }
      res.setHeader(
        "Set-Cookie",
        sessionCookie(auth.issueToken(user), SESSION_TTL_MS, isSecureRequest(req)),
      );
      sendJson(res, 200, { user });
      return true;
    }

    if (url === "/api/auth/logout" && method === "POST") {
      res.setHeader("Set-Cookie", clearSessionCookie(isSecureRequest(req)));
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (url === "/api/auth/password" && method === "POST") {
      if (!auth) {
        sendJson(res, 400, { error: "auth-disabled" });
        return true;
      }
      const me = auth.readToken(getSessionToken(req));
      if (!me) {
        sendJson(res, 401, { error: "unauthorized" });
        return true;
      }
      const body = await readJsonBody<{
        currentPassword?: string;
        newPassword?: string;
      }>(req);
      if (!auth.verifyCredentials(me.username, String(body.currentPassword ?? ""))) {
        sendJson(res, 400, { error: "bad-current-password" });
        return true;
      }
      try {
        auth.setPassword(me.id, String(body.newPassword ?? ""));
        sendJson(res, 200, { ok: true });
      } catch (error) {
        sendJson(res, 400, { error: errorMessage(error) });
      }
      return true;
    }

    if (url === "/api/users" || url.startsWith("/api/users/")) {
      if (!auth) {
        sendJson(res, 404, { error: "not-found" });
        return true;
      }
      const me = auth.readToken(getSessionToken(req));
      if (!me) {
        sendJson(res, 401, { error: "unauthorized" });
        return true;
      }
      if (me.role !== "admin") {
        sendJson(res, 403, { error: "forbidden" });
        return true;
      }

      if (url === "/api/users" && method === "GET") {
        sendJson(res, 200, { users: auth.listUsers().map(auth.toPublic) });
        return true;
      }

      if (url === "/api/users" && method === "POST") {
        const body = await readJsonBody<{
          username?: string;
          password?: string;
          role?: string;
        }>(req);
        try {
          const user = auth.createUser(
            String(body.username ?? ""),
            String(body.password ?? ""),
            body.role as UserRole,
          );
          sendJson(res, 201, { user });
        } catch (error) {
          sendJson(res, 400, { error: errorMessage(error) });
        }
        return true;
      }

      const match = url.match(/^\/api\/users\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (method === "DELETE") {
          if (id === me.id) {
            sendJson(res, 400, { error: "cannot-delete-self" });
            return true;
          }
          try {
            auth.deleteUser(id);
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 400, { error: errorMessage(error) });
          }
          return true;
        }
        if (method === "PATCH") {
          const body = await readJsonBody<{ role?: string; password?: string }>(req);
          try {
            if (body.role) auth.setRole(id, body.role as UserRole);
            if (body.password) auth.setPassword(id, String(body.password));
            sendJson(res, 200, { ok: true });
          } catch (error) {
            sendJson(res, 400, { error: errorMessage(error) });
          }
          return true;
        }
      }

      sendJson(res, 404, { error: "not-found" });
      return true;
    }

    return false;
  }

  function evidenceKind(url: string) {
    const match = url.match(/^\/api\/(pickups|packs)(?:\/([^/]+))?$/);
    if (!match) return null;
    return {
      collection: (match[1] === "pickups" ? "pickupRecords" : "packRecords") as
        | "pickupRecords"
        | "packRecords",
      id: match[2] ? decodeURIComponent(match[2]) : null,
      isPickup: match[1] === "pickups",
    };
  }

  async function handleEvidenceRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    url: string,
    method: string,
    user: AuthUser | null,
  ): Promise<boolean> {
    const kind = evidenceKind(url);
    if (!kind) return false;

    const allowedRoles: UserRole[] = kind.isPickup
      ? ["admin", "uploader", "picker", "summarizer"]
      : ["admin", "uploader", "packer", "summarizer"];
    if (!roleAllowed(user, allowedRoles)) {
      sendForbidden(res);
      return true;
    }

    if (method === "POST" && !kind.id) {
      const body = await readJsonBody<Partial<PickupRecord & PackRecord>>(req);
      const id = text(body.id);
      if (!id || !id.startsWith(kind.isPickup ? "pickup-" : "pack-")) {
        sendJson(res, 400, { error: "invalid-id" });
        return true;
      }
      if (!isIsoDate(body.date)) {
        sendJson(res, 400, { error: "invalid-date" });
        return true;
      }
      const allowEmptyFields =
        !auth || user?.role === "uploader" || user?.role === "admin";
      const storeName = text(body.storeName);
      if (!storeName && !allowEmptyFields) {
        sendJson(res, 400, { error: "store-required" });
        return true;
      }
      const logistics = text(body.logistics);
      if (!kind.isPickup && !logistics && !allowEmptyFields) {
        sendJson(res, 400, { error: "logistics-required" });
        return true;
      }

      const db = readDb();
      const list = kind.isPickup ? db.pickupRecords : db.packRecords;
      const existing = list.find((record) => record.id === id);
      if (
        user &&
        user.role !== "admin" &&
        user.role !== "summarizer" &&
        existing &&
        existing.createdBy !== user.id
      ) {
        sendForbidden(res);
        return true;
      }

      const prefix = kind.isPickup ? "pickup-" : "pack-";
      const belongsToRecord = (photo: PhotoRef) =>
        photo.id === id || photo.id.startsWith(`${id}-`);
      const photos = photoRefs(body.photos, prefix).filter(belongsToRecord);
      const invoicePhotos = photoRefs(body.invoicePhotos, prefix).filter(
        belongsToRecord,
      );
      const removedPhotos = new Set<string>();
      for (const photo of [
        ...(existing?.photos ?? []),
        ...(existing?.invoicePhotos ?? []),
      ]) {
        removedPhotos.add(photo.id);
      }
      for (const photo of [...photos, ...invoicePhotos]) {
        removedPhotos.delete(photo.id);
      }

      const now = Date.now();
      if (kind.isPickup) {
        const next: PickupRecord = {
          id,
          date: body.date,
          storeName,
          tax: Math.max(0, numberValue(body.tax)),
          amount: Math.max(0, numberValue(body.amount)),
          note: text(body.note),
          buyerId: text(body.buyerId) || undefined,
          photos,
          invoicePhotos,
          payments: normalizePickupPayments(
            body.payments ?? (existing as PickupRecord | undefined)?.payments,
          ),
          createdBy: existing?.createdBy ?? user?.id ?? "local",
          createdByName: existing?.createdByName ?? user?.username ?? "local",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        for (const payment of (existing as PickupRecord | undefined)?.payments ??
          []) {
          for (const photo of payment.proofPhotos ?? []) {
            removedPhotos.add(photo.id);
          }
        }
        for (const payment of next.payments) {
          for (const photo of payment.proofPhotos ?? []) {
            removedPhotos.delete(photo.id);
          }
        }
        upsertInto(db, "pickupRecords", next);
      } else {
        const next: PackRecord = {
          id,
          date: body.date,
          logistics,
          trackingNo: text(body.trackingNo),
          storeName,
          note: text(body.note),
          buyerId: text(body.buyerId) || undefined,
          invoiceIds: Array.isArray(body.invoiceIds)
            ? body.invoiceIds.filter(
                (value): value is string =>
                  typeof value === "string" && Boolean(value),
              )
            : ((existing as PackRecord | undefined)?.invoiceIds ?? []),
          photos,
          invoicePhotos,
          createdBy: existing?.createdBy ?? user?.id ?? "local",
          createdByName: existing?.createdByName ?? user?.username ?? "local",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        upsertInto(db, "packRecords", next);
      }
      writeDbAtomic(db);
      for (const photoId of removedPhotos) deleteImageFiles(photoId);
      refreshForUser(res, user);
      return true;
    }

    if (method === "DELETE" && kind.id) {
      const db = readDb();
      const list = kind.isPickup ? db.pickupRecords : db.packRecords;
      const existing = list.find((record) => record.id === kind.id);
      if (!existing) {
        sendJson(res, 404, { error: "not-found" });
        return true;
      }
      if (user && user.role !== "admin" && existing.createdBy !== user.id) {
        sendForbidden(res);
        return true;
      }
      removeFrom(db, kind.collection, kind.id);
      writeDbAtomic(db);
      for (const photo of [
        ...(existing.photos ?? []),
        ...(existing.invoicePhotos ?? []),
      ]) {
        deleteImageFiles(photo.id);
      }
      refreshForUser(res, user);
      return true;
    }

    sendJson(res, 405, { error: "method-not-allowed" });
    return true;
  }

  async function handleInvoiceRoute(
    req: IncomingMessage,
    res: ServerResponse,
    url: string,
    method: string,
    user: AuthUser | null,
  ): Promise<boolean> {
    const paymentMatch = url.match(
      /^\/api\/invoices\/([^/]+)\/payments(?:\/([^/]+)\/void)?$/,
    );
    if (paymentMatch) {
      if (!roleAllowed(user, ["admin", "summarizer"])) {
        sendForbidden(res);
        return true;
      }
      if (method !== "POST") {
        sendJson(res, 405, { error: "method-not-allowed" });
        return true;
      }
      const invoiceId = decodeURIComponent(paymentMatch[1]);
      const paymentId = paymentMatch[2]
        ? decodeURIComponent(paymentMatch[2])
        : null;
      const db = readDb();
      const record = db.invoiceRecords.find((item) => item.id === invoiceId);
      if (!record) {
        sendJson(res, 404, { error: "invoice-not-found" });
        return true;
      }

      if (paymentId) {
        const now = Date.now();
        record.payments = record.payments.map((payment) =>
          payment.id === paymentId
            ? {
                ...payment,
                voidedAt: now,
                voidedBy: user?.id ?? "local",
                voidedByName: user?.username ?? "local",
              }
            : payment,
        );
        writeDbAtomic(db);
        sendJson(res, 200, { record, db: dbForUser(user) });
        return true;
      }

      const body = await readJsonBody<Partial<InvoicePayment>>(req);
      const amount = numberValue(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        sendJson(res, 400, { error: "invalid-payment-amount" });
        return true;
      }
      const paid = record.payments.reduce(
        (sum, payment) => (payment.voidedAt ? sum : sum + payment.amount),
        0,
      );
      const outstanding = Math.max(0, record.snapshot.total - paid);
      if (amount > outstanding + 0.0001) {
        sendJson(res, 400, { error: "payment-over-amount" });
        return true;
      }
      record.payments.push({
        id: text(body.id) || `invoice-payment-${crypto.randomUUID()}`,
        date: text(body.date),
        amount,
        method: text(body.method),
        note: text(body.note),
        proofPhotos: Array.isArray(body.proofPhotos)
          ? body.proofPhotos
              .filter(
                (photo): photo is PhotoRef =>
                  Boolean(photo) &&
                  typeof photo === "object" &&
                  typeof (photo as PhotoRef).id === "string",
              )
              .map((photo) => ({
                id: photo.id,
                rev: numberValue(photo.rev),
              }))
          : [],
        createdBy: user?.id ?? "local",
        createdByName: user?.username ?? "local",
        createdAt: Date.now(),
      });
      writeDbAtomic(db);
      sendJson(res, 200, { record, db: dbForUser(user) });
      return true;
    }

    if (url !== "/api/invoices" || method !== "POST") return false;
    if (!roleAllowed(user, ["admin", "summarizer"])) {
      sendForbidden(res);
      return true;
    }
    const body = await readJsonBody<Partial<InvoiceRecord>>(req);
    const invoiceNo = text(body.invoiceNo);
    if (!invoiceNo || !text(body.buyerId) || !body.snapshot) {
      sendJson(res, 400, { error: "invalid-invoice" });
      return true;
    }
    const db = readDb();
    const id = text(body.id) || `invoice-${crypto.randomUUID()}`;
    const existingIndex = db.invoiceRecords.findIndex(
      (record) => record.id === id,
    );
    const existing = existingIndex >= 0 ? db.invoiceRecords[existingIndex] : null;
    if (
      db.invoiceRecords.some(
        (record) => record.id !== id && record.invoiceNo === invoiceNo,
      )
    ) {
      sendJson(res, 400, { error: "invoice-number-taken" });
      return true;
    }
    const numberFromBody = numberValue(body.invoiceNumber);
    const numberFromText = numberValue(
      Number((invoiceNo.match(/(\d+)$/) ?? [])[1]),
    );
    const invoiceNumber =
      numberFromBody || numberFromText || existing?.invoiceNumber || 0;
    const next = normalizeInvoiceRecord({
      ...existing,
      ...body,
      id,
      invoiceNo,
      invoiceNumber,
      payments: Array.isArray(body.payments)
        ? body.payments
        : (existing?.payments ?? []),
      createdBy: existing?.createdBy ?? user?.id ?? "local",
      createdByName: existing?.createdByName ?? user?.username ?? "local",
      createdAt: existing?.createdAt ?? Date.now(),
    });
    const paid = next.payments.reduce(
      (sum, payment) => (payment.voidedAt ? sum : sum + payment.amount),
      0,
    );
    if (next.snapshot.total + 0.0001 < paid) {
      sendJson(res, 400, { error: "invoice-total-below-paid" });
      return true;
    }
    if (existingIndex >= 0) {
      db.invoiceRecords[existingIndex] = next;
    } else {
      db.invoiceRecords.push(next);
    }
    if (invoiceNumber >= db.settings.invoice.nextInvoiceNumber) {
      db.settings.invoice.nextInvoiceNumber = invoiceNumber + 1;
    }
    writeDbAtomic(db);
    sendJson(res, 200, { record: next, db: dbForUser(user) });
    return true;
  }

  async function handleAdminRoutes(
    req: IncomingMessage,
    res: ServerResponse,
    url: string,
    method: string,
    user: AuthUser | null,
  ): Promise<boolean> {
    if (!url.startsWith("/api/admin/")) return false;
    if (!isAdmin(user)) {
      sendForbidden(res);
      return true;
    }

    if (url === "/api/admin/storage" && method === "GET") {
      sendJson(res, 200, storageStats());
      return true;
    }

    if (url === "/api/admin/purge/preview" && method === "POST") {
      const body = await readJsonBody<{
        from?: unknown;
        to?: unknown;
        includeInvoices?: unknown;
      }>(req);
      const range = parseRange(body);
      if (!range) {
        sendJson(res, 400, { error: "invalid-range" });
        return true;
      }
      sendJson(
        res,
        200,
        previewPurge(readDb(), range.start, range.end, Boolean(body.includeInvoices)),
      );
      return true;
    }

    if (url === "/api/admin/purge" && method === "POST") {
      const body = await readJsonBody<{
        from?: unknown;
        to?: unknown;
        includeInvoices?: unknown;
        confirm?: unknown;
      }>(req);
      const range = parseRange(body);
      if (!range) {
        sendJson(res, 400, { error: "invalid-range" });
        return true;
      }
      if (body.confirm !== "DELETE") {
        sendJson(res, 400, { error: "confirm-required" });
        return true;
      }

      const before = previewPurge(
        readDb(),
        range.start,
        range.end,
        Boolean(body.includeInvoices),
      );
      let backupFile: string | undefined;
      try {
        backupFile = createPrePurgeBackup();
      } catch (error) {
        sendJson(res, 500, { error: `backup-failed: ${errorMessage(error)}` });
        return true;
      }

      const db = readDb();
      db.orders = db.orders.filter(
        (order) => !inRange(order.date, range.start, range.end),
      );
      db.pickupRecords = db.pickupRecords.filter(
        (record) => !inRange(record.date, range.start, range.end),
      );
      db.packRecords = db.packRecords.filter(
        (record) => !inRange(record.date, range.start, range.end),
      );
      if (body.includeInvoices) {
        db.invoiceRecords = db.invoiceRecords.filter(
          (record) => !inRange(record.snapshot.issuedAt, range.start, range.end),
        );
      }
      writeDbAtomic(db);
      const swept = sweepOrphanImages(db);
      appendCleanupLog({
        by: user?.username ?? "local",
        from: range.start,
        to: range.end,
        includeInvoices: Boolean(body.includeInvoices),
        orders: before.orders,
        pickups: before.pickups,
        packs: before.packs,
        invoices: before.invoices,
        photos: before.photos,
        photosDeleted: swept.photosDeleted,
        bytesFreed: swept.bytesFreed,
        backupFile,
      });

      const result: PurgeResult = {
        ...before,
        photosDeleted: swept.photosDeleted,
        bytesFreed: swept.bytesFreed,
        backupFile,
      };
      sendJson(res, 200, result);
      return true;
    }

    sendJson(res, 404, { error: "not-found" });
    return true;
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse) {
    const url = (req.url ?? "").split("?")[0];
    const method = req.method ?? "GET";

    if (await handleAuthRoutes(req, res, url, method)) return;

    const user = currentUser(req);
    // 认证开启时，其余所有接口都要求已登录。
    if (auth && !user) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    if (await handleAdminRoutes(req, res, url, method, user)) return;
    if (await handleEvidenceRoutes(req, res, url, method, user)) return;
    if (await handleInvoiceRoute(req, res, url, method, user)) return;

    if (url === "/api/settings" && method === "PATCH") {
      const body = await readJsonBody<{
        locale?: unknown;
        fontFamily?: unknown;
        fontSize?: unknown;
        invoice?: unknown;
      }>(req);
      const db = readDb();
      if (body.locale === "zh" || body.locale === "en") db.settings.locale = body.locale;
      if (isAdmin(user)) {
        if (typeof body.fontFamily === "string" && body.fontFamily) {
          db.settings.fontFamily = body.fontFamily;
        }
        const size = Number(body.fontSize);
        if (Number.isFinite(size) && size >= 6 && size <= 30) {
          db.settings.fontSize = Math.round(size);
        }
        if (body.invoice && typeof body.invoice === "object") {
          db.settings.invoice = normalizeInvoice(
            body.invoice as Partial<InvoiceSettings>,
          );
        }
      }
      writeDbAtomic(db);
      refreshForUser(res, user);
      return;
    }

    // 按实体增删改：每次只改动一条记录再落盘，避免整份覆盖把别人的改动冲掉。
    const entityMatch = url.match(
      /^\/api\/(groups|ingredients|buyers|stores|orders|templates)(?:\/([^/]+))?$/,
    );
    if (entityMatch) {
      const collection = entityMatch[1] as
        | "groups"
        | "ingredients"
        | "buyers"
        | "stores"
        | "orders"
        | "templates";
      const id = entityMatch[2] ? decodeURIComponent(entityMatch[2]) : null;

      const editableByEditor =
        collection === "orders" || collection === "templates";
      if (
        auth &&
        user &&
        user.role !== "admin" &&
        !(user.role === "editor" && editableByEditor)
      ) {
        sendForbidden(res);
        return;
      }

      if (method === "POST" && !id) {
        const entity = await readJsonBody<{ id?: unknown }>(req);
        if (!entity || typeof entity.id !== "string" || !entity.id) {
          sendJson(res, 400, { error: "missing-id" });
          return;
        }
        const db = readDb();
        if (collection === "orders") {
          // 同一天 + 同一客户只保留一份订单（以「日期 + 客户」为准）。
          const date = (entity as { date?: unknown }).date;
          const buyerId = (entity as { buyerId?: unknown }).buyerId;
          db.orders = db.orders.filter(
            (order) => !(order.date === date && order.buyerId === buyerId),
          );
          db.orders.push(entity as unknown as AppDb["orders"][number]);
        } else {
          upsertInto(db, collection, entity as unknown as { id: string });
        }
        writeDbAtomic(db);
        refreshForUser(res, user);
        return;
      }

      if (method === "DELETE" && id) {
        const db = readDb();
        if (
          collection === "groups" &&
          db.ingredients.some((item) => item.groupId === id)
        ) {
          sendJson(res, 400, { error: "group-in-use" });
          return;
        }
        removeFrom(db, collection, id);
        writeDbAtomic(db);
        refreshForUser(res, user);
        return;
      }

      sendJson(res, 405, { error: "method-not-allowed" });
      return;
    }

    if (url === "/api/db" && method === "GET") {
      sendJson(res, 200, dbForUser(user));
      return;
    }

    if (url === "/api/db" && method === "PUT") {
      if (!isAdmin(user)) {
        sendForbidden(res);
        return;
      }
      const body = JSON.parse((await readBody(req)).toString("utf8")) as AppDb;
      if (!isAppDb(body)) {
        sendJson(res, 400, { error: "Invalid db payload" });
        return;
      }
      writeDbAtomic(body);
      sendJson(res, 200, dbForUser(user));
      return;
    }

    if (url === "/api/backup" && method === "GET") {
      if (!isAdmin(user)) {
        sendForbidden(res);
        return;
      }
      sendJson(res, 200, buildBackup());
      return;
    }

    if (url === "/api/backup" && method === "PUT") {
      if (!isAdmin(user)) {
        sendForbidden(res);
        return;
      }
      const raw = await readBody(req);
      if (raw.length > MAX_BACKUP_BYTES) {
        sendJson(res, 413, { error: "Backup too large" });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString("utf8"));
      } catch {
        sendJson(res, 400, { error: "invalid-backup" });
        return;
      }
      const payload = parsed as BackupFile;
      if (
        !payload ||
        payload.format !== BACKUP_FORMAT ||
        payload.version !== BACKUP_VERSION ||
        !isAppDb(payload.db) ||
        !payload.images ||
        typeof payload.images !== "object"
      ) {
        sendJson(res, 400, { error: "invalid-backup" });
        return;
      }
      restoreBackup(payload);
      sendJson(res, 200, dbForUser(user));
      return;
    }

    const imageMatch = url.match(/^\/api\/images\/([^/]+)(?:\/(thumb))?$/);
    if (imageMatch) {
      const id = decodeURIComponent(imageMatch[1]);
      const kind = imageMatch[2] === "thumb" ? "thumb" : "preview";
      const file = imagePath(id, kind);
      if (!file) {
        sendText(res, 400, "Invalid id");
        return;
      }

      if (method === "GET") {
        sendImage(res, file);
        return;
      }

      if (!canWriteImage(user, id)) {
        sendForbidden(res);
        return;
      }

      if (method === "DELETE") {
        deleteImageFiles(id);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === "PUT") {
        const payload = JSON.parse((await readBody(req)).toString("utf8")) as {
          preview?: string;
          thumb?: string;
        };
        const preview = decodeBase64Image(payload.preview);
        const thumb = decodeBase64Image(payload.thumb);
        if (!preview || !thumb) {
          sendJson(res, 400, { error: "Both preview and thumb are required" });
          return;
        }
        if (preview.length > MAX_IMAGE_BYTES || thumb.length > MAX_THUMB_BYTES) {
          sendJson(res, 413, { error: "image-too-large" });
          return;
        }
        fs.mkdirSync(imagesDir, { recursive: true });
        fs.writeFileSync(imagePath(id, "preview")!, preview);
        fs.writeFileSync(imagePath(id, "thumb")!, thumb);
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    sendJson(res, 404, { error: "Not found" });
  }

  return { ensureData, handleApi, sendJson };
}
