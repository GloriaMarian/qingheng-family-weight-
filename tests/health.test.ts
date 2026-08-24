import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExerciseCalories,
  EXERCISE_PRESETS,
} from "../app/exercise-data.ts";
import {
  calculateBodyFatFromBmi,
  calculateBmi,
  calculateBmr,
  calculateWhoBmiZScore,
  createRuleInsight,
  dashboardMetrics,
  forecastWeight,
  greetingForHour,
  fourteenDayCycle,
  jinToKg,
  kgToJin,
  shiftLocalDate,
} from "../app/health.ts";
import type { Profile, WeightEntry } from "../app/types.ts";

const adult: Profile = {
  id: "adult",
  nickname: "测试",
  birthDate: "1996-01-01",
  sex: "female",
  heightCm: 165,
  unit: "kg",
  stage: "adult",
  activityLevel: "moderate",
  goalType: "maintain",
  timezone: "Asia/Shanghai",
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("公斤与斤可以无损往返", () => {
  assert.equal(jinToKg(120), 60);
  assert.equal(kgToJin(60), 120);
});

test("问候语根据设备小时实时分段", () => {
  assert.equal(greetingForHour(7), "早上好");
  assert.equal(greetingForHour(12), "中午好");
  assert.equal(greetingForHour(16), "下午好");
  assert.equal(greetingForHour(21), "晚上好");
});

test("日期可以跨月、跨年向前或向后切换", () => {
  assert.equal(shiftLocalDate("2026-07-31", 1), "2026-08-01");
  assert.equal(shiftLocalDate("2027-01-01", -1), "2026-12-31");
});

test("十四天轮次按建档日连续推进且可无限保存", () => {
  assert.deepEqual(fourteenDayCycle("2026-07-01", "2026-07-14"), {
    index: 0,
    number: 1,
    start: "2026-07-01",
    end: "2026-07-14",
  });
  assert.deepEqual(fourteenDayCycle("2026-07-01", "2026-07-15"), {
    index: 1,
    number: 2,
    start: "2026-07-15",
    end: "2026-07-28",
  });
  assert.equal(
    fourteenDayCycle("2026-07-01", "2027-07-01").number > 20,
    true,
  );
});

test("成人指标符合公开公式", () => {
  const adultBmi = calculateBmi(60, 165);
  assert.ok(adultBmi && Math.abs(adultBmi - 22.04) < 0.01);
  assert.ok(Math.abs(calculateBmr(60, 165, 30, "female") - 1322.05) < 0.01);
  assert.ok(Math.abs(calculateBodyFatFromBmi(22, 30, "female") - 27.9) < 0.01);
});

test("WHO 儿童 BMI 年龄别计算在分段边界可用", () => {
  const underFive = calculateWhoBmiZScore(16.2, "2023-07-30", "male", new Date("2026-07-30"));
  const schoolAge = calculateWhoBmiZScore(18.5, "2016-07-30", "female", new Date("2026-07-30"));
  assert.ok(underFive !== null && Number.isFinite(underFive));
  assert.ok(schoolAge !== null && Number.isFinite(schoolAge));
});

test("少于七次晨重不预测，七次后给出区间", () => {
  const entries: WeightEntry[] = Array.from({ length: 7 }, (_, index) => ({
    id: String(index),
    profileId: "adult",
    localDate: `2026-07-${String(20 + index).padStart(2, "0")}`,
    measuredAt: `2026-07-${String(20 + index).padStart(2, "0")}T07:00:00+08:00`,
    period: "morning",
    weightKg: 65 - index * 0.1,
  }));
  assert.equal(forecastWeight(entries.slice(0, 6), "adult"), null);
  const result = forecastWeight(entries, "adult");
  assert.ok(result);
  assert.ok(result!.lowKg <= result!.highKg);
});

test("特殊阶段不显示成人体脂和消耗目标", () => {
  const child = { ...adult, id: "child", stage: "child" as const, birthDate: "2016-01-01" };
  const weights: WeightEntry[] = [{
    id: "w",
    profileId: child.id,
    localDate: "2026-07-30",
    measuredAt: "2026-07-30T07:00:00+08:00",
    period: "morning",
    weightKg: 34,
  }];
  const metrics = dashboardMetrics(child, weights, [], "2026-07-30");
  assert.equal(metrics.bodyFat, null);
  assert.equal(metrics.tdee, null);
  assert.ok(metrics.pediatricZScore !== null);
});

test("本地日报提供完整栏目和五条可执行建议", () => {
  const insight = createRuleInsight(adult, [], [], "2026-07-30", {
    id: "context",
    profileId: adult.id,
    localDate: "2026-07-30",
    sleepHours: 7.5,
    exerciseMinutes: 30,
    waterMl: 1600,
    tags: [],
  });
  assert.equal(insight.actions.length, 5);
  assert.match(insight.weightReview, /体重/);
  assert.match(insight.nutritionReview, /餐食/);
  assert.match(insight.lifestyleReview, /睡眠/);
  assert.match(insight.dataQuality, /3 类关键记录/);
});

test("成人运动消耗按体重、MET 与时长计算", () => {
  const strength = EXERCISE_PRESETS.find((item) => item.id === "strength")!;
  const result = calculateExerciseCalories(adult, 60, strength, 30);
  assert.ok(result);
  assert.equal(result!.standard, "adult_met");
  assert.equal(result!.calories, 110.3);
});

test("儿童运动消耗使用年龄与性别相关的 METy 公式", () => {
  const child = {
    ...adult,
    id: "child-exercise",
    birthDate: "2014-07-30",
    sex: "male" as const,
    stage: "child" as const,
  };
  const rope = EXERCISE_PRESETS.find((item) => item.id === "rope")!;
  const result = calculateExerciseCalories(child, 40, rope, 20);
  assert.ok(result);
  assert.equal(result!.standard, "youth_mety");
  assert.equal(result!.metValue, 6);
});

test("六岁以下不生成运动热量估算", () => {
  const infant = {
    ...adult,
    id: "infant-exercise",
    birthDate: "2023-01-01",
    stage: "infant" as const,
  };
  assert.equal(
    calculateExerciseCalories(infant, 15, EXERCISE_PRESETS[0], 20),
    null,
  );
});

test("每日能量差合并摄入、基础日常与运动消耗", () => {
  const weights: WeightEntry[] = [{
    id: "energy-weight",
    profileId: adult.id,
    localDate: "2026-07-30",
    measuredAt: "2026-07-30T07:00:00+08:00",
    period: "morning",
    weightKg: 60,
  }];
  const meals = [{
    id: "energy-meal",
    profileId: adult.id,
    localDate: "2026-07-30",
    eatenAt: "2026-07-30T12:00:00+08:00",
    mealType: "lunch" as const,
    foodName: "测试餐",
    grams: 100,
    kcalPer100g: 2000,
    calories: 2000,
    source: "custom" as const,
  }];
  const exercises = [{
    id: "energy-exercise",
    profileId: adult.id,
    localDate: "2026-07-30",
    performedAt: "2026-07-30T18:00:00+08:00",
    presetId: "strength",
    activityName: "力量训练",
    minutes: 30,
    metValue: 3.5,
    calories: 110.3,
    weightKg: 60,
    standard: "adult_met" as const,
  }];
  const metrics = dashboardMetrics(adult, weights, meals, "2026-07-30", exercises);
  assert.equal(metrics.exerciseCaloriesToday, 110.3);
  assert.ok(metrics.energyBalance !== null);
  assert.equal(
    Math.round(metrics.energyBalance!),
    Math.round(2000 - (metrics.bmr! * 1.2 + 110.3)),
  );
});

test("BMI 基础代谢与体脂率使用当天早晚平均体重", () => {
  const weights: WeightEntry[] = [
    {
      id: "daily-morning",
      profileId: adult.id,
      localDate: "2026-07-30",
      measuredAt: "2026-07-30T07:00:00+08:00",
      period: "morning",
      weightKg: 60,
    },
    {
      id: "daily-evening",
      profileId: adult.id,
      localDate: "2026-07-30",
      measuredAt: "2026-07-30T21:00:00+08:00",
      period: "evening",
      weightKg: 62,
    },
  ];
  const metrics = dashboardMetrics(adult, weights, [], "2026-07-30");
  assert.equal(metrics.dailyAverageWeightKg, 61);
  assert.equal(metrics.dailyWeightCount, 2);
  assert.equal(metrics.bmi, calculateBmi(61, adult.heightCm));
  assert.equal(
    metrics.bmr,
    calculateBmr(61, adult.heightCm, 30, adult.sex),
  );

  const changed = dashboardMetrics(
    adult,
    [{ ...weights[1], weightKg: 64 }, weights[0]],
    [],
    "2026-07-30",
  );
  assert.equal(changed.dailyAverageWeightKg, 62);
  assert.notEqual(changed.bmi, metrics.bmi);
  assert.notEqual(changed.bmr, metrics.bmr);
  assert.notEqual(changed.bodyFat, metrics.bodyFat);
});
