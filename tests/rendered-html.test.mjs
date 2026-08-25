import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("构建产物与核心页面已经生成", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
  const [page, layout, app, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/WeightApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /轻衡/);
  assert.match(layout, /全家都能用的体重日记/);
  assert.match(layout, /manifest\.webmanifest/);
  assert.match(app, /建立家庭成员档案/);
  assert.match(app, /登录或注册账号/);
  assert.match(app, /不需要邮箱/);
  assert.match(app, /删除云端账号数据/);
  assert.match(app, /运动记录/);
  assert.match(app, /每日能量账本/);
  assert.match(app, /第 \{cycle\.number\} 轮/);
  assert.match(app, /当天平均体重/);
  assert.match(app, /计算依据/);
  assert.match(app, /DeepSeek/);
  assert.match(app, /用自己的 API Key 分析/);
  assert.match(app, /登录 AI 官网分析/);
  assert.match(app, /不会写入档案或数据库/);
  assert.match(app, /VIEW_ICONS/);
  assert.match(app, /nav-icon/);
  assert.match(styles, /--pink-soft:/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(app, /在线 AI 未配置或暂时不可用时，会自动使用本地分析/);
  assert.doesNotMatch(`${page}${layout}${app}`, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("PWA 与数据库迁移可随版本发布", async () => {
  const [serviceWorker, migration, hosting] = await Promise.all([
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_thick_dragon_man.sql", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(serviceWorker, /qingheng-shell-v1/);
  assert.match(migration, /CREATE TABLE `weight_entries`/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.ok(root);
});

test("运动记录数据库迁移已经生成", async () => {
  const migration = await readFile(
    new URL("../drizzle/0003_dashing_marvel_apes.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE `exercise_entries`/);
});
