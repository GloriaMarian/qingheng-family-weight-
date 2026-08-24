import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const accounts = sqliteTable("accounts", {
  email: text("email").primaryKey(),
  displayName: text("display_name"),
  ...timestamps,
});

export const localAccounts = sqliteTable(
  "local_accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    usernameKey: text("username_key").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("local_accounts_username_key_unique").on(table.usernameKey),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    accountId: text("account_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("auth_sessions_account_idx").on(table.accountId)],
);

export const authRateLimits = sqliteTable("auth_rate_limits", {
  usernameKey: text("username_key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStart: text("window_start").notNull(),
  blockedUntil: text("blocked_until"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    nickname: text("nickname").notNull(),
    birthDate: text("birth_date").notNull(),
    sex: text("sex").notNull(),
    heightCm: real("height_cm").notNull(),
    weightUnit: text("weight_unit").notNull(),
    activityLevel: text("activity_level").notNull(),
    goal: text("goal").notNull(),
    lifeStage: text("life_stage").notNull(),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    aiProvider: text("ai_provider").notNull().default("rules"),
    dueDate: text("due_date"),
    prepregnancyWeightKg: real("prepregnancy_weight_kg"),
    fetusCount: integer("fetus_count"),
    ...timestamps,
  },
  (table) => [index("profiles_owner_idx").on(table.ownerEmail)],
);

export const weightEntries = sqliteTable(
  "weight_entries",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    profileId: text("profile_id").notNull(),
    localDate: text("local_date").notNull(),
    period: text("period").notNull(),
    weightKg: real("weight_kg").notNull(),
    recordedAt: text("recorded_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("weights_owner_profile_idx").on(table.ownerEmail, table.profileId),
    index("weights_date_idx").on(table.profileId, table.localDate),
  ],
);

export const mealEntries = sqliteTable(
  "meal_entries",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    profileId: text("profile_id").notNull(),
    localDate: text("local_date").notNull(),
    mealType: text("meal_type").notNull(),
    foodId: text("food_id"),
    foodName: text("food_name").notNull(),
    grams: real("grams").notNull(),
    kcalPer100g: real("kcal_per_100g").notNull(),
    calories: real("calories").notNull(),
    recordedAt: text("recorded_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("meals_owner_profile_idx").on(table.ownerEmail, table.profileId),
    index("meals_date_idx").on(table.profileId, table.localDate),
  ],
);

export const dailyContexts = sqliteTable(
  "daily_contexts",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    profileId: text("profile_id").notNull(),
    localDate: text("local_date").notNull(),
    sleepHours: real("sleep_hours"),
    exerciseMinutes: integer("exercise_minutes"),
    waterMl: integer("water_ml"),
    tagsJson: text("tags_json").notNull().default("[]"),
    ...timestamps,
  },
  (table) => [index("contexts_owner_profile_idx").on(table.ownerEmail, table.profileId)],
);

export const exerciseEntries = sqliteTable(
  "exercise_entries",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    profileId: text("profile_id").notNull(),
    localDate: text("local_date").notNull(),
    presetId: text("preset_id").notNull(),
    activityName: text("activity_name").notNull(),
    minutes: integer("minutes").notNull(),
    metValue: real("met_value").notNull(),
    calories: real("calories").notNull(),
    weightKg: real("weight_kg").notNull(),
    standard: text("standard").notNull(),
    performedAt: text("performed_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("exercises_owner_profile_idx").on(table.ownerEmail, table.profileId),
    index("exercises_date_idx").on(table.profileId, table.localDate),
  ],
);

export const customFoods = sqliteTable(
  "custom_foods",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    kcalPer100g: real("kcal_per_100g").notNull(),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [index("foods_owner_idx").on(table.ownerEmail)],
);

export const aiInsights = sqliteTable(
  "ai_insights",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    profileId: text("profile_id").notNull(),
    localDate: text("local_date").notNull(),
    inputHash: text("input_hash").notNull(),
    resultJson: text("result_json").notNull(),
    source: text("source").notNull(),
    ...timestamps,
  },
  (table) => [
    index("insights_owner_profile_idx").on(table.ownerEmail, table.profileId),
    index("insights_date_idx").on(table.ownerEmail, table.localDate),
  ],
);
