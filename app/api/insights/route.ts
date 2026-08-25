import { env } from "cloudflare:workers";
import {
  buildInsightPrompt,
  isInsightContent,
  providerErrorMessage,
  resolveProviderEndpoint,
  type InsightContent,
  type OnlineAiProvider,
} from "../../ai-insight";
import { getLocalUser, ownerKey } from "../../auth";
import type { AiProvider, DailyInsight, LifeStage } from "../../types";

export const runtime = "edge";

const SPECIAL_STAGES = new Set<LifeStage>([
  "infant",
  "child",
  "teen",
  "pregnant",
  "postpartum",
]);

function cleanFallback(value: unknown): InsightContent {
  if (isInsightContent(value)) return value;
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

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
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
  provider,
  signal,
}: {
  apiKey: string;
  endpoint: string;
  model: string;
  prompt: string;
  provider: OnlineAiProvider;
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
  if (!response.ok) {
    throw new Error(providerErrorMessage(provider, response.status));
  }
  const raw = (await response.json()) as unknown;
  const text = extractChatText(raw);
  if (!text) throw new Error("empty provider response");
  const result = JSON.parse(text) as unknown;
  if (!isInsightContent(result)) throw new Error("AI 返回内容缺少必要字段");
  return result;
}

export async function POST(request: Request) {
  const user = await getLocalUser();
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

  const onlineProvider = provider as OnlineAiProvider;
  const apiKey = request.headers.get("x-provider-api-key")?.trim() ?? "";
  if (!apiKey || apiKey.length > 512) {
    return Response.json(
      { error: "请填写自己的 API Key，或使用网页登录分析" },
      { status: 400 },
    );
  }
  let endpoint: string;
  try {
    endpoint = resolveProviderEndpoint(
      onlineProvider,
      request.headers.get("x-provider-base-url") ?? undefined,
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 服务地址不正确" },
      { status: 400 },
    );
  }

  const runtimeEnv = env as unknown as {
    DEEPSEEK_MODEL?: string;
    QWEN_MODEL?: string;
    DB?: D1Database;
  };

  const owner = user ? ownerKey(user) : null;
  if (runtimeEnv.DB && owner) {
    const owned = await runtimeEnv.DB.prepare(
      "SELECT 1 FROM profiles WHERE id = ? AND owner_email = ? LIMIT 1",
    )
      .bind(profileId, owner)
      .first();
    if (!owned) return Response.json({ error: "无权访问该档案" }, { status: 403 });
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
      endpoint,
      model:
        provider === "deepseek"
          ? runtimeEnv.DEEPSEEK_MODEL || "deepseek-v4-flash"
          : runtimeEnv.QWEN_MODEL || "qwen-plus",
      prompt: buildInsightPrompt(aggregateInput, SPECIAL_STAGES.has(stage)),
      provider: onlineProvider,
      signal: controller.signal,
    });

    if (runtimeEnv.DB && owner) {
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI 分析失败，请稍后重试";
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
