# Project Memory

## Repository History

- 2026-08-24: Initialized the local folder as a Git repository.
- 2026-08-24: Created the private GitHub repository `https://github.com/GloriaMarian/git` and pushed `main`.
- 2026-08-24: Migrated the maintainable source state of the Qingheng family weight-management website from `C:\Users\Administrator\Pictures\Screenshots\weight-family-site` into this repository.
- 2026-08-24: The migration included the legacy repository's current working-tree source changes but excluded its `.git`, dependencies, caches, logs, local environment files, and generated output.
- 2026-08-24: This repository is now the primary local source of truth for future Qingheng development. The legacy directory remains unchanged as a fallback snapshot.
- 2026-08-31: Completed the current demo milestone and expanded `README.md` into the GitHub handoff document, covering installation, usage, enforced and recommended inputs, calculated outputs, AI contracts, storage, security, and known limitations. No deployment or remote push was performed.
- 2026-08-31: Pushed the completed demo and Vite preview fix to `main`, then deployed application commit `27138c5` to the existing Tencent CloudBase environment `qingheng-family-d5fcrhrgab9855c5`. The static frontend and `qingheng-api` function were updated without changing the environment, routes, domain, access, or production data.

## Durable Decisions

- The default branch is `main`.
- The GitHub owner for this repository is `GloriaMarian`.
- The project package manager is pnpm and `pnpm-lock.yaml` is authoritative.
- The application currently retains both Sites/Cloudflare and Tencent CloudBase adapters; platform consolidation requires a separate explicit decision.
- Existing production resources and URLs must not be changed merely because the source moved repositories.
- Secrets and local environment files must not be committed.

## Architecture Baseline

- Shared product UI and domain logic live under `app/`.
- Sites/Cloudflare persistence uses `db/`, `drizzle/`, and `worker/`.
- Tencent CloudBase sources live under `cloudbase/`; `cloudbase/dist/` is generated and must not be committed.
- Health calculations are informational lifestyle guidance and must remain non-diagnostic.

## Validation Baseline

- The migration baseline passes the primary Vinext production build and all 22 automated tests.
- The CloudBase frontend build and `qingheng-api` syntax check pass.
- ESLint has no errors; `app/WeightApp.tsx` retains one pre-existing `react-hooks/exhaustive-deps` warning near the insight-generation effect. Resolve it only with focused behavior tests because changing those dependencies can alter generation frequency.
- The 2026-08-24 migration performed no deployment and no production data or route changes.

## Local Entry Points

- The local development URL is `http://localhost:3000/` while the development server is running.
- The existing public Sites deployment is `https://qingheng-family-weight.annestromjsbsjs62727.chatgpt.site`; it was verified active at version 8 on 2026-08-24 without deploying or changing access.
- The current Tencent CloudBase public application URL is `https://qingheng-family-d5fcrhrgab9855c5-1461373093.ap-shanghai.app.tcloudbase.com/`. After the 2026-08-31 deployment, the homepage and `/api/auth/session` both returned HTTP 200 and the live bundle contained the DeepSeek, Qwen, cute-theme, and sticker changes.
- On this host, CloudBase CLI uploads can fail with TLS `ECONNRESET` when inherited proxy variables are active. Removing `HTTP_PROXY`, `HTTPS_PROXY`, and `ALL_PROXY` only for the individual upload process allowed the existing Tencent CloudBase deployment to complete; do not change the user's system proxy settings.
- `打开轻衡网站.cmd` starts the local server with the bundled Codex runtime and opens the site in the default browser.
- The desktop shortcut `打开轻衡网站.lnk` points to that launcher. The repository itself remains at `C:\Users\Administrator\Desktop\git` until the active Codex task releases the directory for a physical rename.

## User-Connected AI

- 2026-08-25: The Today page separates local rules, DeepSeek, and Qwen into genuinely different flows. Online providers use a user-supplied API key or an official-chat copy-and-import handoff; Qingheng never collects provider account passwords.
- User API keys remain only in current React component memory, are forwarded in `x-provider-api-key`, and are not written to `AppState`, IndexedDB, D1, CloudBase state, documentation, or logs.
- Qwen custom API hosts are restricted to documented Alibaba Cloud HTTPS domains. Explicit online-provider failures return actionable errors instead of silently substituting local analysis.
- DeepSeek defaults to `deepseek-v4-flash`; model names may be overridden by non-secret environment variables.

## Visual System

- 2026-08-25: Qingheng uses a warm, cute-but-calm visual direction: cream canvas, strawberry pink, mint, lavender, and peach accents, with rounded cards and soft layered shadows.
- Navigation and section decoration use small Unicode symbols and CSS shapes instead of a new icon dependency or downloaded decorative assets. Symbols remain supplementary to text labels and do not replace accessible names.
- Functional hierarchy, health-content readability, desktop/mobile layout structure, and reduced-motion behavior take priority over decoration.
- 2026-08-25: Decorative stickers are implemented as accessible-hidden React markup and CSS using emoji glyphs, pastel paper borders, and reserved card-corner space. They must remain non-interactive, dependency-free, and secondary to health content.
