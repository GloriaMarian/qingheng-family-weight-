import { env } from "cloudflare:workers";
import {
  clearSessionCookie,
  getLocalUser,
  ownerKey,
} from "../../auth";

export const runtime = "edge";

export async function DELETE() {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const db = env.DB;
  if (!db) return Response.json({ error: "云端数据暂时不可用" }, { status: 503 });
  const owner = ownerKey(user);

  try {
    await db.batch([
      db.prepare("DELETE FROM ai_insights WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM exercise_entries WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM daily_contexts WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM meal_entries WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM weight_entries WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM custom_foods WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM profiles WHERE owner_email = ?").bind(owner),
      db.prepare("DELETE FROM auth_sessions WHERE account_id = ?").bind(user.id),
      db.prepare("DELETE FROM local_accounts WHERE id = ?").bind(user.id),
    ]);
    return Response.json(
      { ok: true },
      { headers: { "set-cookie": clearSessionCookie() } },
    );
  } catch {
    return Response.json(
      { error: "删除没有完成，云端数据仍然保留" },
      { status: 503 },
    );
  }
}
