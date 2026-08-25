# Qingheng Migration PRD

## Objective

Move the existing Qingheng family weight-management website into this repository so this repository becomes the single local source of truth for future development.

## Users and Core Flows

- Family members can register, sign in, and sign out.
- Signed-in users can record and review weight, meals, exercise, hydration, and health trends.
- Existing local, Cloudflare/Sites, and CloudBase source paths remain available until a future platform-consolidation decision is made.

## Migration Scope

- Preserve the destination repository's Git history and GitHub remote.
- Copy the current source state, including uncommitted source changes from the legacy project.
- Preserve the existing pnpm workspace, application architecture, tests, deployment descriptors, and documentation.
- Exclude the legacy `.git` directory, installed dependencies, caches, logs, TypeScript build state, local environment files, and generated deployment output.
- Update project instructions and durable project memory to identify this repository as Qingheng.

## Out of Scope

- No production deployment, route change, cloud resource mutation, database migration, or user-data copy.
- No feature redesign, framework migration, dependency upgrade, or platform consolidation.
- No deletion or modification of the legacy project.

## Acceptance Criteria

1. The destination repository contains the complete maintainable source tree for Qingheng.
2. The destination `.git` directory and `origin` remain unchanged.
3. No secret-bearing `.env` file, dependency directory, cache, log, or generated build output is migrated.
4. The pnpm lockfile remains authoritative and dependencies install without changing the application architecture.
5. Lint, automated tests, the primary production build, and CloudBase source checks pass, or any pre-existing failure is documented with evidence.
6. `AGENTS.md`, `MEMORY.md`, and `README.md` describe the new repository location and development baseline.

## 2026-08-25 AI Connection Upgrade

### Objective

Make the Today page AI analysis genuinely user-controlled instead of presenting three provider labels that silently produce the same local fallback.

### User Flows

- Local analysis runs without a network request, account, or API credential.
- DeepSeek and Qwen users can supply their own provider API key for a structured analysis. The key is kept only in the current page session, forwarded for that request, and never written to application state or the database.
- Users without an API key can copy the same structured analysis prompt, open the provider's official chat site, sign in there, and import the returned JSON into Qingheng.
- Provider failures are shown clearly. Selecting an online provider must not silently relabel a local rules result as online AI.

### Security and Product Constraints

- Qingheng must never collect or proxy DeepSeek or Qwen account passwords.
- No OAuth-style provider login is claimed because neither supported provider documents a third-party chat-account OAuth flow.
- Qwen custom API hosts must be HTTPS endpoints on Alibaba Cloud's documented DashScope or Model Studio domains to prevent arbitrary server-side requests.
- Health analysis remains informational and non-diagnostic.

### Acceptance Criteria

1. The three analysis choices have visibly different instructions and actions.
2. User-supplied API keys are not persisted or logged by application code.
3. DeepSeek and Qwen API errors are actionable and do not silently fall back.
4. Official-chat handoff copies a complete prompt and supports importing a validated structured result.
5. Sites and CloudBase API paths enforce the same credential and endpoint rules.
6. Tests, lint, production build, and CloudBase checks pass before commit.
