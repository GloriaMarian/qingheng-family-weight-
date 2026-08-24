import { env } from "cloudflare:workers";
import {
  createSessionToken,
  hashPassword,
  normalizeUsername,
  sessionCookie,
  sha256,
  validatePassword,
  validateUsername,
  SESSION_SECONDS,
} from "../../../auth";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "账号服务暂时不可用" }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) {
    return Response.json({ error: "请求内容过大" }, { status: 413 });
  }

  let payload: { username?: unknown; password?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return Response.json({ error: "数据格式不正确" }, { status: 400 });
  }
  const username =
    typeof payload.username === "string"
      ? payload.username.trim().normalize("NFKC")
      : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const validationError =
    validateUsername(username) ?? validatePassword(password);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const usernameKey = normalizeUsername(username);
  const existing = await env.DB.prepare(
    "SELECT 1 FROM local_accounts WHERE username_key = ? LIMIT 1",
  )
    .bind(usernameKey)
    .first();
  if (existing) {
    return Response.json({ error: "这个用户名已经被使用" }, { status: 409 });
  }

  const accountId = crypto.randomUUID();
  const passwordRecord = await hashPassword(password);
  const token = createSessionToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();

  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO local_accounts (id, username, username_key, password_hash, password_salt, password_iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      ).bind(
        accountId,
        username,
        usernameKey,
        passwordRecord.hash,
        passwordRecord.salt,
        passwordRecord.iterations,
      ),
      env.DB.prepare(
        "INSERT INTO auth_sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
      ).bind(tokenHash, accountId, expiresAt),
    ]);
    return Response.json(
      { ok: true, user: { username } },
      { headers: { "set-cookie": sessionCookie(token) } },
    );
  } catch {
    return Response.json(
      { error: "注册没有完成，可能是用户名刚刚被占用" },
      { status: 409 },
    );
  }
}
