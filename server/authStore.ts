import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { AuthUser, UserRole } from "../src/types";

// 用户账号与会话。数据写在 <dataDir>/auth.json（和业务数据 db.json 分开）。
// 密码用 Node 内置 scrypt 哈希；会话是不落库的 HMAC 签名令牌，放 httpOnly Cookie。

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const COOKIE_NAME = "ecolink_session";

type UserRecord = {
  id: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  createdAt: number;
};

type UsersDb = {
  secret: string;
  users: UserRecord[];
};

export type AuthStore = ReturnType<typeof createAuthStore>;

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (!salt.length || !expected.length) return false;
  const actual = crypto.scryptSync(password, salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function createAuthStore(dataDir: string) {
  const dbPath = path.join(dataDir, "auth.json");

  function load(): UsersDb {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(dbPath)) {
      const initial: UsersDb = {
        secret: crypto.randomBytes(32).toString("hex"),
        users: [],
      };
      fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(dbPath, "utf8")) as Partial<UsersDb>;
    return {
      secret:
        typeof parsed.secret === "string" && parsed.secret
          ? parsed.secret
          : crypto.randomBytes(32).toString("hex"),
      users: Array.isArray(parsed.users) ? (parsed.users as UserRecord[]) : [],
    };
  }

  function save(db: UsersDb) {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, dbPath);
  }

  function toPublic(user: UserRecord): AuthUser {
    return { id: user.id, username: user.username, role: user.role };
  }

  function listUsers() {
    return load().users;
  }

  function hasUsers() {
    return load().users.length > 0;
  }

  function adminCount(users: UserRecord[]) {
    return users.filter((user) => user.role === "admin").length;
  }

  function findByUsername(username: string) {
    const lower = username.trim().toLowerCase();
    return load().users.find((user) => user.username.toLowerCase() === lower) ?? null;
  }

  function createUser(username: string, password: string, role: UserRole): AuthUser {
    const name = username.trim();
    if (!name) throw new Error("username-required");
    if (!password || password.length < 6) throw new Error("password-too-short");
    const db = load();
    if (db.users.some((user) => user.username.toLowerCase() === name.toLowerCase())) {
      throw new Error("username-taken");
    }
    const user: UserRecord = {
      id: `user-${crypto.randomUUID()}`,
      username: name,
      role: role === "admin" ? "admin" : "editor",
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };
    db.users.push(user);
    save(db);
    return toPublic(user);
  }

  function deleteUser(id: string) {
    const db = load();
    const user = db.users.find((item) => item.id === id);
    if (!user) throw new Error("user-not-found");
    if (user.role === "admin" && adminCount(db.users) <= 1) {
      throw new Error("last-admin");
    }
    db.users = db.users.filter((item) => item.id !== id);
    save(db);
  }

  function setPassword(id: string, password: string) {
    if (!password || password.length < 6) throw new Error("password-too-short");
    const db = load();
    const user = db.users.find((item) => item.id === id);
    if (!user) throw new Error("user-not-found");
    user.passwordHash = hashPassword(password);
    save(db);
  }

  function setRole(id: string, role: UserRole) {
    const db = load();
    const user = db.users.find((item) => item.id === id);
    if (!user) throw new Error("user-not-found");
    if (user.role === "admin" && role !== "admin" && adminCount(db.users) <= 1) {
      throw new Error("last-admin");
    }
    user.role = role === "admin" ? "admin" : "editor";
    save(db);
  }

  function verifyCredentials(username: string, password: string): AuthUser | null {
    const user = findByUsername(username);
    if (!user) return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    return toPublic(user);
  }

  function issueToken(user: AuthUser) {
    const secret = load().secret;
    const body = Buffer.from(
      JSON.stringify({ uid: user.id, exp: Date.now() + SESSION_TTL_MS }),
    ).toString("base64url");
    const mac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${mac}`;
  }

  function readToken(token: string | null | undefined): AuthUser | null {
    if (!token) return null;
    const [body, mac] = token.split(".");
    if (!body || !mac) return null;
    const secret = load().secret;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64url");
    const given = Buffer.from(mac);
    const want = Buffer.from(expected);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
      return null;
    }
    let payload: { uid?: string; exp?: number };
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (!payload.exp || payload.exp < Date.now() || !payload.uid) return null;
    const user = load().users.find((item) => item.id === payload.uid);
    return user ? toPublic(user) : null;
  }

  return {
    hasUsers,
    listUsers,
    findByUsername,
    createUser,
    deleteUser,
    setPassword,
    setRole,
    verifyCredentials,
    issueToken,
    readToken,
    toPublic,
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getSessionToken(req: IncomingMessage) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] ?? null;
}

export function sessionCookie(token: string, maxAgeMs: number, secure: boolean) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearSessionCookie(secure: boolean) {
  const attrs = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}
