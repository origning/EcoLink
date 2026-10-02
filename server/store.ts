import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { AppDb, BackupFile, Order, UserRole } from "../src/types";
import { createDefaultDb } from "../src/storage/defaultDb";
import { normalizeDb } from "../src/storage/normalizeDb";
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

export function createFileStore(
  dataDir: string,
  options: { auth?: AuthStore | null } = {},
) {
  const auth = options.auth ?? null;
  const imagesDir = path.join(dataDir, "images");
  const dbPath = path.join(dataDir, "db.json");

  type CollectionKey = "groups" | "ingredients" | "buyers" | "orders" | "templates";

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

  function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
    const text = (await readBody(req)).toString("utf8");
    if (!text) return {} as T;
    return JSON.parse(text) as T;
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
            body.role === "admin" ? "admin" : "editor",
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
            if (body.role) {
              auth.setRole(id, body.role === "admin" ? "admin" : "editor");
            }
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

  async function handleApi(req: IncomingMessage, res: ServerResponse) {
    const url = (req.url ?? "").split("?")[0];
    const method = req.method ?? "GET";

    if (await handleAuthRoutes(req, res, url, method)) return;

    // 认证开启时，其余所有接口都要求已登录。
    if (auth) {
      const user = auth.readToken(getSessionToken(req));
      if (!user) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }
    }

    if (url === "/api/settings" && method === "PATCH") {
      const body = await readJsonBody<{
        locale?: unknown;
        fontFamily?: unknown;
        fontSize?: unknown;
      }>(req);
      const db = readDb();
      if (body.locale === "zh" || body.locale === "en") db.settings.locale = body.locale;
      if (typeof body.fontFamily === "string" && body.fontFamily) {
        db.settings.fontFamily = body.fontFamily;
      }
      const size = Number(body.fontSize);
      if (Number.isFinite(size) && size >= 6 && size <= 30) {
        db.settings.fontSize = Math.round(size);
      }
      writeDbAtomic(db);
      sendJson(res, 200, readDb());
      return;
    }

    // 按实体增删改：每次只改动一条记录再落盘，避免整份覆盖把别人的改动冲掉。
    const entityMatch = url.match(
      /^\/api\/(groups|ingredients|buyers|orders|templates)(?:\/([^/]+))?$/,
    );
    if (entityMatch) {
      const collection = entityMatch[1] as CollectionKey;
      const id = entityMatch[2] ? decodeURIComponent(entityMatch[2]) : null;

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
          db.orders.push(entity as unknown as Order);
        } else {
          upsertInto(db, collection, entity as unknown as { id: string });
        }
        writeDbAtomic(db);
        sendJson(res, 200, readDb());
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
        sendJson(res, 200, readDb());
        return;
      }

      sendJson(res, 405, { error: "method-not-allowed" });
      return;
    }

    if (url === "/api/db" && method === "GET") {
      sendJson(res, 200, readDb());
      return;
    }

    if (url === "/api/db" && method === "PUT") {
      const body = JSON.parse((await readBody(req)).toString("utf8")) as AppDb;
      if (!isAppDb(body)) {
        sendJson(res, 400, { error: "Invalid db payload" });
        return;
      }
      writeDbAtomic(body);
      sendJson(res, 200, body);
      return;
    }

    if (url === "/api/backup" && method === "GET") {
      sendJson(res, 200, buildBackup());
      return;
    }

    if (url === "/api/backup" && method === "PUT") {
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
      sendJson(res, 200, readDb());
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

      if (method === "DELETE") {
        for (const k of ["preview", "thumb"] as const) {
          const p = imagePath(id, k);
          if (p && fs.existsSync(p)) fs.unlinkSync(p);
        }
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
