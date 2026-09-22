import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { AppDb, BackupFile } from "../src/types";
import { createDefaultDb } from "../src/storage/defaultDb";

const BACKUP_FORMAT = "ecolink-backup";
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 80 * 1024 * 1024;

export function createFileStore(dataDir: string) {
  const imagesDir = path.join(dataDir, "images");
  const dbPath = path.join(dataDir, "db.json");

  function defaultDb(): AppDb {
    return createDefaultDb();
  }

  function writeDbAtomic(data: unknown) {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
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
    return JSON.parse(fs.readFileSync(dbPath, "utf8")) as AppDb;
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

  async function handleApi(req: IncomingMessage, res: ServerResponse) {
    const url = (req.url ?? "").split("?")[0];
    const method = req.method ?? "GET";

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
