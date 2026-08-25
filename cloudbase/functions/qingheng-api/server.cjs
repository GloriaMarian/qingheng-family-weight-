/* eslint-disable @typescript-eslint/no-require-imports */
const express = require("express");
const crypto = require("node:crypto");
const cloudbase = require("@cloudbase/node-sdk");

const ENV_ID = process.env.QH_ENV_ID || "qingheng-family-d5fcrhrgab9855c5";
const SESSION_COOKIE = "qh_session";
const SESSION_DAYS = 30;
const COLLECTIONS = {
  accounts: "qh_accounts",
  sessions: "qh_sessions",
  states: "qh_states",
  limits: "qh_rate_limits",
};

let tcb = cloudbase.init({ env: ENV_ID });
let db = tcb.database();
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));

function nowIso() {
  return new Date().toISOString();
}

function configureCloudbase(context) {
  if (!context) return;
  tcb = cloudbase.init({ context });
  db = tcb.database();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function accountId(usernameKey) {
  return sha256(`account:${usernameKey}`);
}

function pbkdf2(password, salt, iterations = 100000) {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
}

function normalizeUsername(value) {
  return String(value || "").trim().normalize("NFKC");
}

function usernameKey(value) {
  return normalizeUsername(value).toLocaleLowerCase("zh-CN");
}

function validUsername(value) {
  return /^[\p{L}\p{N}_]{3,20}$/u.test(value);
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}

function readCookie(req, name) {
  const item = String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

function cookieHeader(token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function getDoc(collection, id) {
  try {
    const result = await db.collection(collection).doc(id).get();
    return Array.isArray(result.data) ? result.data[0] || null : result.data || null;
  } catch {
    return null;
  }
}

async function setDoc(collection, id, value) {
  const ref = db.collection(collection).doc(id);
  const existing = await getDoc(collection, id);
  if (existing) return ref.update(value);
  const data = { ...value };
  delete data._id;
  return ref.set(data);
}

async function removeDoc(collection, id) {
  try {
    await db.collection(collection).doc(id).remove();
  } catch {
    // 删除不存在的数据也视为成功。
  }
}

async function createSession(res, account) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await setDoc(COLLECTIONS.sessions, tokenHash, {
    accountId: account._id,
    username: account.username,
    createdAt: nowIso(),
    expiresAt,
  });
  res.setHeader("Set-Cookie", cookieHeader(token));
}

async function sessionUser(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = await getDoc(COLLECTIONS.sessions, sha256(token));
  if (!session || !session.expiresAt || session.expiresAt <= nowIso()) return null;
  const account = await getDoc(COLLECTIONS.accounts, session.accountId);
  if (!account) return null;
  return {
    id: account._id,
    username: account.username,
    displayName: account.username,
    tokenHash: sha256(token),
  };
}

function routes(path, handler) {
  app.all([path, path.replace(/^\/api/, "")], handler);
}

function validState(value) {
  if (!value || typeof value !== "object") return false;
  return (
    value.version === 1 &&
    Array.isArray(value.profiles) && value.profiles.length <= 30 &&
    Array.isArray(value.weights) && value.weights.length <= 30000 &&
    Array.isArray(value.meals) && value.meals.length <= 80000 &&
    Array.isArray(value.contexts) && value.contexts.length <= 20000 &&
    Array.isArray(value.exercises) && value.exercises.length <= 30000 &&
    Array.isArray(value.customFoods) && value.customFoods.length <= 3000 &&
    Array.isArray(value.insights) && value.insights.length <= 10000
  );
}

function ownedState(state) {
  const ids = new Set(state.profiles.map((item) => item.id));
  return [state.weights, state.meals, state.contexts, state.exercises, state.insights]
    .flat()
    .every((entry) => ids.has(entry.profileId));
}

routes("/api/auth/register", async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "请求方式不支持" });
  try {
    const username = normalizeUsername(req.body?.username);
    const key = usernameKey(username);
    const password = req.body?.password;
    if (!validUsername(username)) return res.status(400).json({ error: "用户名需为 3 至 20 位中文、字母、数字或下划线" });
    if (!validPassword(password)) return res.status(400).json({ error: "密码需为 8 至 72 位" });
    const id = accountId(key);
    if (await getDoc(COLLECTIONS.accounts, id)) return res.status(409).json({ error: "这个用户名已被使用" });
    const salt = crypto.randomBytes(16).toString("base64url");
    const account = {
      _id: id,
      username,
      usernameKey: key,
      passwordHash: pbkdf2(password, salt),
      passwordSalt: salt,
      passwordIterations: 100000,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const accountData = { ...account };
    delete accountData._id;
    await db.collection(COLLECTIONS.accounts).doc(id).set(accountData);
    await createSession(res, account);
    return res.status(201).json({ user: { id, username, displayName: username } });
  } catch (error) {
    console.error("register", error);
    return res.status(503).json({ error: "账号服务暂时不可用，请稍后重试" });
  }
});

routes("/api/auth/login", async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "请求方式不支持" });
  try {
    const username = normalizeUsername(req.body?.username);
    const key = usernameKey(username);
    const password = req.body?.password;
    if (!validUsername(username) || !validPassword(password)) return res.status(401).json({ error: "用户名或密码不正确" });
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
    const limitId = sha256(`${key}:${ip}`);
    const limit = await getDoc(COLLECTIONS.limits, limitId);
    if (limit && limit.lockedUntil > nowIso()) return res.status(429).json({ error: "尝试次数过多，请 15 分钟后再试" });
    const account = await getDoc(COLLECTIONS.accounts, accountId(key));
    const salt = account?.passwordSalt || "invalid-account-salt";
    const iterations = Number(account?.passwordIterations || 100000);
    const actual = pbkdf2(password, salt, iterations);
    const expected = String(account?.passwordHash || pbkdf2("invalid-password", salt, iterations));
    const matched = account && actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
    if (!matched) {
      const windowStart = limit?.windowStart && Date.now() - Date.parse(limit.windowStart) < 15 * 60000 ? limit.windowStart : nowIso();
      const failures = (limit?.windowStart === windowStart ? Number(limit.failures || 0) : 0) + 1;
      await setDoc(COLLECTIONS.limits, limitId, {
        failures,
        windowStart,
        lockedUntil: failures >= 8 ? new Date(Date.now() + 15 * 60000).toISOString() : "",
        updatedAt: nowIso(),
      });
      return res.status(401).json({ error: "用户名或密码不正确" });
    }
    await removeDoc(COLLECTIONS.limits, limitId);
    await createSession(res, account);
    return res.json({ user: { id: account._id, username: account.username, displayName: account.username } });
  } catch (error) {
    console.error("login", error);
    return res.status(503).json({ error: "账号服务暂时不可用，请稍后重试" });
  }
});

routes("/api/auth/logout", async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "请求方式不支持" });
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await removeDoc(COLLECTIONS.sessions, sha256(token));
  res.setHeader("Set-Cookie", clearCookieHeader());
  return res.json({ ok: true });
});

routes("/api/auth/session", async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "请求方式不支持" });
  const user = await sessionUser(req);
  return res.json({ user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null });
});

routes("/api/sync", async (req, res) => {
  const user = await sessionUser(req);
  if (!user) return res.status(401).json({ error: "请先登录" });
  try {
    if (req.method === "GET") {
      const doc = await getDoc(COLLECTIONS.states, user.id);
      return res.json({ state: doc?.state || null });
    }
    if (req.method === "PUT") {
      if (!validState(req.body) || !ownedState(req.body)) return res.status(400).json({ error: "数据格式不正确" });
      await setDoc(COLLECTIONS.states, user.id, { accountId: user.id, state: req.body, updatedAt: nowIso() });
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: "请求方式不支持" });
  } catch (error) {
    console.error("sync", error);
    return res.status(503).json({ error: "云端同步失败，本地记录没有丢失" });
  }
});

function fallbackInsight(value) {
  const fallback = value && typeof value === "object" ? value : {};
  return {
    summary: fallback.summary || "今天的记录已保存。继续保持相近时间称重，会更容易看清真实趋势。",
    weightReview: fallback.weightReview || "先关注相近条件下的晨重和 7 日均线，不根据单日数字判断真实增减。",
    nutritionReview: fallback.nutritionReview || "餐食热量是参考值，完整记录食物和分量更重要。",
    lifestyleReview: fallback.lifestyleReview || "睡眠、活动、饮水和盐分可能影响短期波动。",
    dataQuality: fallback.dataQuality || "晨重不足 7 次时不会生成数字预测。",
    factors: Array.isArray(fallback.factors) && fallback.factors.length ? fallback.factors.slice(0, 6) : ["水分、盐分、睡眠和进食时间会影响单日体重"],
    prediction: fallback.prediction || "积累至少 7 次晨重后再观察确定性趋势区间。",
    actions: Array.isArray(fallback.actions) && fallback.actions.length === 5 ? fallback.actions : ["明早在相近状态称重", "规律吃饭并记录分量", "按需饮水", "补充睡眠和活动信息", "优先关注 7 日均线"],
    safetyNote: fallback.safetyNote || "健康内容仅作生活方式参考，不替代专业诊断。",
  };
}

function providerEndpoint(provider, qwenBaseUrl) {
  if (provider === "deepseek") return "https://api.deepseek.com/chat/completions";
  const raw = String(qwenBaseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("千问 API Host 格式不正确");
  }
  const allowed = url.hostname === "dashscope.aliyuncs.com" || url.hostname === "dashscope-intl.aliyuncs.com" || url.hostname === "dashscope-us.aliyuncs.com" || url.hostname.endsWith(".maas.aliyuncs.com");
  if (url.protocol !== "https:" || !allowed) throw new Error("千问 API Host 必须使用阿里云官方 HTTPS 地址");
  url.search = "";
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    url.pathname = path;
    return url.toString();
  }
  if (!path.endsWith("/compatible-mode/v1")) throw new Error("千问 API Host 应以 /compatible-mode/v1 结尾");
  url.pathname = `${path}/chat/completions`;
  return url.toString();
}

function providerError(provider, status) {
  const name = provider === "deepseek" ? "DeepSeek" : "千问";
  if (status === 401 || status === 403) return `${name} API Key 无效、无权限或与所选地域不匹配`;
  if (status === 402) return `${name} API 余额不足`;
  if (status === 429) return `${name} 请求过于频繁，请稍后重试`;
  return `${name} 暂时无法完成分析（${status}）`;
}

function validInsight(value) {
  return value && typeof value === "object" && typeof value.summary === "string" && typeof value.weightReview === "string" && typeof value.nutritionReview === "string" && typeof value.lifestyleReview === "string" && typeof value.dataQuality === "string" && typeof value.prediction === "string" && typeof value.safetyNote === "string" && Array.isArray(value.factors) && value.factors.length >= 1 && value.factors.length <= 6 && value.factors.every((item) => typeof item === "string") && Array.isArray(value.actions) && value.actions.length === 5 && value.actions.every((item) => typeof item === "string");
}

async function callAi(provider, apiKey, qwenBaseUrl, input) {
  const endpoint = providerEndpoint(provider, qwenBaseUrl);
  const model = provider === "deepseek" ? process.env.DEEPSEEK_MODEL || "deepseek-v4-flash" : process.env.QWEN_MODEL || "qwen-plus";
  const special = ["infant", "child", "teen", "pregnant", "postpartum"].includes(String(input.stage));
  const prompt = [
    "你是轻衡的健康记录解释助手。只能解释输入中的确定性指标，不能创造新数字、诊断疾病或承诺结果。",
    "只返回有效 JSON，字段为 summary、weightReview、nutritionReview、lifestyleReview、dataQuality、factors、prediction、actions、safetyNote。actions 必须正好 5 条。",
    special ? "这是特殊阶段，不得提出热量限制、减脂目标或体脂判断。" : "建议关注长期习惯，不给极端热量限制。",
    JSON.stringify({ date: input.date, stage: input.stage, metrics: input.metrics, prediction: input.prediction, weights: input.todayWeights, meals: input.meals, exercises: input.exercises, context: input.context }),
  ].join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "system", content: "严格遵循要求，只返回 JSON。" }, { role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.25, max_tokens: 1800 }) });
    if (!response.ok) throw new Error(providerError(provider, response.status));
    const result = await response.json();
    const insight = JSON.parse(result?.choices?.[0]?.message?.content || "null");
    if (!validInsight(insight)) throw new Error("AI 返回内容缺少必要字段");
    return insight;
  } finally {
    clearTimeout(timeout);
  }
}

routes("/api/insights", async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "请求方式不支持" });
  const user = await sessionUser(req);
  const input = req.body || {};
  const fallback = fallbackInsight(input.fallback);
  const provider = input.provider === "deepseek" || input.provider === "qwen" ? input.provider : "rules";
  if (!input.profileId || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))) return res.status(400).json({ error: "缺少档案或日期" });
  if (provider === "rules") return res.json({ ...fallback, source: "rules", provider: "rules" });
  const apiKey = String(req.get("x-provider-api-key") || "").trim();
  if (!apiKey || apiKey.length > 512) return res.status(400).json({ error: "请填写自己的 API Key，或使用网页登录分析" });
  if (user) {
    const state = await getDoc(COLLECTIONS.states, user.id);
    if (!state?.state?.profiles?.some((profile) => profile.id === input.profileId)) return res.status(403).json({ error: "无权访问该档案" });
  }
  try {
    const result = await callAi(provider, apiKey, req.get("x-provider-base-url"), input);
    return res.json({ ...result, source: "ai", provider });
  } catch (error) {
    console.error("insights provider failed");
    return res.status(502).json({ error: error instanceof Error ? error.message : "AI 分析失败，请稍后重试" });
  }
});

routes("/api/account", async (req, res) => {
  if (req.method !== "DELETE") return res.status(405).json({ error: "请求方式不支持" });
  const user = await sessionUser(req);
  if (!user) return res.status(401).json({ error: "请先登录" });
  try {
    await Promise.all([
      removeDoc(COLLECTIONS.states, user.id),
      removeDoc(COLLECTIONS.accounts, user.id),
      removeDoc(COLLECTIONS.sessions, user.tokenHash),
    ]);
    res.setHeader("Set-Cookie", clearCookieHeader());
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: "删除没有完成，云端数据仍然保留" });
  }
});

app.get(["/api/health", "/health", "/"], (_req, res) => res.json({ ok: true, service: "轻衡云端服务", env: ENV_ID }));
app.use((_req, res) => res.status(404).json({ error: "接口不存在" }));

if (require.main === module) {
  const port = Number(process.env.PORT || 9000);
  app.listen(port, "0.0.0.0", () => console.log(`qingheng-api listening on ${port}`));
}

module.exports = { app, configureCloudbase, normalizeUsername, usernameKey, validUsername, validPassword, pbkdf2, sha256, validState, ownedState };
