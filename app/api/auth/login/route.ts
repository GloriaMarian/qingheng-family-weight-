import { env } from "cloudflare:workers";
import {
  createSessionToken,
  normalizeUsername,
  sessionCookie,
  sha256,
  validatePassword,
  validateUsername,
  verifyPassword,
  PASSWORD_ITERATIONS,
  SESSION_SECONDS,
} from "../../../auth";

export const runtime = "edge";

type AccountRow = {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

type RateRow = {
  attempts: number;
  window_start: string;
  blocked_until: string | null;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const FAKE_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const FAKE_SALT = "AAAAAAAAAAAAAAAAAAAAAA";

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
  const username = typeof payload.username === "string" ? payload.username : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  if (validateUsername(username) || validatePassword(password)) {
    return Response.json({ error: "用户名或密码不正确" }, { status: 401 });
  }

  const usernameKey = normalizeUsername(username);
  const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
  const rateKey = await sha256(`${usernameKey}:${clientIp}`);
  const now = Date.now();
  const rate = await env.DB.prepare(
    "SELECT attempts, window_start, blocked_until FROM auth_rate_limits WHERE username_key = ?",
  )
    .bind(rateKey)
    .first<RateRow>();
  if (rate?.blocked_until && Date.parse(rate.blocked_until) > now) {
    return Response.json(
      { error: "尝试次数过多，请 15 分钟后再试" },
      { status: 429 },
    );
  }

  const account = await env.DB.prepare(
    "SELECT id, username, password_hash, password_salt, password_iterations FROM local_accounts WHERE username_key = ? LIMIT 1",
  )
    .bind(usernameKey)
    .first<AccountRow>();
  const passwordMatches = await verifyPassword(
    password,
    account?.password_hash ?? FAKE_HASH,
    account?.password_salt ?? FAKE_SALT,
    account?.password_iterations ?? PASSWORD_ITERATIONS,
  );

  if (!account || !passwordMatches) {
    const sameWindow =
      rate && now - Date.parse(rate.window_start) < WINDOW_MS;
    const attempts = sameWindow ? Number(rate.attempts) + 1 : 1;
    const windowStart = sameWindow
      ? rate.window_start
      : new Date(now).toISOString();
    const blockedUntil =
      attempts >= MAX_ATTEMPTS
        ? new Date(now + WINDOW_MS).toISOString()
        : null;
    await env.DB.prepare(
      "INSERT INTO auth_rate_limits (username_key, attempts, window_start, blocked_until, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(username_key) DO UPDATE SET attempts = excluded.attempts, window_start = excluded.window_start, blocked_until = excluded.blocked_until, updated_at = CURRENT_TIMESTAMP",
    )
      .bind(rateKey, attempts, windowStart, blockedUntil)
      .run();
    return Response.json(
      {
        error:
          blockedUntil
            ? "尝试次数过多，请 15 分钟后再试"
            : "用户名或密码不正确",
      },
      { status: blockedUntil ? 429 : 401 },
    );
  }

  const token = createSessionToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(now + SESSION_SECONDS * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_rate_limits WHERE username_key = ?").bind(rateKey),
    env.DB.prepare(
      "INSERT INTO auth_sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
    ).bind(tokenHash, account.id, expiresAt),
  ]);
  return Response.json(
    { ok: true, user: { username: account.username } },
    { headers: { "set-cookie": sessionCookie(token) } },
  );
}
