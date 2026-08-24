import { env } from "cloudflare:workers";
import { getLocalUser, ownerKey } from "../../auth";
import type { AiProvider, DailyInsight, LifeStage } from "../../types";

export const runtime = "edge";

type InsightContent = Pick<
  DailyInsight,
  | "summary"
  | "weightReview"
  | "nutritionReview"
  | "lifestyleReview"
  | "dataQuality"
  | "factors"
  | "prediction"
  | "actions"
  | "safetyNote"
>;

const SPECIAL_STAGES = new Set<LifeStage>([
  "infant",
  "child",
  "teen",
  "pregnant",
  "postpartum",
]);

function isInsight(value: unknown): value is InsightContent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<InsightContent>;
  return (
    typeof item.summary === "string" &&
    typeof item.weightReview === "string" &&
    typeof item.nutritionReview === "string" &&
    typeof item.lifestyleReview === "string" &&
    typeof item.dataQuality === "string" &&
    typeof item.prediction === "string" &&
    typeof item.safetyNote === "string" &&
    Array.isArray(item.factors) &&
    item.factors.length >= 1 &&
    item.factors.length <= 6 &&
    item.factors.every((factor) => typeof factor === "string") &&
    Array.isArray(item.actions) &&
    item.actions.length === 5 &&
    item.actions.every((action) => typeof action === "string")
  );
}

function cleanFallback(value: unknown): InsightContent {
  if (isInsight(value)) return value;
  return {
    summary: "今天的记录已保存。继续保持相近时间称重，会更容易看清真实趋势。",
    weightReview: "体重记录不足时，应先积累相近条件下的晨重，不根据单日数字判断真实增减。",
    nutritionReview: "餐食热量是参考值；完整记录食物、分量与用餐时间比追求单个精确数字更重要。",
    lifestyleReview: "睡眠、活动、饮水和高盐饮食等因素可能影响短期波动，但不能单独证明因果。",
    dataQuality: "晨重不足 7 次时不会生成数字预测，继续记录后再观察趋势区间。",
    factors: ["单日变化可能来自水分、盐分、睡眠和进食时间"],
    prediction: "记录不足时不生成数字预测；积累至少 7 次晨重后再观察区间。",
    actions: [
      "明早在相近状态称重",
      "规律吃饭并记录大致分量",
      "按需饮水",
      "补充睡眠和活动信息",
      "优先关注 7 日均线",
    ],
    safetyNote: "健康内容仅作生活方式参考，不替代专业诊断。",
  };
}

function withFallbackNotice(
  fallback: InsightContent,
  provider: Exclude<AiProvider, "rules">,
) {
  const name = provider === "deepseek" ? "DeepSeek" : "通义千问";
  return {
    ...fallback,
    source: "rules" as const,
    provider: "rules" as const,
    summary: `${fallback.summary}（${name} 暂不可用，已自动使用本地分析。）`,
  };
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

function buildPrompt(aggregateInput: Record<string, unknown>, special: boolean) {
  return [
    "你是轻衡的健康记录解释助手。只能解释下方输入中的确定性指标和预测，不能创造新数字、诊断疾病、羞辱用户或承诺结果。",
    "请用温和、具体、易懂的中文返回一个 JSON 对象，不要使用 Markdown，不要添加 JSON 之外的文字。",
    "JSON 必须包含：summary（总体总结）、weightReview（体重趋势解读）、nutritionReview（餐食与热量解读）、lifestyleReview（睡眠活动饮水解读）、dataQuality（记录完整度与局限）、factors（1至6条可能因素）、prediction（只能复述输入中的确定性预测，无预测时明确记录不足）、actions（正好5条可执行建议）、safetyNote（安全提醒）。",
    special
      ? "这是儿童、青少年、孕期或产后等特殊阶段：不得提出热量限制、减脂目标或体脂判断，建议由监护人或专业人员确认。"
      : "建议应关注长期习惯与趋势，不给极端热量限制。",
    `数据：${JSON.stringify(aggregateInput)}`,
  ].join("\n");
}

function extractChatText(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const response = value as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return response.choices?.[0]?.message?.content ?? null;
}

async function callProvider({
  apiKey,
  endpoint,
  model,
  prompt,
  signal,
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
}) {
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "严格遵循用户要求，仅返回有效 JSON。" },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.25,
      max_tokens: 1600,
    }),
  });
  if (!response.ok) throw new Error(`provider ${response.status}`);
  const raw = (await response.json()) as unknown;
  const text = extractChatText(raw);
  if (!text) throw new Error("empty provider response");
  const result = JSON.parse(text) as unknown;
  if (!isInsight(result)) throw new Error("invalid provider response");
  return result;
}

export async function POST(request: Request) {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 80_000) {
    return Response.json({ error: "请求过大" }, { status: 413 });
  }

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "数据格式不正确" }, { status: 400 });
  }

  const fallback = cleanFallback(input.fallback);
  const profileId = typeof input.profileId === "string" ? input.profileId : "";
  const date = typeof input.date === "string" ? input.date : "";
  const stage = String(input.stage ?? "") as LifeStage;
  const provider: AiProvider =
    input.provider === "deepseek" || input.provider === "qwen"
      ? input.provider
      : "rules";
  if (!profileId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "缺少档案或日期" }, { status: 400 });
  }
  if (provider === "rules") {
    return Response.json({ ...fallback, source: "rules", provider: "rules" });
  }

  const runtimeEnv = env as unknown as {
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_MODEL?: string;
    DASHSCOPE_API_KEY?: string;
    QWEN_MODEL?: string;
    DB?: D1Database;
  };
  const apiKey =
    provider === "deepseek"
      ? runtimeEnv.DEEPSEEK_API_KEY
      : runtimeEnv.DASHSCOPE_API_KEY;
  if (!apiKey) return Response.json(withFallbackNotice(fallback, provider));

  const owner = ownerKey(user);
  if (runtimeEnv.DB) {
    const owned = await runtimeEnv.DB.prepare(
      "SELECT 1 FROM profiles WHERE id = ? AND owner_email = ? LIMIT 1",
    )
      .bind(profileId, owner)
      .first();
    if (!owned) return Response.json({ error: "无权访问该档案" }, { status: 403 });
    const count = await runtimeEnv.DB.prepare(
      "SELECT COUNT(*) AS total FROM ai_insights WHERE owner_email = ? AND profile_id = ? AND local_date = ? AND source = 'ai'",
    )
      .bind(owner, profileId, date)
      .first<{ total: number }>();
    if (Number(count?.total ?? 0) >= 2) {
      return Response.json(
        { error: "今日在线 AI 分析次数已用完", fallback: { ...fallback, source: "rules", provider: "rules" } },
        { status: 429 },
      );
    }
  }

  const aggregateInput = {
    date,
    stage,
    metrics: input.metrics,
    deterministicPrediction: input.prediction,
    weights: input.todayWeights,
    meals: input.meals,
    exercises: input.exercises,
    context: input.context,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const result = await callProvider({
      apiKey,
      endpoint:
        provider === "deepseek"
          ? "https://api.deepseek.com/chat/completions"
          : "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      model:
        provider === "deepseek"
          ? runtimeEnv.DEEPSEEK_MODEL || "deepseek-chat"
          : runtimeEnv.QWEN_MODEL || "qwen-plus",
      prompt: buildPrompt(aggregateInput, SPECIAL_STAGES.has(stage)),
      signal: controller.signal,
    });

    if (runtimeEnv.DB) {
      const record: DailyInsight = {
        id: crypto.randomUUID(),
        profileId,
        localDate: date,
        source: "ai",
        provider,
        createdAt: new Date().toISOString(),
        ...result,
      };
      await runtimeEnv.DB.prepare(
        "INSERT INTO ai_insights (id, owner_email, profile_id, local_date, input_hash, result_json, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ai', ?, CURRENT_TIMESTAMP)",
      )
        .bind(
          record.id,
          owner,
          profileId,
          date,
          await digest(JSON.stringify(aggregateInput)),
          JSON.stringify(record),
          record.createdAt,
        )
        .run();
    }
    return Response.json({ ...result, source: "ai", provider });
  } catch {
    return Response.json(withFallbackNotice(fallback, provider));
  } finally {
    clearTimeout(timeout);
  }
}
