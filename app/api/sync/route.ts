import { env } from "cloudflare:workers";
import { getLocalUser, ownerKey } from "../../auth";
import type { AppState, DailyInsight, FoodItem } from "../../types";

export const runtime = "edge";

type Row = Record<string, string | number | null>;

function database() {
  const db = env.DB;
  if (!db) throw new Error("D1 binding DB is unavailable");
  return db;
}

function validState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<AppState>;
  return (
    state.version === 1 &&
    Array.isArray(state.profiles) &&
    state.profiles.length <= 30 &&
    Array.isArray(state.weights) &&
    state.weights.length <= 30_000 &&
    Array.isArray(state.meals) &&
    state.meals.length <= 80_000 &&
    Array.isArray(state.contexts) &&
    state.contexts.length <= 20_000 &&
    Array.isArray(state.exercises) &&
    state.exercises.length <= 30_000 &&
    Array.isArray(state.customFoods) &&
    state.customFoods.length <= 3_000 &&
    Array.isArray(state.insights) &&
    state.insights.length <= 10_000
  );
}

export async function GET() {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  try {
    const db = database();
    const owner = ownerKey(user);
    const [profileRows, weightRows, mealRows, contextRows, exerciseRows, foodRows, insightRows] =
      await Promise.all([
        db.prepare("SELECT * FROM profiles WHERE owner_email = ? ORDER BY created_at").bind(owner).all<Row>(),
        db.prepare("SELECT * FROM weight_entries WHERE owner_email = ? ORDER BY recorded_at").bind(owner).all<Row>(),
        db.prepare("SELECT * FROM meal_entries WHERE owner_email = ? ORDER BY recorded_at").bind(owner).all<Row>(),
        db.prepare("SELECT * FROM daily_contexts WHERE owner_email = ? ORDER BY local_date").bind(owner).all<Row>(),
        db.prepare("SELECT * FROM exercise_entries WHERE owner_email = ? ORDER BY performed_at").bind(owner).all<Row>(),
        db.prepare("SELECT * FROM custom_foods WHERE owner_email = ? ORDER BY created_at").bind(owner).all<Row>(),
        db.prepare("SELECT * FROM ai_insights WHERE owner_email = ? ORDER BY local_date").bind(owner).all<Row>(),
      ]);

    if (!profileRows.results.length) return Response.json({ state: null });
    const state: AppState = {
      version: 1,
      activeProfileId: String(profileRows.results[0].id),
      profiles: profileRows.results.map((row: Row) => ({
        id: String(row.id),
        nickname: String(row.nickname),
        birthDate: String(row.birth_date),
        sex: row.sex === "male" ? "male" : "female",
        heightCm: Number(row.height_cm),
        unit: row.weight_unit === "jin" ? "jin" : "kg",
        stage: String(row.life_stage) as AppState["profiles"][number]["stage"],
        activityLevel: String(row.activity_level) as AppState["profiles"][number]["activityLevel"],
        goalType: String(row.goal) as AppState["profiles"][number]["goalType"],
        timezone: String(row.timezone),
        aiProvider:
          row.ai_provider === "deepseek" || row.ai_provider === "qwen"
            ? row.ai_provider
            : "rules",
        prepregnancyWeightKg: row.prepregnancy_weight_kg == null ? undefined : Number(row.prepregnancy_weight_kg),
        dueDate: row.due_date == null ? undefined : String(row.due_date),
        fetusCount: row.fetus_count === 2 ? 2 : row.fetus_count === 1 ? 1 : undefined,
        createdAt: String(row.created_at),
      })),
      weights: weightRows.results.map((row: Row) => ({
        id: String(row.id),
        profileId: String(row.profile_id),
        localDate: String(row.local_date),
        measuredAt: String(row.recorded_at),
        period: row.period === "evening" ? "evening" : "morning",
        weightKg: Number(row.weight_kg),
      })),
      meals: mealRows.results.map((row: Row) => ({
        id: String(row.id),
        profileId: String(row.profile_id),
        localDate: String(row.local_date),
        eatenAt: String(row.recorded_at),
        mealType: String(row.meal_type) as AppState["meals"][number]["mealType"],
        foodName: String(row.food_name),
        grams: Number(row.grams),
        kcalPer100g: Number(row.kcal_per_100g),
        calories: Number(row.calories),
        source: row.food_id ? "library" : "custom",
      })),
      contexts: contextRows.results.map((row: Row) => ({
        id: String(row.id),
        profileId: String(row.profile_id),
        localDate: String(row.local_date),
        sleepHours: row.sleep_hours == null ? undefined : Number(row.sleep_hours),
        exerciseMinutes: row.exercise_minutes == null ? undefined : Number(row.exercise_minutes),
        waterMl: row.water_ml == null ? undefined : Number(row.water_ml),
        tags: JSON.parse(String(row.tags_json || "[]")) as string[],
      })),
      exercises: exerciseRows.results.map((row: Row) => ({
        id: String(row.id),
        profileId: String(row.profile_id),
        localDate: String(row.local_date),
        performedAt: String(row.performed_at),
        presetId: String(row.preset_id),
        activityName: String(row.activity_name),
        minutes: Number(row.minutes),
        metValue: Number(row.met_value),
        calories: Number(row.calories),
        weightKg: Number(row.weight_kg),
        standard:
          row.standard === "youth_mety"
            ? "youth_mety"
            : row.standard === "older_met60"
              ? "older_met60"
              : "adult_met",
      })),
      customFoods: foodRows.results.map((row: Row) => ({
        id: String(row.id),
        name: String(row.name),
        category: String(row.category),
        kcalPer100g: Number(row.kcal_per_100g),
        favorite: Boolean(row.favorite),
      })),
      insights: insightRows.results.map((row: Row) => JSON.parse(String(row.result_json)) as DailyInsight),
    };
    return Response.json({ state });
  } catch {
    return Response.json({ error: "云端数据暂时不可用" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const user = await getLocalUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (Number(request.headers.get("content-length") ?? 0) > 5_000_000) {
    return Response.json({ error: "数据量过大" }, { status: 413 });
  }

  let state: unknown;
  try {
    state = await request.json();
  } catch {
    return Response.json({ error: "数据格式不正确" }, { status: 400 });
  }
  if (!validState(state)) return Response.json({ error: "数据格式不正确" }, { status: 400 });

  const owner = ownerKey(user);
  const db = database();
  const profileIds = new Set(state.profiles.map((profile) => profile.id));
  if (
    [...state.weights, ...state.meals, ...state.contexts, ...state.exercises, ...state.insights].some(
      (entry) => !profileIds.has(entry.profileId),
    )
  ) {
    return Response.json({ error: "记录不属于当前档案" }, { status: 400 });
  }

  const statements = [
    db.prepare("DELETE FROM ai_insights WHERE owner_email = ?").bind(owner),
    db.prepare("DELETE FROM exercise_entries WHERE owner_email = ?").bind(owner),
    db.prepare("DELETE FROM daily_contexts WHERE owner_email = ?").bind(owner),
    db.prepare("DELETE FROM meal_entries WHERE owner_email = ?").bind(owner),
    db.prepare("DELETE FROM weight_entries WHERE owner_email = ?").bind(owner),
    db.prepare("DELETE FROM custom_foods WHERE owner_email = ?").bind(owner),
    db.prepare("DELETE FROM profiles WHERE owner_email = ?").bind(owner),
    ...state.profiles.map((profile) =>
      db
        .prepare(
          "INSERT INTO profiles (id, owner_email, nickname, birth_date, sex, height_cm, weight_unit, activity_level, goal, life_stage, timezone, ai_provider, due_date, prepregnancy_weight_kg, fetus_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        )
        .bind(
          profile.id,
          owner,
          profile.nickname.slice(0, 40),
          profile.birthDate,
          profile.sex,
          profile.heightCm,
          profile.unit,
          profile.activityLevel,
          profile.goalType,
          profile.stage,
          profile.timezone,
          profile.aiProvider ?? "rules",
          profile.dueDate ?? null,
          profile.prepregnancyWeightKg ?? null,
          profile.fetusCount ?? null,
          profile.createdAt,
        ),
    ),
    ...state.weights.map((entry) =>
      db
        .prepare(
          "INSERT INTO weight_entries (id, client_id, owner_email, profile_id, local_date, period, weight_kg, recorded_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(entry.id, entry.id, owner, entry.profileId, entry.localDate, entry.period, entry.weightKg, entry.measuredAt),
    ),
    ...state.meals.map((entry) =>
      db
        .prepare(
          "INSERT INTO meal_entries (id, client_id, owner_email, profile_id, local_date, meal_type, food_id, food_name, grams, kcal_per_100g, calories, recorded_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(
          entry.id,
          entry.id,
          owner,
          entry.profileId,
          entry.localDate,
          entry.mealType,
          entry.source === "library" ? entry.foodName : null,
          entry.foodName.slice(0, 80),
          entry.grams,
          entry.kcalPer100g,
          entry.calories,
          entry.eatenAt,
        ),
    ),
    ...state.contexts.map((entry) =>
      db
        .prepare(
          "INSERT INTO daily_contexts (id, owner_email, profile_id, local_date, sleep_hours, exercise_minutes, water_ml, tags_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(
          entry.id,
          owner,
          entry.profileId,
          entry.localDate,
          entry.sleepHours ?? null,
          entry.exerciseMinutes ?? null,
          entry.waterMl ?? null,
          JSON.stringify(entry.tags.slice(0, 20)),
        ),
    ),
    ...state.exercises.map((entry) =>
      db
        .prepare(
          "INSERT INTO exercise_entries (id, owner_email, profile_id, local_date, preset_id, activity_name, minutes, met_value, calories, weight_kg, standard, performed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(
          entry.id,
          owner,
          entry.profileId,
          entry.localDate,
          entry.presetId,
          entry.activityName.slice(0, 60),
          entry.minutes,
          entry.metValue,
          entry.calories,
          entry.weightKg,
          entry.standard,
          entry.performedAt,
        ),
    ),
    ...state.customFoods.map((food: FoodItem) =>
      db
        .prepare(
          "INSERT INTO custom_foods (id, owner_email, name, category, kcal_per_100g, favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(food.id, owner, food.name.slice(0, 80), food.category.slice(0, 30), food.kcalPer100g, food.favorite ? 1 : 0),
    ),
    ...state.insights.map((insight) =>
      db
        .prepare(
          "INSERT INTO ai_insights (id, owner_email, profile_id, local_date, input_hash, result_json, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
        )
        .bind(
          insight.id,
          owner,
          insight.profileId,
          insight.localDate,
          "client-import",
          JSON.stringify(insight),
          insight.source,
          insight.createdAt,
        ),
    ),
  ];

  try {
    await db.batch(statements);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "云端同步失败，本地记录没有丢失" }, { status: 503 });
  }
}
