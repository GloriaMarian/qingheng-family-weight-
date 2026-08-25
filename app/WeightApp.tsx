"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildInsightPrompt,
  parseInsightResponse,
  type InsightContent,
  type OnlineAiProvider,
} from "./ai-insight";
import { COMMON_FOODS } from "./food-data";
import {
  calculateExerciseCalories,
  EXERCISE_PRESETS,
} from "./exercise-data";
import {
  createRuleInsight,
  dashboardMetrics,
  fourteenDayCycle,
  describeWhoZScore,
  forecastWeight,
  greetingForHour,
  jinToKg,
  kgToJin,
  localDate,
  shiftLocalDate,
} from "./health";
import { clearState, loadState, saveState } from "./storage";
import {
  EMPTY_STATE,
  type ActivityLevel,
  type AiProvider,
  type AppState,
  type DailyContext,
  type DailyInsight,
  type ExerciseEntry,
  type FoodItem,
  type GoalType,
  type LifeStage,
  type MealEntry,
  type MealType,
  type Profile,
  type Sex,
  type WeightPeriod,
  type WeightUnit,
} from "./types";

type AppUser = {
  id: string;
  username: string;
  displayName: string;
} | null;
type View = "today" | "trends" | "history" | "family";

const VIEW_LABELS: Record<View, string> = {
  today: "今日",
  trends: "趋势",
  history: "记录",
  family: "家人",
};

const VIEW_ICONS: Record<View, string> = {
  today: "☀",
  trends: "⌁",
  history: "✎",
  family: "♡",
};
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
  feeding: "喂养",
};
const STAGE_LABELS: Record<LifeStage, string> = {
  infant: "婴幼儿",
  child: "儿童",
  teen: "青少年",
  adult: "成年人",
  older_adult: "老年人",
  pregnant: "孕期",
  postpartum: "产后",
};
const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "久坐为主",
  light: "轻度活动",
  moderate: "中度活动",
  active: "活动较多",
};
const GOAL_LABELS: Record<GoalType, string> = {
  maintain: "保持状态",
  lose: "温和减重",
  gain: "健康增重",
  grow: "关注成长",
  pregnancy: "孕期管理",
};
const CONTEXT_TAGS = ["高盐饮食", "经期", "旅行", "生病", "聚餐"];
const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  rules: "本地分析",
  deepseek: "DeepSeek",
  qwen: "通义千问",
};
const AI_CHAT_URLS: Record<OnlineAiProvider, string> = {
  deepseek: "https://chat.deepseek.com/",
  qwen: "https://chat.qwen.ai/",
};
const AI_KEY_URLS: Record<OnlineAiProvider, string> = {
  deepseek: "https://platform.deepseek.com/api_keys",
  qwen: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
};

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function emptyProfile(): Omit<Profile, "id" | "createdAt"> {
  return {
    nickname: "",
    birthDate: `${new Date().getFullYear() - 30}-01-01`,
    sex: "female",
    heightCm: 165,
    unit: "kg",
    stage: "adult",
    activityLevel: "light",
    goalType: "maintain",
    timezone: "Asia/Shanghai",
    aiProvider: "rules",
  };
}

function formatNumber(value: number | null, digits = 1) {
  return value === null || Number.isNaN(value) ? "—" : value.toFixed(digits);
}

export default function WeightApp({ user: initialUser }: { user: AppUser }) {
  const [user, setUser] = useState<AppUser>(initialUser);
  const [appState, setAppState] = useState<AppState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("today");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileDraft, setProfileDraft] = useState(emptyProfile());
  const [weightValue, setWeightValue] = useState("");
  const [weightPeriod, setWeightPeriod] = useState<WeightPeriod>(() =>
    new Date().getHours() < 12 ? "morning" : "evening",
  );
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [foodQuery, setFoodQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [foodGrams, setFoodGrams] = useState("100");
  const [customKcal, setCustomKcal] = useState("");
  const [showMealForm, setShowMealForm] = useState(false);
  const [exercisePresetId, setExercisePresetId] = useState("strength");
  const [exerciseMinutes, setExerciseMinutes] = useState("30");
  const [syncMessage, setSyncMessage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (initialUser) return;
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { user?: Exclude<AppUser, null> };
        return payload.user ?? null;
      })
      .then((sessionUser) => {
        if (active && sessionUser) setUser(sessionUser);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [initialUser]);

  useEffect(() => {
    let active = true;
    loadState().then((saved) => {
      if (!active) return;
      setAppState(saved);
      setReady(true);
      setShowProfileForm(saved.profiles.length === 0);
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    if (ready) saveState(appState).catch(() => undefined);
  }, [appState, ready]);

  useEffect(() => {
    const updateClock = () => setClock(new Date());
    const timer = window.setInterval(updateClock, 30_000);
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, []);

  const activeProfile =
    appState.profiles.find((item) => item.id === appState.activeProfileId) ??
    appState.profiles[0] ??
    null;
  const deviceTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    [],
  );
  const currentDate = localDate(deviceTimezone, clock);
  const date = selectedDate ?? currentDate;

  const metrics = useMemo(
    () =>
      activeProfile
        ? dashboardMetrics(
            activeProfile,
            appState.weights,
            appState.meals,
            date,
            appState.exercises,
          )
        : null,
    [activeProfile, appState.exercises, appState.meals, appState.weights, date],
  );
  const prediction = useMemo(
    () =>
      activeProfile
        ? forecastWeight(appState.weights, activeProfile.id)
        : null,
    [activeProfile, appState.weights],
  );
  const todayWeights = activeProfile
    ? appState.weights.filter(
        (entry) =>
          entry.profileId === activeProfile.id && entry.localDate === date,
      )
    : [];
  const todayMeals = activeProfile
    ? appState.meals.filter(
        (entry) =>
          entry.profileId === activeProfile.id && entry.localDate === date,
      )
    : [];
  const todayContext = activeProfile
    ? appState.contexts.find(
        (entry) =>
          entry.profileId === activeProfile.id && entry.localDate === date,
      )
    : undefined;
  const todayExercises = activeProfile
    ? appState.exercises.filter(
        (entry) =>
          entry.profileId === activeProfile.id && entry.localDate === date,
      )
    : [];
  const selectedExercise = EXERCISE_PRESETS.find(
    (preset) => preset.id === exercisePresetId,
  ) ?? EXERCISE_PRESETS[0];
  const exerciseEstimate =
    activeProfile && metrics?.latestWeightKg
      ? calculateExerciseCalories(
          activeProfile,
          metrics.latestWeightKg,
          selectedExercise,
          Number(exerciseMinutes),
        )
      : null;
  const latestInsight = activeProfile
    ? appState.insights
        .filter(
          (entry) =>
            entry.profileId === activeProfile.id && entry.localDate === date,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;
  const matchingFoods = [
    ...COMMON_FOODS,
    ...appState.customFoods,
  ]
    .filter((food) => !foodQuery.trim() || food.name.includes(foodQuery.trim()))
    .slice(0, 8);

  useEffect(() => {
    const hasEveningWeight = todayWeights.some(
      (entry) => entry.period === "evening",
    );
    if (
      ready &&
      activeProfile &&
      (activeProfile.aiProvider ?? "rules") === "rules" &&
      hasEveningWeight &&
      !latestInsight &&
      !aiBusy
    ) {
      void generateInsight();
    }
  }, [
    activeProfile?.id,
    activeProfile?.aiProvider,
    aiBusy,
    appState.weights.length,
    date,
    latestInsight?.id,
    ready,
  ]);

  function updateState(recipe: (current: AppState) => AppState) {
    setAppState((current) => recipe(current));
  }

  function changeDate(nextDate: string | null) {
    setSelectedDate(nextDate);
    setWeightValue("");
    setWeightPeriod(new Date().getHours() < 12 ? "morning" : "evening");
  }

  function createProfile() {
    if (!profileDraft.nickname.trim() || !profileDraft.birthDate) return;
    const profile: Profile = {
      ...profileDraft,
      id: uid("profile"),
      nickname: profileDraft.nickname.trim(),
      heightCm: Number(profileDraft.heightCm),
      goalWeightKg: profileDraft.goalWeightKg
        ? Number(profileDraft.goalWeightKg)
        : undefined,
      prepregnancyWeightKg: profileDraft.prepregnancyWeightKg
        ? Number(profileDraft.prepregnancyWeightKg)
        : undefined,
      createdAt: new Date().toISOString(),
    };
    updateState((current) => ({
      ...current,
      profiles: [...current.profiles, profile],
      activeProfileId: profile.id,
    }));
    setProfileDraft(emptyProfile());
    setShowProfileForm(false);
    setView("today");
  }

  function saveWeight() {
    if (!activeProfile) return;
    const entered = Number(weightValue);
    if (!entered || entered <= 0) return;
    const weightKg =
      activeProfile.unit === "jin" ? jinToKg(entered) : entered;
    const existing = todayWeights.find((entry) => entry.period === weightPeriod);
    const entry = {
      id: existing?.id ?? uid("weight"),
      profileId: activeProfile.id,
      localDate: date,
      measuredAt: new Date().toISOString(),
      period: weightPeriod,
      weightKg: Number(weightKg.toFixed(2)),
    };
    updateState((current) => ({
      ...current,
      weights: existing
        ? current.weights.map((item) => (item.id === existing.id ? entry : item))
        : [...current.weights, entry],
    }));
    setWeightValue("");
  }

  function addMeal() {
    if (!activeProfile) return;
    const name = selectedFood?.name ?? foodQuery.trim();
    const kcalPer100g = selectedFood?.kcalPer100g ?? Number(customKcal);
    const grams = Number(foodGrams);
    if (!name || !kcalPer100g || !grams) return;
    const source = selectedFood ? "library" : "custom";
    const meal: MealEntry = {
      id: uid("meal"),
      profileId: activeProfile.id,
      localDate: date,
      eatenAt: new Date().toISOString(),
      mealType,
      foodName: name,
      grams,
      kcalPer100g,
      calories: Number(((grams * kcalPer100g) / 100).toFixed(1)),
      source,
    };
    updateState((current) => ({
      ...current,
      meals: [...current.meals, meal],
      customFoods:
        source === "custom" &&
        !current.customFoods.some((food) => food.name === name)
          ? [
              ...current.customFoods,
              { id: uid("food"), name, kcalPer100g, category: "自定义" },
            ]
          : current.customFoods,
    }));
    setFoodQuery("");
    setSelectedFood(null);
    setCustomKcal("");
    setFoodGrams("100");
    setShowMealForm(false);
  }

  function updateContext(patch: Partial<DailyContext>) {
    if (!activeProfile) return;
    const existing = todayContext;
    const entry: DailyContext = {
      id: existing?.id ?? uid("context"),
      profileId: activeProfile.id,
      localDate: date,
      tags: existing?.tags ?? [],
      ...existing,
      ...patch,
    };
    updateState((current) => ({
      ...current,
      contexts: existing
        ? current.contexts.map((item) => (item.id === existing.id ? entry : item))
        : [...current.contexts, entry],
    }));
  }

  function addExercise() {
    if (!activeProfile || !metrics?.latestWeightKg || !exerciseEstimate) return;
    const minutes = Number(exerciseMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) return;
    const entry: ExerciseEntry = {
      id: uid("exercise"),
      profileId: activeProfile.id,
      localDate: date,
      performedAt: new Date().toISOString(),
      presetId: selectedExercise.id,
      activityName: selectedExercise.name,
      minutes,
      metValue: exerciseEstimate.metValue,
      calories: exerciseEstimate.calories,
      weightKg: metrics.latestWeightKg,
      standard: exerciseEstimate.standard,
    };
    updateState((current) => ({
      ...current,
      exercises: [...current.exercises, entry],
    }));
    setExerciseMinutes("30");
  }

  function insightAggregateInput() {
    return {
      date,
      stage: activeProfile?.stage,
      metrics,
      deterministicPrediction: prediction,
      weights: todayWeights,
      meals: todayMeals.map((meal) => ({
        mealType: meal.mealType,
        foodName: meal.foodName,
        calories: meal.calories,
      })),
      exercises: todayExercises.map((entry) => ({
        activityName: entry.activityName,
        minutes: entry.minutes,
        calories: entry.calories,
        standard: entry.standard,
      })),
      context: todayContext,
    };
  }

  function saveGeneratedInsight(
    generated: InsightContent & Pick<DailyInsight, "source" | "provider">,
  ) {
    if (!activeProfile) return;
    const insight: DailyInsight = {
      id: uid("insight"),
      profileId: activeProfile.id,
      localDate: date,
      createdAt: new Date().toISOString(),
      ...generated,
    };
    updateState((current) => ({
      ...current,
      insights: [
        ...current.insights.filter(
          (entry) =>
            !(
              entry.profileId === activeProfile.id &&
              entry.localDate === date
            ),
        ),
        insight,
      ],
    }));
  }

  function externalInsightPrompt() {
    if (!activeProfile) return "";
    return buildInsightPrompt(
      insightAggregateInput(),
      ["infant", "child", "teen", "pregnant", "postpartum"].includes(
        activeProfile.stage,
      ),
    );
  }

  function importExternalInsight(provider: OnlineAiProvider, value: string) {
    const result = parseInsightResponse(value);
    if (!result) {
      return "无法导入：请复制 AI 返回的完整 JSON，且建议必须正好 5 条。";
    }
    saveGeneratedInsight({ ...result, source: "ai", provider });
    return `已导入 ${AI_PROVIDER_LABELS[provider]} 的分析结果。`;
  }

  async function generateInsight(options?: {
    apiKey?: string;
    qwenBaseUrl?: string;
  }) {
    if (!activeProfile || aiBusy) return;
    const fallback = createRuleInsight(
      activeProfile,
      appState.weights,
      appState.meals,
      date,
      todayContext,
      todayExercises,
    );
    const provider = activeProfile.aiProvider ?? "rules";
    if (provider === "rules") {
      saveGeneratedInsight({
        ...fallback,
        source: "rules",
        provider: "rules",
      });
      return "已使用本地规则生成分析，没有连接外部 AI。";
    }

    const apiKey = options?.apiKey?.trim() ?? "";
    if (!apiKey) return "请先填写自己的 API Key，或使用网页登录分析。";
    setAiBusy(true);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-provider-api-key": apiKey,
      };
      if (provider === "qwen" && options?.qwenBaseUrl?.trim()) {
        headers["x-provider-base-url"] = options.qwenBaseUrl.trim();
      }
      const response = await fetch("/api/insights", {
        method: "POST",
        headers,
        body: JSON.stringify({
          profileId: activeProfile.id,
          stage: activeProfile.stage,
          provider,
          date,
          metrics,
          prediction,
          todayWeights,
          meals: todayMeals.map((meal) => ({
            mealType: meal.mealType,
            foodName: meal.foodName,
            calories: meal.calories,
          })),
          context: todayContext,
          exercises: todayExercises.map((entry) => ({
            activityName: entry.activityName,
            minutes: entry.minutes,
            calories: entry.calories,
            standard: entry.standard,
          })),
          fallback,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (InsightContent & Pick<DailyInsight, "source" | "provider">)
        | { error?: string }
        | null;
      if (!response.ok || !payload || "error" in payload) {
        return payload && "error" in payload && payload.error
          ? payload.error
          : "外部 AI 暂时无法完成分析，请稍后重试。";
      }
      saveGeneratedInsight(payload);
      return `已使用你的 ${AI_PROVIDER_LABELS[provider]} API Key 完成分析；Key 未保存。`;
    } catch {
      return "连接外部 AI 失败，请检查网络后重试。";
    } finally {
      setAiBusy(false);
    }
  }

  async function syncToCloud() {
    if (!user) return;
    setSyncMessage("正在安全同步…");
    try {
      const response = await fetch("/api/sync", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(appState),
      });
      if (!response.ok) throw new Error("sync failed");
      updateState((current) => ({
        ...current,
        lastCloudSyncAt: new Date().toISOString(),
      }));
      setSyncMessage("已同步到云端");
    } catch {
      setSyncMessage("本地记录已保存，云端稍后再试");
    }
  }

  async function restoreFromCloud() {
    if (!user) return;
    setSyncMessage("正在读取云端记录…");
    try {
      const response = await fetch("/api/sync");
      if (!response.ok) throw new Error("restore failed");
      const payload = (await response.json()) as { state: AppState | null };
      if (payload.state) {
        setAppState({
          ...payload.state,
          lastCloudSyncAt: new Date().toISOString(),
        });
        setSyncMessage("已恢复云端记录");
      } else setSyncMessage("云端还没有记录");
    } catch {
      setSyncMessage("暂时无法读取云端记录");
    }
  }

  async function deleteCloudAccount() {
    if (!user) return;
    const confirmed = window.confirm(
      "确定删除这个账号在轻衡中的全部云端档案、体重、餐食和分析记录吗？此操作无法撤销。",
    );
    if (!confirmed) return;
    setSyncMessage("正在删除云端账号数据…");
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      await clearState();
      window.location.reload();
    } catch {
      setSyncMessage("删除没有完成，云端数据仍然保留，请稍后重试。");
    }
  }

  async function logoutAccount() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  }

  function exportJson() {
    downloadFile(
      `轻衡记录-${date}.json`,
      JSON.stringify(appState, null, 2),
      "application/json",
    );
  }

  function exportCsv() {
    const lines = [
      ["日期", "成员", "时段", "体重kg", "餐次", "食物", "克数", "摄入热量kcal", "运动", "分钟", "运动消耗kcal"],
    ];
    appState.weights.forEach((weight) => {
      const name =
        appState.profiles.find((profile) => profile.id === weight.profileId)
          ?.nickname ?? "";
      lines.push([
        weight.localDate,
        name,
        weight.period === "morning" ? "早晨" : "晚上",
        String(weight.weightKg),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    });
    appState.meals.forEach((meal) => {
      const name =
        appState.profiles.find((profile) => profile.id === meal.profileId)
          ?.nickname ?? "";
      lines.push([
        meal.localDate,
        name,
        "",
        "",
        MEAL_LABELS[meal.mealType],
        meal.foodName,
        String(meal.grams),
        String(meal.calories),
        "",
        "",
        "",
      ]);
    });
    appState.exercises.forEach((exercise) => {
      const name =
        appState.profiles.find((profile) => profile.id === exercise.profileId)
          ?.nickname ?? "";
      lines.push([
        exercise.localDate,
        name,
        "",
        "",
        "",
        "",
        "",
        "",
        exercise.activityName,
        String(exercise.minutes),
        String(exercise.calories),
      ]);
    });
    downloadFile(
      `轻衡记录-${date}.csv`,
      `\uFEFF${lines.map((row) => row.map(csvCell).join(",")).join("\n")}`,
      "text/csv;charset=utf-8",
    );
  }

  async function installApp() {
    if (!installPrompt) return;
    await (
      installPrompt as Event & { prompt: () => Promise<void> }
    ).prompt();
    setInstallPrompt(null);
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">轻</div>
        <p>正在打开你的轻衡日记…</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">轻</div>
          <div>
            <strong>轻衡</strong>
            <span>家庭体重日记</span>
          </div>
        </div>
        <nav aria-label="主要导航">
          {(Object.keys(VIEW_LABELS) as View[]).map((item) => (
            <button
              className={view === item ? "nav-item active" : "nav-item"}
              key={item}
              onClick={() => setView(item)}
              type="button"
            >
              <span aria-hidden="true" className="nav-icon">{VIEW_ICONS[item]}</span>
              <span>{VIEW_LABELS[item]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="privacy-note">
            <span className="status-dot" />
            你的健康记录默认仅自己可见
          </div>
          {installPrompt && (
            <button className="text-button" onClick={installApp} type="button">
              安装到手机桌面
            </button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="date-navigator">
              <button
                aria-label="前一天"
                onClick={() => changeDate(shiftLocalDate(date, -1))}
                title="前一天"
                type="button"
              >
                ‹
              </button>
              <p className="eyebrow">
                {formatChineseDate(date)}
                {date === currentDate ? " · 今天" : ""}
              </p>
              <button
                aria-label="后一天"
                onClick={() => changeDate(shiftLocalDate(date, 1))}
                title="后一天"
                type="button"
              >
                ›
              </button>
              {selectedDate && (
                <button
                  className="today-jump"
                  onClick={() => changeDate(null)}
                  type="button"
                >
                  回到今天
                </button>
              )}
            </div>
            <h1>
              {activeProfile
                ? `${greetingForHour(clock.getHours())}，${activeProfile.nickname}`
                : "从今天开始，轻松记录"}
            </h1>
          </div>
          <div className="account-actions">
            {activeProfile && (
              <select
                aria-label="切换家庭成员"
                className="profile-switcher"
                onChange={(event) => {
                  updateState((current) => ({
                    ...current,
                    activeProfileId: event.target.value,
                  }));
                  setWeightValue("");
                  setWeightPeriod(new Date().getHours() < 12 ? "morning" : "evening");
                }}
                value={activeProfile.id}
              >
                {appState.profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.nickname}
                  </option>
                ))}
              </select>
            )}
            {user ? (
              <button
                className="user-chip"
                onClick={() => setView("family")}
                title={`账号中心：${user.username}`}
                type="button"
              >
                <span>{user.displayName.slice(0, 1).toUpperCase()}</span>
                已登录
              </button>
            ) : (
              <button
                className="login-button"
                onClick={() => setShowAuthForm(true)}
                type="button"
              >
                登录 / 注册
              </button>
            )}
          </div>
        </header>

        {!activeProfile ? (
          <WelcomePanel onStart={() => setShowProfileForm(true)} />
        ) : (
          <>
            {view === "today" && (
              <TodayView
                activeProfile={activeProfile}
                aiBusy={aiBusy}
                generateInsight={generateInsight}
                getExternalInsightPrompt={externalInsightPrompt}
                importExternalInsight={importExternalInsight}
                insight={latestInsight}
                date={date}
                isToday={date === currentDate}
                key={activeProfile.id}
                metrics={metrics}
                exerciseEstimate={exerciseEstimate}
                exerciseMinutes={exerciseMinutes}
                exercisePresetId={exercisePresetId}
                onAddExercise={addExercise}
                onExerciseDelete={(id) =>
                  updateState((current) => ({
                    ...current,
                    exercises: current.exercises.filter(
                      (entry) => entry.id !== id,
                    ),
                  }))
                }
                onProviderChange={(provider) =>
                  updateState((current) => ({
                    ...current,
                    profiles: current.profiles.map((profile) =>
                      profile.id === activeProfile.id
                        ? { ...profile, aiProvider: provider }
                        : profile,
                    ),
                  }))
                }
                onMealDelete={(id) =>
                  updateState((current) => ({
                    ...current,
                    meals: current.meals.filter((entry) => entry.id !== id),
                  }))
                }
                onOpenMeal={() => setShowMealForm(true)}
                onSaveWeight={saveWeight}
                setWeightPeriod={setWeightPeriod}
                setWeightValue={setWeightValue}
                setExerciseMinutes={setExerciseMinutes}
                setExercisePresetId={setExercisePresetId}
                todayContext={todayContext}
                todayExercises={todayExercises}
                todayMeals={todayMeals}
                todayWeights={todayWeights}
                updateContext={updateContext}
                weightPeriod={weightPeriod}
                weightValue={weightValue}
              />
            )}
            {view === "trends" && activeProfile && (
              <TrendsView
                anchorDate={date}
                currentDate={currentDate}
                meals={appState.meals}
                metrics={metrics}
                onCycleChange={changeDate}
                profile={activeProfile}
                weights={appState.weights}
              />
            )}
            {view === "history" && (
              <HistoryView
                meals={appState.meals}
                profile={activeProfile}
                weights={appState.weights}
              />
            )}
            {view === "family" && (
              <FamilyView
                appState={appState}
                deleteCloudAccount={deleteCloudAccount}
                exportCsv={exportCsv}
                exportJson={exportJson}
                onAdd={() => setShowProfileForm(true)}
                onClear={async () => {
                  await clearState();
                  setAppState(EMPTY_STATE);
                  setShowProfileForm(true);
                }}
                onDelete={(profileId) =>
                  updateState((current) => {
                    const profiles = current.profiles.filter(
                      (profile) => profile.id !== profileId,
                    );
                    return {
                      ...current,
                      profiles,
                      activeProfileId: profiles[0]?.id ?? null,
                      weights: current.weights.filter(
                        (entry) => entry.profileId !== profileId,
                      ),
                      meals: current.meals.filter(
                        (entry) => entry.profileId !== profileId,
                      ),
                      contexts: current.contexts.filter(
                        (entry) => entry.profileId !== profileId,
                      ),
                      exercises: current.exercises.filter(
                        (entry) => entry.profileId !== profileId,
                      ),
                      insights: current.insights.filter(
                        (entry) => entry.profileId !== profileId,
                      ),
                    };
                  })
                }
                logoutAccount={logoutAccount}
                onOpenAuth={() => setShowAuthForm(true)}
                restoreFromCloud={restoreFromCloud}
                syncMessage={syncMessage}
                syncToCloud={syncToCloud}
                user={user}
              />
            )}
          </>
        )}
      </main>

      <nav className="mobile-nav" aria-label="手机导航">
        {(Object.keys(VIEW_LABELS) as View[]).map((item) => (
          <button
            className={view === item ? "active" : ""}
            key={item}
            onClick={() => setView(item)}
            type="button"
          >
            <span aria-hidden="true" className="mobile-nav-icon">{VIEW_ICONS[item]}</span>
            <span>{VIEW_LABELS[item]}</span>
          </button>
        ))}
      </nav>

      {showProfileForm && (
        <ProfileModal
          draft={profileDraft}
          onCancel={
            appState.profiles.length ? () => setShowProfileForm(false) : undefined
          }
          onChange={setProfileDraft}
          onSave={createProfile}
        />
      )}

      {showAuthForm && !user && (
        <AuthModal onClose={() => setShowAuthForm(false)} />
      )}

      {showMealForm && activeProfile && (
        <MealModal
          activeProfile={activeProfile}
          customKcal={customKcal}
          foodGrams={foodGrams}
          foodQuery={foodQuery}
          matchingFoods={matchingFoods}
          mealType={mealType}
          onAdd={addMeal}
          onClose={() => setShowMealForm(false)}
          selectedFood={selectedFood}
          setCustomKcal={setCustomKcal}
          setFoodGrams={setFoodGrams}
          setFoodQuery={(value) => {
            setFoodQuery(value);
            setSelectedFood(null);
          }}
          setMealType={setMealType}
          setSelectedFood={(food) => {
            setSelectedFood(food);
            setFoodQuery(food.name);
          }}
        />
      )}
    </div>
  );
}

function WelcomePanel({ onStart }: { onStart: () => void }) {
  return (
    <section className="welcome-panel">
      <div className="welcome-copy">
        <span className="soft-badge">全家都能用的健康记录</span>
        <h2>每天两次体重，三餐一目了然。</h2>
        <p>
          轻衡把早晚体重、餐食热量和真实趋势放在一起。先记录，不评判；看长期变化，不被一天的数字影响。
        </p>
        <button className="primary-button large" onClick={onStart} type="button">
          30 秒建立第一个档案
        </button>
        <small>游客数据仅保存在当前设备，随时可以登录同步。</small>
      </div>
      <div className="welcome-preview" aria-label="功能预览">
        <div className="preview-header">
          <span>今日状态</span>
          <strong>记录 3/6</strong>
        </div>
        <div className="preview-weight">
          <span>7 日均重</span>
          <strong>62.4 <small>kg</small></strong>
          <em>稳中有序</em>
        </div>
        <div className="preview-bars">
          {[48, 58, 54, 68, 63, 72, 66].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="preview-insight">
          <b>轻衡日报</b>
          <p>单日变化主要来自水分。保持相同时间称重，趋势会更清楚。</p>
        </div>
      </div>
    </section>
  );
}

function TodayView({
  activeProfile,
  aiBusy,
  date,
  exerciseEstimate,
  exerciseMinutes,
  exercisePresetId,
  generateInsight,
  getExternalInsightPrompt,
  importExternalInsight,
  insight,
  isToday,
  metrics,
  onProviderChange,
  onMealDelete,
  onAddExercise,
  onExerciseDelete,
  onOpenMeal,
  onSaveWeight,
  setWeightPeriod,
  setWeightValue,
  setExerciseMinutes,
  setExercisePresetId,
  todayContext,
  todayExercises,
  todayMeals,
  todayWeights,
  updateContext,
  weightPeriod,
  weightValue,
}: {
  activeProfile: Profile;
  aiBusy: boolean;
  date: string;
  exerciseEstimate: ReturnType<typeof calculateExerciseCalories>;
  exerciseMinutes: string;
  exercisePresetId: string;
  generateInsight: (options?: {
    apiKey?: string;
    qwenBaseUrl?: string;
  }) => Promise<string | undefined>;
  getExternalInsightPrompt: () => string;
  importExternalInsight: (
    provider: OnlineAiProvider,
    value: string,
  ) => string;
  insight?: DailyInsight;
  isToday: boolean;
  metrics: ReturnType<typeof dashboardMetrics> | null;
  onProviderChange: (provider: AiProvider) => void;
  onMealDelete: (id: string) => void;
  onAddExercise: () => void;
  onExerciseDelete: (id: string) => void;
  onOpenMeal: () => void;
  onSaveWeight: () => void;
  setWeightPeriod: (period: WeightPeriod) => void;
  setWeightValue: (value: string) => void;
  setExerciseMinutes: (value: string) => void;
  setExercisePresetId: (value: string) => void;
  todayContext?: DailyContext;
  todayExercises: ExerciseEntry[];
  todayMeals: MealEntry[];
  todayWeights: AppState["weights"];
  updateContext: (patch: Partial<DailyContext>) => void;
  weightPeriod: WeightPeriod;
  weightValue: string;
}) {
  const provider = activeProfile.aiProvider ?? "rules";
  const onlineProvider = provider === "rules" ? null : provider;
  const [providerApiKey, setProviderApiKey] = useState("");
  const [qwenBaseUrl, setQwenBaseUrl] = useState(
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  );
  const [connectionMessage, setConnectionMessage] = useState("");
  const [externalPrompt, setExternalPrompt] = useState("");
  const [externalResponse, setExternalResponse] = useState("");

  function chooseProvider(nextProvider: AiProvider) {
    setProviderApiKey("");
    setConnectionMessage("");
    setExternalPrompt("");
    setExternalResponse("");
    onProviderChange(nextProvider);
  }

  async function runConnectedAnalysis() {
    const message = await generateInsight({
      apiKey: providerApiKey,
      qwenBaseUrl,
    });
    setConnectionMessage(message ?? "");
  }

  async function copyExternalPrompt() {
    if (!onlineProvider) return;
    const prompt = getExternalInsightPrompt();
    setExternalPrompt(prompt);
    window.open(AI_CHAT_URLS[onlineProvider], "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(prompt);
      setConnectionMessage(
        `分析提示词已复制；请在 ${AI_PROVIDER_LABELS[onlineProvider]} 官网登录后粘贴发送。`,
      );
    } catch {
      setConnectionMessage("浏览器未允许自动复制，请从下方提示词框手动复制。");
    }
  }

  function importProviderResponse() {
    if (!onlineProvider) return;
    setConnectionMessage(
      importExternalInsight(onlineProvider, externalResponse),
    );
  }

  const special = ["infant", "child", "teen", "pregnant", "postpartum"].includes(
    activeProfile.stage,
  );
  const coreMealsComplete = (["breakfast", "lunch", "dinner"] as MealType[]).every(
    (type) => todayMeals.some((meal) => meal.mealType === type),
  );
  const dayLabel = isToday
    ? "今天"
    : `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
  return (
    <div className="dashboard-grid">
      <section className="card weight-card span-2">
        <div className="card-heading">
          <div><span className="section-kicker">体重记录</span><h2>{dayLabel}称重了吗？</h2></div>
          <div className="completion-pill">{todayWeights.length}/2<span>次</span></div>
        </div>
        <div className="period-toggle">
          {(["morning", "evening"] as WeightPeriod[]).map((period) => {
            const saved = todayWeights.find((entry) => entry.period === period);
            return (
              <button
                className={weightPeriod === period ? "active" : ""}
                key={period}
                onClick={() => {
                  setWeightPeriod(period);
                  setWeightValue(
                    saved
                      ? String(activeProfile.unit === "jin" ? kgToJin(saved.weightKg).toFixed(1) : saved.weightKg)
                      : "",
                  );
                }}
                type="button"
              >
                <span>{period === "morning" ? "早晨" : "晚上"}</span>
                <strong>{saved ? `${activeProfile.unit === "jin" ? kgToJin(saved.weightKg).toFixed(1) : saved.weightKg} ${activeProfile.unit === "jin" ? "斤" : "kg"}` : "待记录"}</strong>
              </button>
            );
          })}
        </div>
        <div className="weight-entry-row">
          <label>
            <span>当前体重</span>
            <div className="number-input">
              <input
                inputMode="decimal"
                min="1"
                onChange={(event) => setWeightValue(event.target.value)}
                placeholder={activeProfile.unit === "jin" ? "例如 124.6" : "例如 62.3"}
                step="0.1"
                type="number"
                value={weightValue}
              />
              <b>{activeProfile.unit === "jin" ? "斤" : "kg"}</b>
            </div>
          </label>
          <button className="primary-button" onClick={onSaveWeight} type="button">
            保存{weightPeriod === "morning" ? "晨重" : "晚重"}
          </button>
        </div>
        <p className="helper-text">尽量在相近时间、相似状态下称重；晚间高于晨间通常是正常日内波动。</p>
      </section>

      <section className="card metrics-card">
        <div className="card-heading compact">
          <div><span className="section-kicker">身体指标</span><h2>{dayLabel}的参考值</h2></div>
          <span className="estimate-badge">估算</span>
        </div>
        <div className="metric-list">
          <Metric
            label="当天平均体重"
            unit="kg"
            value={formatNumber(metrics?.dailyAverageWeightKg ?? null)}
          />
          {metrics?.pediatricZScore !== null && metrics?.pediatricZScore !== undefined ? (
            <Metric label="WHO 年龄别 BMI" unit={describeWhoZScore(metrics.pediatricZScore)} value={`Z ${metrics.pediatricZScore.toFixed(1)}`} />
          ) : activeProfile.stage === "pregnant" ? (
            <Metric label="孕期增重参考" unit="kg" value={metrics?.pregnancyRangeKg ? `${metrics.pregnancyRangeKg[0]}–${metrics.pregnancyRangeKg[1]}` : "补充孕期资料"} />
          ) : (
            <>
              <Metric label="BMI" unit="" value={formatNumber(metrics?.bmi ?? null)} />
              <Metric label="基础代谢" unit="kcal/日" value={formatNumber(metrics?.bmr ?? null, 0)} />
              <Metric label="体脂率" unit="%" value={formatNumber(metrics?.bodyFat ?? null)} />
            </>
          )}
        </div>
        <p className="fine-print">{special ? "特殊阶段只提供成长或变化参考，不给出减脂热量目标。" : `BMI、基础代谢和体脂率均按${metrics?.dailyWeightCount === 2 ? "早晚两次平均体重" : metrics?.dailyWeightCount === 1 ? "当天唯一一次体重" : "当天体重"}计算；体脂估算可能有约 ±4 个百分点误差。`}</p>
      </section>

      <section className="card meals-card span-2">
        <div className="card-heading">
          <div><span className="section-kicker">餐食记录</span><h2>{dayLabel}吃了什么</h2></div>
          <div className="calorie-total"><strong>{Math.round(metrics?.caloriesToday ?? 0)}</strong><span>千卡</span></div>
        </div>
        <div className="meal-sections">
          {(["breakfast", "lunch", "dinner", "snack"] as MealType[])
            .concat(activeProfile.stage === "infant" ? ["feeding"] : [])
            .map((type) => {
              const items = todayMeals.filter((meal) => meal.mealType === type);
              return (
                <div className="meal-section" key={type}>
                  <div>
                    <strong>{MEAL_LABELS[type]}</strong>
                    <span>{items.length ? `${Math.round(items.reduce((sum, item) => sum + item.calories, 0))} 千卡` : "还没有记录"}</span>
                  </div>
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>
                        <span>{item.foodName}<small>{item.grams}g</small></span>
                        <button aria-label={`删除${item.foodName}`} onClick={() => onMealDelete(item.id)} type="button">×</button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
        <button className="add-meal-button" onClick={onOpenMeal} type="button"><span>＋</span> 添加食物</button>
      </section>

      <section className="card context-card">
        <div className="card-heading compact"><div><span className="section-kicker">影响因素</span><h2>给趋势多一点背景</h2></div></div>
        <div className="context-fields">
          <ContextInput label="睡眠" unit="小时" value={todayContext?.sleepHours} onChange={(value) => updateContext({ sleepHours: value })} />
          <ContextInput label="饮水" unit="ml" value={todayContext?.waterMl} onChange={(value) => updateContext({ waterMl: value })} />
        </div>
        <div className="tag-list">
          {CONTEXT_TAGS.map((tag) => {
            const selected = todayContext?.tags.includes(tag) ?? false;
            return (
              <button className={selected ? "selected" : ""} key={tag} onClick={() => updateContext({ tags: selected ? (todayContext?.tags ?? []).filter((item) => item !== tag) : [...(todayContext?.tags ?? []), tag] })} type="button">{tag}</button>
            );
          })}
        </div>
      </section>

      <section className="card exercise-card span-3">
        <div className="card-heading">
          <div>
            <span className="section-kicker">运动记录</span>
            <h2>{dayLabel}动了多少</h2>
          </div>
          <div className="calorie-total burn-total">
            <strong>{Math.round(metrics?.exerciseCaloriesToday ?? 0)}</strong>
            <span>千卡消耗</span>
          </div>
        </div>
        <div className="exercise-entry-grid">
          <label>
            <span>运动项目</span>
            <select value={exercisePresetId} onChange={(event) => setExercisePresetId(event.target.value)}>
              {EXERCISE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} · {preset.detail}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>运动时长</span>
            <div className="number-input compact-number">
              <input
                inputMode="numeric"
                min="1"
                max="600"
                onChange={(event) => setExerciseMinutes(event.target.value)}
                type="number"
                value={exerciseMinutes}
              />
              <b>分钟</b>
            </div>
          </label>
          <div className="exercise-estimate">
            <span>自动估算</span>
            <strong>
              {metrics?.latestWeightKg
                ? exerciseEstimate
                  ? `约 ${Math.round(exerciseEstimate.calories)} 千卡`
                  : "当前年龄暂不估算"
                : "请先记录体重"}
            </strong>
            <small>
              {exerciseEstimate
                ? `${exerciseEstimate.standardLabel} · ${exerciseEstimate.metValue} MET`
                : "6 岁以下或缺少体重时不计算"}
            </small>
          </div>
          <button className="primary-button" disabled={!exerciseEstimate} onClick={onAddExercise} type="button">
            记录这次运动
          </button>
        </div>
        {todayExercises.length > 0 && (
          <div className="exercise-list">
            {todayExercises.map((entry) => (
              <div key={entry.id}>
                <span><strong>{entry.activityName}</strong><small>{entry.minutes} 分钟 · {entry.metValue} MET</small></span>
                <b>约 {Math.round(entry.calories)} 千卡</b>
                <button aria-label={`删除${entry.activityName}`} onClick={() => onExerciseDelete(entry.id)} type="button">×</button>
              </div>
            ))}
          </div>
        )}
        <p className="fine-print source-note">
          运动消耗来自标准 MET/METy 估算，并按记录时的体重计算；真实消耗会受动作效率、强度和设备误差影响。
          <a href="https://pacompendium.com/adult-compendium/" rel="noreferrer" target="_blank">成人标准</a>
          <a href="https://pacompendium.com/older-adult-compendium/" rel="noreferrer" target="_blank">60 岁以上标准</a>
          <a href="https://www.nccor.org/tools-youthcompendium/faqs/" rel="noreferrer" target="_blank">儿童青少年标准</a>
        </p>
      </section>

      <section className="card energy-card span-3">
        <div className="card-heading">
          <div><span className="section-kicker">每日能量账本</span><h2>摄入、基础与运动放在一起看</h2></div>
          {metrics?.energyBalance !== null && metrics?.energyBalance !== undefined && (
            <span className={`balance-badge ${metrics.energyBalance > 100 ? "surplus" : metrics.energyBalance < -100 ? "deficit" : "balanced"}`}>
              {metrics.energyBalance > 100
                ? `当前记录盈余 ${Math.round(metrics.energyBalance)} 千卡`
                : metrics.energyBalance < -100
                  ? `当前记录缺口 ${Math.abs(Math.round(metrics.energyBalance))} 千卡`
                  : "当前记录接近平衡"}
            </span>
          )}
        </div>
        <div className="energy-flow">
          <div><span>已记录摄入</span><strong>{Math.round(metrics?.caloriesToday ?? 0)}</strong><small>千卡</small></div>
          <i>−</i>
          <div><span>基础与日常</span><strong>{metrics?.bmr ? Math.round(metrics.bmr * 1.2) : "—"}</strong><small>BMR × 1.2</small></div>
          <i>−</i>
          <div><span>已记录运动</span><strong>{Math.round(metrics?.exerciseCaloriesToday ?? 0)}</strong><small>千卡</small></div>
          <i>=</i>
          <div className="energy-result"><span>估算能量差</span><strong>{metrics?.energyBalance == null ? "—" : `${metrics.energyBalance > 0 ? "+" : ""}${Math.round(metrics.energyBalance)}`}</strong><small>千卡</small></div>
        </div>
        <p className="energy-direction">
          {special
            ? "特殊阶段不提供热量盈余、缺口或减脂方向判断；运动与饮食建议请和监护人或专业人员确认。"
            : !coreMealsComplete
              ? "早餐、午餐和晚餐尚未完整记录，当前能量差只反映已经填写的内容，暂时不能用来判断会长胖还是变瘦。"
            : metrics?.energyBalance == null
              ? "补充体重和餐食后，才能生成当天的估算能量差。"
              : metrics.energyBalance > 100
                ? "今天的记录偏盈余；如果类似情况长期持续，体重趋势可能偏上升，但单日结果不能代表一定会长胖。"
                : metrics.energyBalance < -100
                  ? "今天的记录偏缺口；如果类似情况长期持续，体重趋势可能偏下降，但单日结果不能代表一定会变瘦。"
                  : "今天的记录接近平衡。是否增减仍应以连续晨重和 7 日均线为准。"}
        </p>
        <p className="fine-print">“基础与日常”采用基础代谢 × 1.2 的保守估算，再单独加上已记录运动，避免与档案中的活动等级重复计算。结果不是医学处方。</p>
      </section>

      <section className="card insight-card span-3">
        <div className="insight-mark">
          {(activeProfile.aiProvider ?? "rules") === "rules" ? "衡" : "AI"}
        </div>
        <div className="insight-content">
          <div aria-label="选择分析方式" className="provider-picker">
            {(Object.entries(AI_PROVIDER_LABELS) as Array<[AiProvider, string]>).map(
              ([value, label]) => (
                <button
                  aria-pressed={provider === value}
                  className={provider === value ? "provider-option active" : "provider-option"}
                  key={value}
                  onClick={() => chooseProvider(value)}
                  type="button"
                >
                  <strong>{label}</strong>
                  <span>
                    {value === "rules"
                      ? "不联网，立即生成"
                      : value === "deepseek"
                        ? "自己的 Key 或官网登录"
                        : "自己的百炼 Key 或官网登录"}
                  </span>
                </button>
              ),
            )}
          </div>

          {onlineProvider ? (
            <div className="ai-connection-grid">
              <section className="ai-method-panel">
                <div>
                  <span className="method-label">方式一 · 直接回到轻衡</span>
                  <h3>用自己的 API Key 分析</h3>
                  <p>分析结果会自动显示在下方，适合经常使用。</p>
                </div>
                <label className="ai-secret-field">
                  <span>{AI_PROVIDER_LABELS[onlineProvider]} API Key</span>
                  <input
                    autoComplete="off"
                    onChange={(event) => setProviderApiKey(event.target.value)}
                    placeholder="请输入自己的 API Key"
                    type="password"
                    value={providerApiKey}
                  />
                </label>
                {onlineProvider === "qwen" && (
                  <label className="ai-secret-field">
                    <span>API Host</span>
                    <input
                      onChange={(event) => setQwenBaseUrl(event.target.value)}
                      placeholder="从百炼创建 Key 时复制 API Host"
                      type="url"
                      value={qwenBaseUrl}
                    />
                  </label>
                )}
                <div className="ai-method-actions">
                  <button
                    className="primary-button"
                    disabled={aiBusy}
                    onClick={() => void runConnectedAnalysis()}
                    type="button"
                  >
                    {aiBusy ? "正在连接…" : `使用 ${AI_PROVIDER_LABELS[onlineProvider]} 分析`}
                  </button>
                  <a href={AI_KEY_URLS[onlineProvider]} rel="noreferrer" target="_blank">
                    获取 API Key
                  </a>
                </div>
                <small>Key 仅保留在当前页面内存中，经轻衡服务器转发给所选 AI；不会写入档案或数据库。</small>
              </section>

              <section className="ai-method-panel">
                <div>
                  <span className="method-label">方式二 · 不使用 API Key</span>
                  <h3>登录 AI 官网分析</h3>
                  <p>轻衡复制今日数据提示词，你在 AI 官网登录并发送，再把结果粘贴回来。</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void copyExternalPrompt()}
                  type="button"
                >
                  复制数据并打开 {AI_PROVIDER_LABELS[onlineProvider]}
                </button>
                {externalPrompt && (
                  <div className="ai-import-flow">
                    <label>
                      <span>已生成的分析提示词</span>
                      <textarea readOnly rows={4} value={externalPrompt} />
                    </label>
                    <label>
                      <span>粘贴 AI 返回的完整内容</span>
                      <textarea
                        onChange={(event) => setExternalResponse(event.target.value)}
                        placeholder="支持纯 JSON 或 ```json 代码块"
                        rows={5}
                        value={externalResponse}
                      />
                    </label>
                    <button
                      className="secondary-button"
                      disabled={!externalResponse.trim()}
                      onClick={importProviderResponse}
                      type="button"
                    >
                      导入这份分析
                    </button>
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="local-analysis-panel">
              <div>
                <strong>本地规则分析</strong>
                <p>只使用轻衡已经计算好的体重、饮食、睡眠和活动规则，不联网，也不需要任何 AI 账号。</p>
              </div>
              <button
                className="secondary-button"
                disabled={aiBusy}
                onClick={() => void generateInsight().then((message) => setConnectionMessage(message ?? ""))}
                type="button"
              >
                {aiBusy ? "分析中…" : insight ? "刷新本地分析" : "生成本地分析"}
              </button>
            </div>
          )}

          {connectionMessage && <p className="ai-connection-message" role="status">{connectionMessage}</p>}
          <div className="card-heading compact">
            <div>
              <span className="section-kicker">
                轻衡日报 · {insight
                  ? AI_PROVIDER_LABELS[insight.provider ?? (insight.source === "rules" ? "rules" : activeProfile.aiProvider ?? "rules")]
                  : AI_PROVIDER_LABELS[activeProfile.aiProvider ?? "rules"]}
              </span>
              <h2>{insight ? insight.summary : "让记录变成看得懂的趋势"}</h2>
            </div>
          </div>
          {insight ? (
            <div className="insight-grid">
              <div><strong>体重趋势</strong><p>{insight.weightReview ?? "继续积累相近条件下的晨重，优先观察长期趋势。"}</p></div>
              <div><strong>饮食回顾</strong><p>{insight.nutritionReview ?? "餐食热量为参考值，完整记录比单个精确数字更重要。"}</p></div>
              <div><strong>睡眠与活动</strong><p>{insight.lifestyleReview ?? "补充睡眠、活动和饮水记录后，分析会更具体。"}</p></div>
              <div><strong>可能因素</strong><ul>{insight.factors.map((factor) => <li key={factor}>{factor}</li>)}</ul></div>
              <div><strong>未来 7 日趋势</strong><p>{insight.prediction}</p></div>
              <div><strong>数据完整度</strong><p>{insight.dataQuality ?? "晨重不足 7 次时不会生成数字预测。"}</p></div>
              <div className="action-panel"><strong>接下来可以做</strong><ol>{insight.actions.map((action) => <li key={action}>{action}</li>)}</ol></div>
            </div>
          ) : <p className="empty-insight">补齐今天的早晚体重、餐食、睡眠和活动后，轻衡会从六个方面生成详细日报。选择本地分析时，所有分析都在网站规则中完成。</p>}
          <p className="safety-note">{insight?.safetyNote ?? "健康内容仅作生活方式参考，不替代专业诊断。"}</p>
        </div>
      </section>
    </div>
  );
}

function TrendsView({ anchorDate, currentDate, meals, metrics, onCycleChange, profile, weights }: {
  anchorDate: string;
  currentDate: string;
  meals: MealEntry[];
  metrics: ReturnType<typeof dashboardMetrics> | null;
  onCycleChange: (date: string | null) => void;
  profile: Profile;
  weights: AppState["weights"];
}) {
  const originDate = localDate(profile.timezone, new Date(profile.createdAt));
  const cycle = fourteenDayCycle(originDate, anchorDate);
  const currentCycle = fourteenDayCycle(originDate, currentDate);
  const recentDates = Array.from({ length: 14 }, (_, index) =>
    shiftLocalDate(cycle.start, index),
  );
  const points = recentDates.map((day) => {
    const dayWeights = weights.filter(
      (entry) => entry.profileId === profile.id && entry.localDate === day,
    );
    return {
      date: day,
      weight: dayWeights.length
        ? dayWeights.reduce((sum, entry) => sum + entry.weightKg, 0) /
          dayWeights.length
        : null,
      calories: meals.filter((entry) => entry.profileId === profile.id && entry.localDate === day).reduce((sum, entry) => sum + entry.calories, 0),
    };
  });
  const cyclePrediction = forecastWeight(
    weights.filter(
      (entry) =>
        entry.profileId === profile.id && entry.localDate <= cycle.end,
    ),
    profile.id,
  );
  const available = points.map((point) => point.weight).filter((value): value is number => value !== null);
  const min = available.length ? Math.min(...available) - 0.5 : 0;
  const max = available.length ? Math.max(...available) + 0.5 : 1;
  const dailyWeightNote =
    metrics?.dailyWeightCount === 2
      ? "按当天早晚平均体重"
      : metrics?.dailyWeightCount === 1
        ? "按当天唯一一次体重"
        : "所选日期尚未记录体重";
  return (
    <div className="page-stack">
      <section className="trend-hero">
        <div>
          <span className="soft-badge">长期趋势比单日数字更重要</span>
          <h2>7 日均重 <strong>{formatNumber(metrics?.sevenDayAverageKg ?? null)} kg</strong></h2>
          <p>{cyclePrediction ? `截至本轮数据为${cyclePrediction.confidence}趋势，预计 7 天后落在 ${cyclePrediction.lowKg}–${cyclePrediction.highKg} kg。` : "再积累一些晨间记录，满 7 次后会出现预测区间。"}</p>
        </div>
        <div className="trend-summary"><span>本轮趋势变化</span><strong>{cyclePrediction ? `${cyclePrediction.weeklyChangeKg > 0 ? "+" : ""}${cyclePrediction.weeklyChangeKg} kg` : "—"}</strong><small>根据晨重均线估算</small></div>
      </section>
      <section className="card chart-card">
        <div className="card-heading">
          <div>
            <span className="section-kicker">第 {cycle.number} 轮 · 14 天记录</span>
            <h2>{formatChineseDate(cycle.start)} — {formatChineseDate(cycle.end)}</h2>
          </div>
          <div className="chart-legend"><span><i className="weight-legend" />体重</span><span><i className="calorie-legend" />热量记录</span></div>
        </div>
        <div className="cycle-controls">
          <button onClick={() => onCycleChange(shiftLocalDate(cycle.start, -14))} disabled={cycle.index === 0} type="button">← 上一轮</button>
          <button onClick={() => onCycleChange(null)} type="button">当前轮</button>
          <button onClick={() => onCycleChange(shiftLocalDate(cycle.start, 14))} disabled={cycle.index >= currentCycle.index} type="button">下一轮 →</button>
          <span>缺少记录的日期保留为空白；用顶部日期按钮可补录任意一天。</span>
        </div>
        <div className="weight-chart" role="img" aria-label="最近十四天体重趋势">
          {points.map((point) => {
            const weightHeight = point.weight === null ? 0 : 18 + ((point.weight - min) / Math.max(0.1, max - min)) * 66;
            const calorieHeight = Math.min(72, (point.calories / 2500) * 72);
            return (
              <div className="chart-column" key={point.date}>
                <div className="chart-area">
                  <i className="calorie-bar" style={{ height: `${calorieHeight}%` }} />
                  {point.weight !== null && <b className="weight-point" style={{ bottom: `${weightHeight}%` }} title={`当天平均 ${point.weight.toFixed(1)} kg`} />}
                </div>
                <span>{point.date.slice(5).replace("-", "/")}</span>
              </div>
            );
          })}
        </div>
        <p className="fine-print">图中体重采用每天已记录的早晚平均值；漏记日期直接留空，不影响进入下一轮。预测仍采用晨重平滑趋势，它是参考区间，不是承诺值。</p>
      </section>
      <div className="metric-cards-row">
        <SummaryCard label={`BMI · ${anchorDate.slice(5).replace("-", "/")}`} note={dailyWeightNote} value={formatNumber(metrics?.bmi ?? null)} />
        <SummaryCard label={`基础代谢 · ${anchorDate.slice(5).replace("-", "/")}`} note={`Mifflin–St Jeor · ${dailyWeightNote}`} value={`${formatNumber(metrics?.bmr ?? null, 0)} kcal`} />
        <SummaryCard label={`体脂率 · ${anchorDate.slice(5).replace("-", "/")}`} note={`Deurenberg · ${dailyWeightNote}`} value={`${formatNumber(metrics?.bodyFat ?? null)}%`} />
        <SummaryCard label="本轮记录天数" note={`第 ${cycle.number} 轮；缺失日期不补零`} value={`${available.length}/14`} />
      </div>
      <section className="formula-note">
        <strong>计算依据</strong>
        <p>BMI = 当天平均体重 ÷ 身高²；基础代谢使用 Mifflin–St Jeor 公式；成人体脂率使用 Deurenberg 的 BMI、年龄与性别估算，误差约 ±4 个百分点。特殊阶段不显示成人体脂或减脂目标。</p>
        <div>
          <a href="https://www.who.int/data/gho/data/indicators/indicator-details/GHO/prevalence-of-obesity-among-adults-bmi--30-%28age-standardized-estimate%29-%28-%29" rel="noreferrer" target="_blank">WHO BMI 定义</a>
          <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" rel="noreferrer" target="_blank">Mifflin–St Jeor 研究</a>
          <a href="https://pubmed.ncbi.nlm.nih.gov/2043597/" rel="noreferrer" target="_blank">Deurenberg 研究</a>
        </div>
      </section>
    </div>
  );
}

function HistoryView({ meals, profile, weights }: { meals: MealEntry[]; profile: Profile; weights: AppState["weights"] }) {
  const dates = Array.from(new Set([
    ...weights.filter((entry) => entry.profileId === profile.id).map((entry) => entry.localDate),
    ...meals.filter((entry) => entry.profileId === profile.id).map((entry) => entry.localDate),
  ].sort((a, b) => b.localeCompare(a))));
  return (
    <div className="page-stack">
      <section className="page-title"><div><span className="section-kicker">历史记录</span><h2>每一天，都有迹可循</h2><p>体重和餐食按日期归档，导出数据可以在“家人”页面完成。</p></div></section>
      <section className="history-list">
        {dates.length ? dates.map((day) => {
          const dayWeights = weights.filter((entry) => entry.profileId === profile.id && entry.localDate === day);
          const dayMeals = meals.filter((entry) => entry.profileId === profile.id && entry.localDate === day);
          const dayMetrics = dashboardMetrics(profile, weights, meals, day);
          return (
            <article className="history-day" key={day}>
              <div className="history-date"><strong>{day.slice(8)}</strong><span>{day.slice(0, 7).replace("-", "年")}月</span></div>
              <div className="history-details">
                <div><span>体重</span><p>{dayWeights.length ? dayWeights.map((entry) => `${entry.period === "morning" ? "晨" : "晚"} ${entry.weightKg}kg`).join(" · ") : "未记录"}</p></div>
                <div><span>餐食</span><p>{dayMeals.length ? `${dayMeals.length} 项 · ${Math.round(dayMeals.reduce((sum, entry) => sum + entry.calories, 0))} 千卡` : "未记录"}</p></div>
                <div>
                  <span>当天指标</span>
                  <p>
                    {dayMetrics.dailyAverageWeightKg
                      ? `均重 ${dayMetrics.dailyAverageWeightKg.toFixed(1)} kg · BMI ${formatNumber(dayMetrics.bmi)} · 基础代谢 ${formatNumber(dayMetrics.bmr, 0)} kcal${dayMetrics.bodyFat == null ? "" : ` · 体脂 ${formatNumber(dayMetrics.bodyFat)}%`}`
                      : "未记录体重"}
                  </p>
                </div>
              </div>
            </article>
          );
        }) : <div className="empty-card"><strong>还没有历史记录</strong><p>从今天的晨重或第一餐开始，轻衡会自动为你归档。</p></div>}
      </section>
    </div>
  );
}

function FamilyView({ appState, deleteCloudAccount, exportCsv, exportJson, logoutAccount, onAdd, onClear, onDelete, onOpenAuth, restoreFromCloud, syncMessage, syncToCloud, user }: {
  appState: AppState;
  deleteCloudAccount: () => void;
  exportCsv: () => void;
  exportJson: () => void;
  logoutAccount: () => void;
  onAdd: () => void;
  onClear: () => void;
  onDelete: (id: string) => void;
  onOpenAuth: () => void;
  restoreFromCloud: () => void;
  syncMessage: string;
  syncToCloud: () => void;
  user: AppUser;
}) {
  return (
    <div className="page-stack">
      <section className="page-title family-title"><div><span className="section-kicker">家庭档案</span><h2>每个人有自己的节奏</h2><p>家庭成员的数据互相独立；儿童与青少年档案由成年人管理。</p></div><button className="primary-button" onClick={onAdd} type="button">添加成员</button></section>
      <section className="profile-grid">
        {appState.profiles.map((profile) => (
          <article className="profile-card" key={profile.id}>
            <div className="profile-avatar">{profile.nickname.slice(0, 1)}</div>
            <div><h3>{profile.nickname}</h3><p>{STAGE_LABELS[profile.stage]} · {profile.heightCm} cm</p><span>{GOAL_LABELS[profile.goalType]} · {ACTIVITY_LABELS[profile.activityLevel]}</span></div>
            <button className="danger-link" onClick={() => { if (window.confirm(`确定删除 ${profile.nickname} 的全部记录吗？`)) onDelete(profile.id); }} type="button">删除</button>
          </article>
        ))}
      </section>
      <div className="settings-grid">
        <section className="card settings-card account-card">
          <span className="section-kicker">账号中心</span>
          <h2>{user ? "账号已登录，可以随时管理" : "注册自己的轻衡账号"}</h2>
          {user ? (
            <>
              <div className="account-email"><span>当前用户名</span><strong>{user.username}</strong><small>云端数据只属于这个账号，其他用户无法读取。</small></div>
              <div className="button-row">
                <button className="secondary-button" onClick={logoutAccount} type="button">退出登录</button>
                <button className="account-delete-button" onClick={deleteCloudAccount} type="button">删除云端账号数据</button>
              </div>
              <p className="fine-print">删除账号会永久删除这个账号名下的云端记录，建议先导出备份。</p>
            </>
          ) : (
            <>
              <p>自己设置用户名和密码，不需要邮箱，也不需要 ChatGPT。以后在手机和电脑上使用同一账号即可读取记录。</p>
              <button className="primary-button inline" onClick={onOpenAuth} type="button">登录或注册账号</button>
              <p className="fine-print">请妥善保存密码：因为不绑定邮箱，首版忘记密码后无法自动找回。</p>
            </>
          )}
        </section>
        <section className="card settings-card">
          <span className="section-kicker">云端同步</span><h2>{user ? "登录状态下可跨设备保存" : "当前是游客模式"}</h2>
          <p>{user ? "云端记录与登录账号绑定，其他账号无法读取。" : "游客记录只在这台设备；登录后可同步到手机和电脑。"}</p>
          {user ? <div className="button-row"><button className="primary-button" onClick={syncToCloud} type="button">同步到云端</button><button className="secondary-button" onClick={restoreFromCloud} type="button">从云端恢复</button></div> : <button className="primary-button inline" onClick={onOpenAuth} type="button">登录并同步</button>}
          {syncMessage && <p className="sync-message">{syncMessage}</p>}
        </section>
        <section className="card settings-card">
          <span className="section-kicker">数据管理</span><h2>随时带走自己的记录</h2><p>导出适合表格查看的 CSV，或完整备份 JSON。</p>
          <div className="button-row"><button className="secondary-button" onClick={exportCsv} type="button">导出 CSV</button><button className="secondary-button" onClick={exportJson} type="button">备份 JSON</button></div>
          <button className="clear-data-button" onClick={() => { if (window.confirm("确定清除这台设备上的全部轻衡记录吗？")) onClear(); }} type="button">清除本机全部数据</button>
        </section>
      </div>
    </div>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const responseText = await response.text();
      let payload: { error?: string } = {};
      if (responseText) {
        try {
          payload = JSON.parse(responseText) as { error?: string };
        } catch {
          payload = {};
        }
      }
      if (!response.ok) throw new Error(payload.error ?? "登录失败");
      window.location.reload();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "账号服务暂时不可用",
      );
      setBusy(false);
    }
  }

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setConfirmation("");
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="auth-title"
        aria-modal="true"
        className="modal auth-modal"
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            <span className="soft-badge">不需要邮箱</span>
            <h2 id="auth-title">{mode === "login" ? "登录轻衡" : "注册轻衡账号"}</h2>
            <p>一个账号只读取自己的家庭档案和记录。</p>
          </div>
          <button aria-label="关闭" onClick={onClose} type="button">×</button>
        </div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} type="button">登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")} type="button">注册新账号</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            用户名
            <input
              autoComplete="username"
              autoFocus
              maxLength={20}
              minLength={3}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="3–20 位中文、字母或数字"
              required
              value={username}
            />
          </label>
          <label>
            密码
            <span className="password-field">
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                maxLength={72}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 位"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? "隐藏" : "显示"}</button>
            </span>
          </label>
          {mode === "register" && (
            <label>
              再次输入密码
              <input
                autoComplete="new-password"
                maxLength={72}
                minLength={8}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type={showPassword ? "text" : "password"}
                value={confirmation}
              />
            </label>
          )}
          {mode === "register" && (
            <div className="guardian-note">这个版本不绑定邮箱。请把用户名和密码保存在安全的地方，忘记密码后暂时无法自动找回。</div>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button large full" disabled={busy} type="submit">
            {busy ? "请稍候…" : mode === "login" ? "登录" : "创建账号并登录"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ProfileModal({ draft, onCancel, onChange, onSave }: {
  draft: Omit<Profile, "id" | "createdAt">;
  onCancel?: () => void;
  onChange: (draft: Omit<Profile, "id" | "createdAt">) => void;
  onSave: () => void;
}) {
  const patch = (value: Partial<Omit<Profile, "id" | "createdAt">>) => onChange({ ...draft, ...value });
  const minor = ["infant", "child", "teen"].includes(draft.stage);
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="profile-title" aria-modal="true" className="modal profile-modal" role="dialog">
        <div className="modal-heading">
          <div><span className="soft-badge">30 秒完成</span><h2 id="profile-title">建立家庭成员档案</h2><p>这些信息只用于选择合适的计算方式。</p></div>
          {onCancel && <button aria-label="关闭" onClick={onCancel} type="button">×</button>}
        </div>
        <div className="form-grid">
          <label>称呼<input autoFocus onChange={(event) => patch({ nickname: event.target.value })} placeholder="例如：妈妈、小明" value={draft.nickname} /></label>
          <label>出生日期<input onChange={(event) => patch({ birthDate: event.target.value })} type="date" value={draft.birthDate} /></label>
          <label>出生性别<select onChange={(event) => patch({ sex: event.target.value as Sex })} value={draft.sex}><option value="female">女</option><option value="male">男</option></select></label>
          <label>身高<span className="input-with-unit"><input inputMode="decimal" onChange={(event) => patch({ heightCm: Number(event.target.value) })} type="number" value={draft.heightCm} /><b>cm</b></span></label>
          <label>当前阶段<select onChange={(event) => { const stage = event.target.value as LifeStage; patch({ stage, goalType: ["infant", "child", "teen"].includes(stage) ? "grow" : stage === "pregnant" ? "pregnancy" : "maintain" }); }} value={draft.stage}>{Object.entries(STAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>体重单位<select onChange={(event) => patch({ unit: event.target.value as WeightUnit })} value={draft.unit}><option value="kg">公斤 kg</option><option value="jin">斤</option></select></label>
          {!minor && draft.stage !== "pregnant" && <>
            <label>活动水平<select onChange={(event) => patch({ activityLevel: event.target.value as ActivityLevel })} value={draft.activityLevel}>{Object.entries(ACTIVITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>目标<select onChange={(event) => patch({ goalType: event.target.value as GoalType })} value={draft.goalType}><option value="maintain">保持状态</option><option value="lose">温和减重</option><option value="gain">健康增重</option></select></label>
          </>}
          {draft.stage === "pregnant" && <>
            <label>预产期<input onChange={(event) => patch({ dueDate: event.target.value })} type="date" value={draft.dueDate ?? ""} /></label>
            <label>孕前体重 kg<input inputMode="decimal" onChange={(event) => patch({ prepregnancyWeightKg: Number(event.target.value) || undefined })} type="number" value={draft.prepregnancyWeightKg ?? ""} /></label>
            <label>胎儿数量<select onChange={(event) => patch({ fetusCount: Number(event.target.value) as 1 | 2 })} value={draft.fetusCount ?? 1}><option value="1">单胎</option><option value="2">双胎</option></select></label>
          </>}
        </div>
        <div className="guardian-note">{minor ? "未成年人档案应由监护人管理；轻衡不会给儿童和青少年提供减脂热量目标。" : "轻衡提供的是记录和趋势参考，不替代医生或营养师。"}</div>
        <button className="primary-button large full" disabled={!draft.nickname.trim()} onClick={onSave} type="button">建立档案并开始记录</button>
      </section>
    </div>
  );
}

function MealModal({ activeProfile, customKcal, foodGrams, foodQuery, matchingFoods, mealType, onAdd, onClose, selectedFood, setCustomKcal, setFoodGrams, setFoodQuery, setMealType, setSelectedFood }: {
  activeProfile: Profile;
  customKcal: string;
  foodGrams: string;
  foodQuery: string;
  matchingFoods: FoodItem[];
  mealType: MealType;
  onAdd: () => void;
  onClose: () => void;
  selectedFood: FoodItem | null;
  setCustomKcal: (value: string) => void;
  setFoodGrams: (value: string) => void;
  setFoodQuery: (value: string) => void;
  setMealType: (value: MealType) => void;
  setSelectedFood: (food: FoodItem) => void;
}) {
  const kcal = selectedFood?.kcalPer100g ?? Number(customKcal);
  const total = ((Number(foodGrams) || 0) * (kcal || 0)) / 100;
  const types: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
  if (activeProfile.stage === "infant") types.push("feeding");
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="meal-title" aria-modal="true" className="modal meal-modal" role="dialog">
        <div className="modal-heading"><div><span className="soft-badge">食物热量均为参考值</span><h2 id="meal-title">添加今天的食物</h2></div><button aria-label="关闭" onClick={onClose} type="button">×</button></div>
        <div className="meal-type-row">{types.map((type) => <button className={mealType === type ? "active" : ""} key={type} onClick={() => setMealType(type)} type="button">{MEAL_LABELS[type]}</button>)}</div>
        <label className="food-search">搜索食物<input autoFocus onChange={(event) => setFoodQuery(event.target.value)} placeholder="例如：米饭、鸡胸肉、苹果" value={foodQuery} /></label>
        <div className="food-results">{matchingFoods.map((food) => <button className={selectedFood?.id === food.id ? "selected" : ""} key={food.id} onClick={() => setSelectedFood(food)} type="button"><span>{food.name}</span><small>{food.kcalPer100g} kcal / 100g</small></button>)}</div>
        {foodQuery.trim() && !selectedFood && <div className="custom-food-row"><span>未选择库内食物？填写每 100g 热量即可保存为自定义食物。</span><label><input inputMode="decimal" onChange={(event) => setCustomKcal(event.target.value)} placeholder="热量" type="number" value={customKcal} />kcal / 100g</label></div>}
        <div className="portion-row"><label>食用重量<span className="input-with-unit"><input inputMode="decimal" onChange={(event) => setFoodGrams(event.target.value)} type="number" value={foodGrams} /><b>g</b></span></label><div><span>本次约</span><strong>{Math.round(total)} 千卡</strong></div></div>
        <button className="primary-button large full" disabled={!foodQuery.trim() || !kcal || !Number(foodGrams)} onClick={onAdd} type="button">添加到{MEAL_LABELS[mealType]}</button>
      </section>
    </div>
  );
}

function ContextInput({ label, onChange, unit, value }: { label: string; onChange: (value?: number) => void; unit: string; value?: number }) {
  return <label>{label}<span><input inputMode="decimal" onChange={(event) => onChange(Number(event.target.value) || undefined)} placeholder="—" type="number" value={value ?? ""} />{unit}</span></label>;
}

function Metric({ label, unit, value }: { label: string; unit: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong>{unit && <small>{unit}</small>}</div>;
}

function SummaryCard({ label, note, value }: { label: string; note: string; value: string }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatChineseDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T12:00:00`));
}
