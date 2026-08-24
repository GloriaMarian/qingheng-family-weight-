import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import {
  SESSION_COOKIE,
  sha256,
} from "./auth-core.ts";

export * from "./auth-core.ts";

export type LocalUser = {
  id: string;
  username: string;
  displayName: string;
};

function readCookie(header: string | null, name: string) {
  const item = (header ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

export async function getSessionToken() {
  const requestHeaders = await headers();
  return readCookie(requestHeaders.get("cookie"), SESSION_COOKIE);
}

export async function getLocalUser(): Promise<LocalUser | null> {
  const token = await getSessionToken();
  if (!token || !env.DB) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT a.id, a.username FROM auth_sessions s JOIN local_accounts a ON a.id = s.account_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1",
  )
    .bind(tokenHash, new Date().toISOString())
    .first<{ id: string; username: string }>();
  if (!row) return null;
  return { id: row.id, username: row.username, displayName: row.username };
}

export function ownerKey(user: LocalUser) {
  return `local:${user.id}`;
}
