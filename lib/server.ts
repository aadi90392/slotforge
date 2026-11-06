import { env } from "cloudflare:workers";
export function db() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
}
export const uid = () => crypto.randomUUID();
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function digest(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function passwordHash(password: string, salt = randomToken()) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    material,
    256,
  );
  return (
    salt +
    ":" +
    Array.from(new Uint8Array(bits), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")
  );
}
export async function verifyPassword(password: string, stored: string) {
  const computed = await passwordHash(password, stored.split(":")[0]);
  let diff = computed.length ^ stored.length;
  for (let i = 0; i < computed.length; i++)
    diff |= computed.charCodeAt(i) ^ (stored.charCodeAt(i) || 0);
  return diff === 0;
}
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(v: unknown, message: string, status = 400): asserts v {
  if (!v) throw new ApiError(status, message);
}
export async function body(req: Request) {
  assert(
    Number(req.headers.get("content-length") || 0) < 16000,
    "Request too large",
    413,
  );
  const raw = await req.text();
  assert(raw.length < 16000, "Request too large", 413);
  try {
    const parsed = JSON.parse(raw);
    assert(
      parsed && typeof parsed === "object" && !Array.isArray(parsed),
      "Expected a JSON object",
    );
    return parsed;
  } catch {
    throw new ApiError(400, "Invalid JSON object");
  }
}
export type User = { id: string; name: string; email: string };
export async function currentUser(req: Request): Promise<User | null> {
  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)sf_session=([^;]+)/)?.[1];
  if (!token) return null;
  return db()
    .prepare(
      "SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
    )
    .bind(await digest(token), Date.now())
    .first<User>();
}
export async function requireUser(req: Request) {
  const u = await currentUser(req);
  assert(u, "Please sign in to continue", 401);
  return u;
}
export function cookie(req: Request, token: string, age = 604800) {
  return `sf_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function newSession(req: Request, user: User) {
  const token = randomToken();
  await db().batch([
    db().prepare("DELETE FROM sessions WHERE expires<?").bind(Date.now()),
    db().prepare("DELETE FROM rate_limits WHERE expires<?").bind(Date.now()),
  ]);
  await db()
    .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
    .bind(await digest(token), user.id, Date.now() + 604800000)
    .run();
  return json({ user }, 200, { "Set-Cookie": cookie(req, token) });
}
export async function member(userId: string, workspaceId: string) {
  const m = await db()
    .prepare(
      "SELECT m.role,w.name,w.timezone,w.owner_id FROM members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.workspace_id=?",
    )
    .bind(userId, workspaceId)
    .first<{
      role: string;
      name: string;
      timezone: string;
      owner_id: string;
    }>();
  assert(m, "Workspace not found", 404);
  return m;
}
export async function rateLimit(req: Request, action: string) {
  const bucket = Math.floor(Date.now() / 900000);
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const key = await digest(`${action}:${ip}:${bucket}`);
  const r = await db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
    )
    .bind(key, Date.now() + 900000)
    .first<{ count: number }>();
  assert(
    r && r.count <= 15,
    "Too many attempts. Please try again in 15 minutes.",
    429,
  );
}
