import type {
  ActivityLevel,
  DailyContext,
  DashboardMetrics,
  ExerciseEntry,
  MealEntry,
  Profile,
  Sex,
  WeightEntry,
} from "./types.ts";
import {
  type WhoLmsPoint,
  whoBmiBoys5To19,
  whoBmiBoysUnder5,
  whoBmiGirls5To19,
  whoBmiGirlsUnder5,
} from "./who-data.ts";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

export function kgToJin(value: number) {
  return value * 2;
}

export function jinToKg(value: number) {
  return value / 2;
}

export function calculateAge(birthDate: string, at = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = at.getFullYear() - birth.getFullYear();
  const monthDelta = at.getMonth() - birth.getMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && at.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function calculateAgeDays(birthDate: string, at = new Date()) {
  const start = new Date(`${birthDate}T00:00:00Z`).getTime();
  const end = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function calculateAgeMonths(birthDate: string, at = new Date()) {
  const birth = new Date(`${birthDate}T00:00:00`);
  let months =
    (at.getFullYear() - birth.getFullYear()) * 12 +
    at.getMonth() -
    birth.getMonth();
  if (at.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) return null;
  return weightKg / (heightCm / 100) ** 2;
}

export function calculateBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
) {
  const base = 9.99 * weightKg + 6.25 * heightCm - 4.92 * age;
  return base + (sex === "male" ? 5 : -161);
}

export function calculateBodyFatFromBmi(
  bmi: number,
  age: number,
  sex: Sex,
) {
  return 1.2 * bmi + 0.23 * age - (sex === "male" ? 10.8 : 0) - 5.4;
}

export function calculateTdee(bmr: number, activityLevel: ActivityLevel) {
  return bmr * ACTIVITY_FACTOR[activityLevel];
}

function interpolateWhoPoint(points: WhoLmsPoint[], index: number) {
  if (index <= points[0][0]) return points[0];
  const last = points[points.length - 1];
  if (index >= last[0]) return last;

  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle][0] <= index) low = middle;
    else high = middle;
  }
  const left = points[low];
  const right = points[high];
  const ratio = (index - left[0]) / (right[0] - left[0]);
  return [
    index,
    left[1] + (right[1] - left[1]) * ratio,
    left[2] + (right[2] - left[2]) * ratio,
    left[3] + (right[3] - left[3]) * ratio,
  ] as WhoLmsPoint;
}

export function calculateWhoBmiZScore(
  bmi: number,
  birthDate: string,
  sex: Sex,
  at = new Date(),
) {
  const ageDays = calculateAgeDays(birthDate, at);
  const ageMonths = calculateAgeMonths(birthDate, at);
  const underFive = ageDays <= 1856;
  const points = underFive
    ? sex === "male"
      ? whoBmiBoysUnder5
      : whoBmiGirlsUnder5
    : sex === "male"
      ? whoBmiBoys5To19
      : whoBmiGirls5To19;
  const index = underFive ? ageDays : Math.min(228, Math.max(61, ageMonths));
  const [, lValue, median, sValue] = interpolateWhoPoint(points, index);
  if (Math.abs(lValue) < 0.00001) {
    return Math.log(bmi / median) / sValue;
  }
  return ((bmi / median) ** lValue - 1) / (lValue * sValue);
}

export function describeWhoZScore(zScore: number) {
  if (zScore < -3) return "严重偏瘦参考区";
  if (zScore < -2) return "偏瘦参考区";
  if (zScore <= 1) return "年龄别参考范围";
  if (zScore <= 2) return "偏高参考区";
  return "明显偏高参考区";
}

export function pregnancyWeightRange(profile: Profile) {
  if (
    profile.stage !== "pregnant" ||
    !profile.prepregnancyWeightKg ||
    !profile.dueDate
  ) {
    return null;
  }
  const preBmi = calculateBmi(
    profile.prepregnancyWeightKg,
    profile.heightCm,
  );
  if (!preBmi) return null;
  const due = new Date(`${profile.dueDate}T00:00:00`).getTime();
  const conception = due - 280 * 86_400_000;
  const week = Math.max(
    0,
    Math.min(40, (Date.now() - conception) / (7 * 86_400_000)),
  );
  const twins = profile.fetusCount === 2;
  let total: [number, number];
  if (twins) {
    total =
      preBmi < 18.5
        ? [22.7, 28.1]
        : preBmi < 25
          ? [16.8, 24.5]
          : preBmi < 30
            ? [14.1, 22.7]
            : [11.3, 19.1];
  } else {
    total =
      preBmi < 18.5
        ? [12.7, 18.1]
        : preBmi < 25
          ? [11.3, 15.9]
          : preBmi < 30
            ? [6.8, 11.3]
            : [5, 9.1];
  }
  const progress = Math.max(0, (week - 12) / 28);
  const firstTrimester = Math.min(week / 12, 1) * 1.5;
  return [
    Number((firstTrimester + total[0] * progress * 0.85).toFixed(1)),
    Number((firstTrimester + total[1] * progress * 0.85).toFixed(1)),
  ] as [number, number];
}

export function localDate(timezone = "Asia/Shanghai", at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function shiftLocalDate(date: string, offsetDays: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

export function daysBetweenLocalDates(start: string, end: string) {
  const startTime = Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10)),
  );
  const endTime = Date.UTC(
    Number(end.slice(0, 4)),
    Number(end.slice(5, 7)) - 1,
    Number(end.slice(8, 10)),
  );
  return Math.round((endTime - startTime) / 86_400_000);
}

export function fourteenDayCycle(originDate: string, anchorDate: string) {
  const elapsed = Math.max(0, daysBetweenLocalDates(originDate, anchorDate));
  const index = Math.floor(elapsed / 14);
  const start = shiftLocalDate(originDate, index * 14);
  return {
    index,
    number: index + 1,
    start,
    end: shiftLocalDate(start, 13),
  };
}

export function greetingForHour(hour: number) {
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function rollingAverage(values: number[], windowSize = 7) {
  if (!values.length) return [];
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const subset = values.slice(start, index + 1);
    return subset.reduce((sum, value) => sum + value, 0) / subset.length;
  });
}

export function forecastWeight(weights: WeightEntry[], profileId: string) {
  const morning = weights
    .filter((entry) => entry.profileId === profileId && entry.period === "morning")
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  if (morning.length < 7) return null;

  const recent = morning.slice(-30);
  const smoothed = rollingAverage(
    recent.map((entry) => entry.weightKg),
    7,
  );
  const start = Math.max(0, smoothed.length - 14);
  const sample = smoothed.slice(start);
  const n = sample.length;
  const meanX = (n - 1) / 2;
  const meanY = sample.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  sample.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const safeSlope = Math.max(-0.15, Math.min(0.15, slope));
  const base = sample[n - 1];
  const predicted = base + safeSlope * 7;
  const residuals = sample.map(
    (value, index) => value - (meanY + safeSlope * (index - meanX)),
  );
  const deviation = Math.max(
    0.15,
    Math.sqrt(
      residuals.reduce((sum, value) => sum + value ** 2, 0) /
        Math.max(1, n - 1),
    ),
  );
  return {
    predictedKg: Number(predicted.toFixed(1)),
    lowKg: Number((predicted - deviation * 1.5).toFixed(1)),
    highKg: Number((predicted + deviation * 1.5).toFixed(1)),
    weeklyChangeKg: Number((safeSlope * 7).toFixed(2)),
    confidence: morning.length >= 21 ? "较稳定" : "初步",
  };
}

export function dashboardMetrics(
  profile: Profile,
  weights: WeightEntry[],
  meals: MealEntry[],
  date: string,
  exercises: ExerciseEntry[] = [],
): DashboardMetrics {
  const profileWeights = weights
    .filter((entry) => entry.profileId === profile.id)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest =
    profileWeights.filter((entry) => entry.localDate <= date).at(-1)?.weightKg ??
    null;
  const dailyWeights = profileWeights.filter(
    (entry) => entry.localDate === date,
  );
  const dailyAverageWeightKg = dailyWeights.length
    ? dailyWeights.reduce((sum, entry) => sum + entry.weightKg, 0) /
      dailyWeights.length
    : null;
  const bmi = dailyAverageWeightKg
    ? calculateBmi(dailyAverageWeightKg, profile.heightCm)
    : null;
  const metricDate = new Date(`${date}T12:00:00`);
  const age = calculateAge(profile.birthDate, metricDate);
  const isStandardAdult =
    age >= 18 &&
    !["pregnant", "postpartum", "infant", "child", "teen"].includes(
      profile.stage,
    );
  const bmr =
    dailyAverageWeightKg && isStandardAdult
      ? calculateBmr(
          dailyAverageWeightKg,
          profile.heightCm,
          age,
          profile.sex,
        )
      : null;
  const sevenDayValues = Array.from({ length: 7 }, (_, index) =>
    shiftLocalDate(date, -index),
  )
    .map((day) => {
      const dayWeights = profileWeights.filter(
        (entry) => entry.localDate === day,
      );
      return dayWeights.length
        ? dayWeights.reduce((sum, entry) => sum + entry.weightKg, 0) /
            dayWeights.length
        : null;
    })
    .filter((value): value is number => value !== null);
  const pediatricZScore =
    dailyAverageWeightKg && bmi && age < 18
      ? calculateWhoBmiZScore(bmi, profile.birthDate, profile.sex, metricDate)
      : null;
  const caloriesToday = meals
    .filter(
      (entry) => entry.profileId === profile.id && entry.localDate === date,
    )
    .reduce((sum, entry) => sum + entry.calories, 0);
  const exerciseCaloriesToday = exercises
    .filter(
      (entry) => entry.profileId === profile.id && entry.localDate === date,
    )
    .reduce((sum, entry) => sum + entry.calories, 0);
  const estimatedDailyBurn = bmr
    ? bmr * 1.2 + exerciseCaloriesToday
    : null;
  return {
    latestWeightKg: latest,
    dailyAverageWeightKg,
    dailyWeightCount: dailyWeights.length,
    bmi,
    bmr,
    tdee: bmr ? calculateTdee(bmr, profile.activityLevel) : null,
    bodyFat:
      bmi && isStandardAdult
        ? calculateBodyFatFromBmi(bmi, age, profile.sex)
        : null,
    pediatricZScore,
    pregnancyRangeKg: pregnancyWeightRange(profile),
    caloriesToday,
    exerciseCaloriesToday,
    estimatedDailyBurn,
    energyBalance:
      estimatedDailyBurn !== null && caloriesToday > 0
        ? caloriesToday - estimatedDailyBurn
        : null,
    sevenDayAverageKg: sevenDayValues.length
      ? sevenDayValues.reduce((sum, value) => sum + value, 0) /
        sevenDayValues.length
      : null,
  };
}

export function createRuleInsight(
  profile: Profile,
  weights: WeightEntry[],
  meals: MealEntry[],
  date: string,
  context?: DailyContext,
  exercises: ExerciseEntry[] = [],
) {
  const metrics = dashboardMetrics(profile, weights, meals, date, exercises);
  const prediction = forecastWeight(weights, profile.id);
  const todaysWeights = weights.filter(
    (entry) => entry.profileId === profile.id && entry.localDate === date,
  );
  const factors: string[] = [];
  if (todaysWeights.length === 2) {
    const morning = todaysWeights.find((entry) => entry.period === "morning");
    const evening = todaysWeights.find((entry) => entry.period === "evening");
    if (morning && evening) {
      factors.push(
        `晚间比晨间${evening.weightKg >= morning.weightKg ? "高" : "低"} ${Math.abs(
          evening.weightKg - morning.weightKg,
        ).toFixed(1)} kg，日内水分和进食会造成自然波动。`,
      );
    }
  }
  if (metrics.caloriesToday > 0) {
    factors.push(`今日已记录 ${Math.round(metrics.caloriesToday)} 千卡。`);
  }
  if (metrics.exerciseCaloriesToday > 0) {
    factors.push(`已记录运动消耗约 ${Math.round(metrics.exerciseCaloriesToday)} 千卡。`);
  }
  if (!factors.length) {
    factors.push("今天的记录还不完整，补齐早晚体重和餐食后分析会更具体。");
  }
  const special = ["infant", "child", "teen", "pregnant", "postpartum"].includes(
    profile.stage,
  );
  const mealCount = meals.filter(
    (entry) => entry.profileId === profile.id && entry.localDate === date,
  ).length;
  const coreMeals = new Set(
    meals
      .filter(
        (entry) => entry.profileId === profile.id && entry.localDate === date,
      )
      .map((entry) => entry.mealType),
  );
  const coreMealsComplete = ["breakfast", "lunch", "dinner"].every((type) =>
    coreMeals.has(type as MealEntry["mealType"]),
  );
  const weightReview = todaysWeights.length
    ? `今天已记录 ${todaysWeights.length} 次体重。单日数字容易受水分、进食时间和称重条件影响，建议优先比较相近条件下的晨重与 7 日均线。`
    : "今天还没有体重记录。补充晨重或晚重后，才能把当天波动放进近期趋势中理解。";
  const nutritionReview = mealCount
    ? `今天记录了 ${mealCount} 条食物，共约 ${Math.round(metrics.caloriesToday)} 千卡。${
        metrics.energyBalance === null || !coreMealsComplete
          ? ""
          : `按基础与日常消耗加已记录运动估算，今天约为${metrics.energyBalance > 100 ? `盈余 ${Math.round(metrics.energyBalance)}` : metrics.energyBalance < -100 ? `缺口 ${Math.abs(Math.round(metrics.energyBalance))}` : "接近平衡"}千卡。`
      }热量为参考值，完整记录和食物结构比追求单个精确数字更重要。`
    : "今天还没有餐食记录。补充三餐、加餐和大致分量后，日报才能更好地解释体重波动。";
  const lifestyleParts = [
    context?.sleepHours != null ? `睡眠 ${context.sleepHours} 小时` : null,
    exercises.length
      ? `运动 ${exercises.reduce((sum, item) => sum + item.minutes, 0)} 分钟，约 ${Math.round(metrics.exerciseCaloriesToday)} 千卡`
      : context?.exerciseMinutes != null
        ? `运动 ${context.exerciseMinutes} 分钟`
        : null,
    context?.waterMl != null ? `饮水 ${context.waterMl} ml` : null,
    ...(context?.tags ?? []),
  ].filter(Boolean);
  const completeness =
    (todaysWeights.length ? 1 : 0) +
    (mealCount ? 1 : 0) +
    (lifestyleParts.length ? 1 : 0);
  return {
    summary: special
      ? "今天以规律记录和观察趋势为主，不根据单日数字做减重判断。"
      : prediction
        ? `近期开启了${prediction.confidence}趋势观察，单日波动不代表真实增减。`
        : "继续积累晨间记录；满 7 天后会开始展示短期趋势区间。",
    factors,
    prediction: prediction
      ? `按当前趋势，7 天后约 ${prediction.lowKg}–${prediction.highKg} kg。`
      : "晨间记录不足 7 次，暂不生成预测。",
    weightReview,
    nutritionReview,
    lifestyleReview: lifestyleParts.length
      ? `已记录：${lifestyleParts.join("、")}。这些信息可用于解释短期水分和作息相关波动，但不能单独证明因果。`
      : "睡眠、运动、饮水和高盐饮食等信息尚未填写；补充后能让趋势解释更有依据。",
    dataQuality: `今天已完成 ${completeness}/3 类关键记录（体重、餐食、生活方式）。${
      prediction ? "晨重数量已达到趋势预测门槛。" : "晨重不足 7 次时不会生成数字预测。"
    }`,
    actions: special
      ? ["按相近时间记录体重", "保持正常饮食与作息", "补充睡眠和活动信息", "关注连续变化而非单次数字", "异常变化及时咨询专业人员"]
      : ["明早在相近时段和状态下称重", "继续完整记录三餐与大致分量", "补充睡眠、运动和饮水记录", "优先关注 7 日均线而非单日波动", "如出现持续不适或异常变化请咨询专业人员"],
    safetyNote:
      "内容仅用于健康记录与生活方式参考，不替代医生、营养师或其他专业人员的诊断与建议。",
  };
}
