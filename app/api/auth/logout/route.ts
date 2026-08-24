import { env } from "cloudflare:workers";
import {
  clearSessionCookie,
  getSessionToken,
  sha256,
} from "../../../auth";

export const runtime = "edge";

export async function POST() {
  const token = await getSessionToken();
  if (token && env.DB) {
    await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
      .bind(await sha256(token))
      .run();
  }
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookie() } },
  );
}
