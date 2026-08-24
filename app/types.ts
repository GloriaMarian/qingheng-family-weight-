export type LifeStage =
  | "infant"
  | "child"
  | "teen"
  | "adult"
  | "older_adult"
  | "pregnant"
  | "postpartum";

export type WeightPeriod = "morning" | "evening";
export type MealType =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "feeding";
export type Sex = "male" | "female";
export type WeightUnit = "kg" | "jin";
export type AiProvider = "rules" | "deepseek" | "qwen";
export type GoalType = "maintain" | "lose" | "gain" | "grow" | "pregnancy";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active";

export interface Profile {
  id: string;
  nickname: string;
  birthDate: string;
  sex: Sex;
  heightCm: number;
  unit: WeightUnit;
  stage: LifeStage;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  goalWeightKg?: number;
  timezone: string;
  aiProvider?: AiProvider;
  prepregnancyWeightKg?: number;
  dueDate?: string;
  fetusCount?: 1 | 2;
  createdAt: string;
}

export interface WeightEntry {
  id: string;
  profileId: string;
  localDate: string;
  measuredAt: string;
  period: WeightPeriod;
  weightKg: number;
  note?: string;
}

export interface MealEntry {
  id: string;
  profileId: string;
  localDate: string;
  eatenAt: string;
  mealType: MealType;
  foodName: string;
  grams: number;
  kcalPer100g: number;
  calories: number;
  source: "library" | "custom";
}

export interface DailyContext {
  id: string;
  profileId: string;
  localDate: string;
  sleepHours?: number;
  exerciseMinutes?: number;
  waterMl?: number;
  tags: string[];
}

export interface ExerciseEntry {
  id: string;
  profileId: string;
  localDate: string;
  performedAt: string;
  presetId: string;
  activityName: string;
  minutes: number;
  metValue: number;
  calories: number;
  weightKg: number;
  standard: "adult_met" | "youth_mety" | "older_met60";
}

export interface FoodItem {
  id: string;
  name: string;
  kcalPer100g: number;
  category: string;
  favorite?: boolean;
}

export interface DailyInsight {
  id: string;
  profileId: string;
  localDate: string;
  source: "ai" | "rules";
  provider?: AiProvider;
  summary: string;
  weightReview?: string;
  nutritionReview?: string;
  lifestyleReview?: string;
  dataQuality?: string;
  factors: string[];
  prediction: string;
  actions: string[];
  safetyNote: string;
  createdAt: string;
}

export interface AppState {
  version: 1;
  activeProfileId: string | null;
  profiles: Profile[];
  weights: WeightEntry[];
  meals: MealEntry[];
  contexts: DailyContext[];
  exercises: ExerciseEntry[];
  customFoods: FoodItem[];
  insights: DailyInsight[];
  lastCloudSyncAt?: string;
}

export interface DashboardMetrics {
  latestWeightKg: number | null;
  dailyAverageWeightKg: number | null;
  dailyWeightCount: number;
  bmi: number | null;
  bmr: number | null;
  tdee: number | null;
  bodyFat: number | null;
  pediatricZScore: number | null;
  pregnancyRangeKg: [number, number] | null;
  caloriesToday: number;
  exerciseCaloriesToday: number;
  estimatedDailyBurn: number | null;
  energyBalance: number | null;
  sevenDayAverageKg: number | null;
}

export const EMPTY_STATE: AppState = {
  version: 1,
  activeProfileId: null,
  profiles: [],
  weights: [],
  meals: [],
  contexts: [],
  exercises: [],
  customFoods: [],
  insights: [],
};
