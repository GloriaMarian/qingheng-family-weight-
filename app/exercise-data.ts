import { calculateAge } from "./health.ts";
import type { Profile } from "./types.ts";

export interface ExercisePreset {
  id: string;
  name: string;
  detail: string;
  adultMet: number;
  olderMet60?: number;
  youthMety: [number, number, number, number];
}

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { id: "strength", name: "力量训练", detail: "多动作、一般强度", adultMet: 3.5, olderMet60: 4.3, youthMety: [3.0, 3.3, 3.2, 3.2] },
  { id: "yoga", name: "瑜伽", detail: "哈他/舒缓瑜伽", adultMet: 2.3, olderMet60: 2.5, youthMety: [1.9, 1.9, 2.5, 3.6] },
  { id: "running", name: "跑步", detail: "约 8 km/h", adultMet: 8.5, olderMet60: 8.5, youthMety: [7.7, 7.5, 7.6, 8.0] },
  { id: "hill", name: "爬坡", detail: "中等速度、中等坡度", adultMet: 7.0, olderMet60: 5.0, youthMety: [6.4, 5.0, 5.0, 5.9] },
  { id: "stairs", name: "走楼梯", detail: "上下楼、一般速度", adultMet: 7.5, olderMet60: 4.0, youthMety: [5.7, 6.7, 7.6, 7.4] },
  { id: "swimming", name: "游泳", detail: "休闲/自选速度", adultMet: 5.8, youthMety: [7.0, 8.5, 9.5, 9.3] },
  { id: "rope", name: "跳绳", detail: "一般速度", adultMet: 11.0, youthMety: [6.9, 6.0, 8.7, 8.7] },
  { id: "cycling", name: "骑行", detail: "休闲慢速", adultMet: 6.8, olderMet60: 5.3, youthMety: [4.4, 5.4, 5.3, 7.0] },
  { id: "brisk-walk", name: "快走", detail: "约 5.6–6.3 km/h", adultMet: 4.8, olderMet60: 6.0, youthMety: [4.6, 5.0, 5.1, 5.5] },
  { id: "aerobics", name: "有氧操", detail: "一般强度", adultMet: 7.3, olderMet60: 5.0, youthMety: [3.6, 4.0, 4.8, 4.0] },
];

function youthGroup(age: number) {
  if (age <= 9) return 0;
  if (age <= 12) return 1;
  if (age <= 15) return 2;
  return 3;
}

function youthBmrPerMinute(profile: Profile, weightKg: number, age: number) {
  if (profile.sex === "male") {
    return (age < 10
      ? 22.706 * weightKg + 504.3
      : 17.686 * weightKg + 658.2) / 1440;
  }
  return (age < 10
    ? 20.315 * weightKg + 485.9
    : 13.384 * weightKg + 692.6) / 1440;
}

export function calculateExerciseCalories(
  profile: Profile,
  weightKg: number,
  preset: ExercisePreset,
  minutes: number,
) {
  const age = calculateAge(profile.birthDate);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || minutes <= 0) return null;
  if (age < 6) return null;

  if (age <= 18) {
    const metValue = preset.youthMety[youthGroup(age)];
    return {
      calories: Number((metValue * youthBmrPerMinute(profile, weightKg, age) * minutes).toFixed(1)),
      metValue,
      standard: "youth_mety" as const,
      standardLabel: "儿童青少年 METy",
    };
  }

  if (age >= 60 && preset.olderMet60) {
    const metValue = preset.olderMet60;
    return {
      calories: Number((metValue * 2.7 * weightKg * minutes / 200).toFixed(1)),
      metValue,
      standard: "older_met60" as const,
      standardLabel: "60 岁以上 MET60+",
    };
  }

  const metValue = preset.adultMet;
  return {
    calories: Number((metValue * 3.5 * weightKg * minutes / 200).toFixed(1)),
    metValue,
    standard: "adult_met" as const,
    standardLabel: "成人 MET",
  };
}
