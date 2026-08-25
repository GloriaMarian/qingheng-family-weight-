import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInsightPrompt,
  parseInsightResponse,
  providerErrorMessage,
  resolveProviderEndpoint,
} from "../app/ai-insight.ts";

const completeInsight = {
  summary: "记录完整度正在提高。",
  weightReview: "优先观察连续晨重。",
  nutritionReview: "今天已记录三餐。",
  lifestyleReview: "睡眠和活动信息已记录。",
  dataQuality: "目前有足够的当天记录。",
  factors: ["睡眠与盐分可能影响短期波动"],
  prediction: "继续观察七日趋势。",
  actions: ["记录晨重", "记录三餐", "按需饮水", "规律睡眠", "观察趋势"],
  safetyNote: "仅作生活方式参考。",
};

test("AI prompt includes the structured contract and supplied daily data", () => {
  const prompt = buildInsightPrompt({ date: "2026-08-25", weight: 62.1 }, false);
  assert.match(prompt, /只能解释/);
  assert.match(prompt, /actions（正好5条/);
  assert.match(prompt, /"date":"2026-08-25"/);
  assert.match(prompt, /不诊断|诊断疾病/);
});

test("AI response parser accepts fenced JSON and rejects incomplete results", () => {
  assert.deepEqual(
    parseInsightResponse(`\n\`\`\`json\n${JSON.stringify(completeInsight)}\n\`\`\``),
    completeInsight,
  );
  assert.equal(
    parseInsightResponse(JSON.stringify({ ...completeInsight, actions: ["只有一条"] })),
    null,
  );
});

test("provider endpoints stay on official provider hosts", () => {
  assert.equal(
    resolveProviderEndpoint("deepseek"),
    "https://api.deepseek.com/chat/completions",
  );
  assert.equal(
    resolveProviderEndpoint(
      "qwen",
      "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
    ),
    "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
  );
  assert.throws(
    () => resolveProviderEndpoint("qwen", "https://example.com/compatible-mode/v1"),
    /阿里云官方/,
  );
});

test("provider errors explain credential failures", () => {
  assert.match(providerErrorMessage("deepseek", 401), /API Key 无效/);
  assert.match(providerErrorMessage("qwen", 429), /稍后重试/);
});
