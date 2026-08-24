import crypto from "node:crypto";

const base = "https://qingheng-family-d5fcrhrgab9855c5-1461373093.ap-shanghai.app.tcloudbase.com";
const username = `test_${crypto.randomBytes(4).toString("hex")}`;
const password = `Qh!${crypto.randomBytes(12).toString("base64url")}`;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return { response, body };
}

const registered = await json("/api/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const cookie = registered.response.headers.get("set-cookie")?.split(";")[0];
if (!cookie) throw new Error("注册成功但没有收到安全会话 Cookie");

const session = await json("/api/auth/session", { headers: { cookie } });
if (session.body.user?.username !== username) throw new Error("登录状态读取不一致");

const state = {
  version: 1,
  activeProfileId: "profile-smoke",
  profiles: [{
    id: "profile-smoke",
    nickname: "部署测试",
    birthDate: "1990-01-01",
    sex: "female",
    heightCm: 165,
    unit: "kg",
    stage: "adult",
    activityLevel: "light",
    goalType: "maintain",
    timezone: "Asia/Shanghai",
    aiProvider: "rules",
    createdAt: new Date().toISOString(),
  }],
  weights: [],
  meals: [],
  contexts: [],
  exercises: [],
  customFoods: [],
  insights: [],
};

await json("/api/sync", {
  method: "PUT",
  headers: { cookie, "content-type": "application/json" },
  body: JSON.stringify(state),
});
const synced = await json("/api/sync", { headers: { cookie } });
if (synced.body.state?.profiles?.[0]?.nickname !== "部署测试") {
  throw new Error("云端保存后读取的数据不一致");
}

await json("/api/account", { method: "DELETE", headers: { cookie } });
const afterDelete = await fetch(`${base}/api/sync`, { headers: { cookie } });
if (afterDelete.status !== 401) throw new Error("测试账号删除后仍可读取数据");

console.log(JSON.stringify({
  ok: true,
  checks: ["注册", "安全会话", "云端保存", "跨请求读取", "账号删除"],
}));
