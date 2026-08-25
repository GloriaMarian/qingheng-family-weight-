# 轻衡

面向家人和朋友的中文体重管理网站。手机优先，同时适配电脑。

本仓库是轻衡后续开发的主仓库。旧目录仅作为迁移前快照保留，新的功能、修复和版本记录都以本仓库为准。

## 已实现

- 每位成员独立记录早晚体重，支持公斤和斤。
- 早餐、午餐、晚餐、加餐与婴幼儿喂养，内置约 150 种常见食物。
- 成人 BMI、Mifflin–St Jeor 基础代谢、Deurenberg 体脂参考。
- WHO 0–5 岁与 5–19 岁 BMI 年龄别参考，孕期采用单独安全规则。
- 7 日均线、趋势区间、历史记录、CSV 与 JSON 导出。
- 游客使用 IndexedDB 本地保存；独立用户名密码账号可通过 D1 或 CloudBase 文档数据库跨设备同步。
- 密码使用带随机盐的 PBKDF2-SHA256 哈希保存，登录会话使用安全 Cookie。
- AI 日报支持本地规则、用户自己的 DeepSeek/千问 API Key，以及官网登录后回填结果；用户 Key 不写入档案或数据库。
- PWA 安装、响应式导航和社交分享卡片。

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
pnpm install
pnpm dev
pnpm test
```

原 Sites 版本的数据库结构在 `db/schema.ts`，迁移文件在 `drizzle/`。腾讯云版本位于 `cloudbase/`，使用同源 HTTP 函数和文档数据库。

## 腾讯云公开版本

- 环境：`qingheng-family-d5fcrhrgab9855c5`（上海）
- 公开地址：<https://qingheng-family-d5fcrhrgab9855c5-1461373093.ap-shanghai.app.tcloudbase.com/>
- 构建前端：`pnpm cloudbase:build`
- 函数检查：`pnpm cloudbase:check`

在线 AI 由用户在“今日”页填写自己的 API Key，或打开 DeepSeek/千问官网登录分析。服务端不再保存共享 API Key，也不会在在线调用失败时悄悄改成本地结果。

如需覆盖默认模型名称，只配置模型名，不要把用户 Key 写入项目文件：

```text
DEEPSEEK_MODEL=deepseek-v4-flash
QWEN_MODEL=qwen-plus
```

健康计算用于生活方式记录与趋势参考，不提供医疗诊断。
