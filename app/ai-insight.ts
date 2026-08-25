import type { AiProvider, DailyInsight } from "./types";

export type OnlineAiProvider = Exclude<AiProvider, "rules">;

export type InsightContent = Pick<
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

const DEFAULT_QWEN_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

export function isInsightContent(value: unknown): value is InsightContent {
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

export function buildInsightPrompt(
  aggregateInput: Record<string, unknown>,
  specialStage: boolean,
) {
  return [
    "你是轻衡的健康记录解释助手。只能解释下方输入中的确定性指标和预测，不能创造新数字、诊断疾病、羞辱用户或承诺结果。",
    "请用温和、具体、易懂的中文返回一个 JSON 对象，不要使用 Markdown，不要添加 JSON 之外的文字。",
    "JSON 必须包含：summary（总体总结）、weightReview（体重趋势解读）、nutritionReview（餐食与热量解读）、lifestyleReview（睡眠活动饮水解读）、dataQuality（记录完整度与局限）、factors（1至6条可能因素）、prediction（只能复述输入中的确定性预测，无预测时明确记录不足）、actions（正好5条可执行建议）、safetyNote（安全提醒）。",
    specialStage
      ? "这是儿童、青少年、孕期或产后等特殊阶段：不得提出热量限制、减脂目标或体脂判断，建议由监护人或专业人员确认。"
      : "建议应关注长期习惯与趋势，不给极端热量限制。",
    `数据：${JSON.stringify(aggregateInput)}`,
  ].join("\n");
}

export function parseInsightResponse(value: string): InsightContent | null {
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    const parsed = JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1)) as unknown;
    return isInsightContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAllowedQwenHost(hostname: string) {
  return (
    hostname === "dashscope.aliyuncs.com" ||
    hostname === "dashscope-intl.aliyuncs.com" ||
    hostname === "dashscope-us.aliyuncs.com" ||
    hostname.endsWith(".maas.aliyuncs.com")
  );
}

export function resolveProviderEndpoint(
  provider: OnlineAiProvider,
  qwenBaseUrl?: string,
) {
  if (provider === "deepseek") {
    return "https://api.deepseek.com/chat/completions";
  }

  const raw = qwenBaseUrl?.trim() || DEFAULT_QWEN_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("千问 API Host 格式不正确");
  }
  if (url.protocol !== "https:" || !isAllowedQwenHost(url.hostname)) {
    throw new Error("千问 API Host 必须使用阿里云官方 HTTPS 地址");
  }
  url.search = "";
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    url.pathname = path;
    return url.toString();
  }
  if (!path.endsWith("/compatible-mode/v1")) {
    throw new Error("千问 API Host 应以 /compatible-mode/v1 结尾");
  }
  url.pathname = `${path}/chat/completions`;
  return url.toString();
}

export function providerErrorMessage(
  provider: OnlineAiProvider,
  status: number,
) {
  const name = provider === "deepseek" ? "DeepSeek" : "千问";
  if (status === 401 || status === 403) {
    return `${name} API Key 无效、无权限或与所选地域不匹配`;
  }
  if (status === 402) return `${name} API 余额不足`;
  if (status === 429) return `${name} 请求过于频繁，请稍后重试`;
  return `${name} 暂时无法完成分析（${status}）`;
}
