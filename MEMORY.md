# Project Memory

## Repository History

- 2026-08-24: Initialized the local folder as a Git repository.
- 2026-08-24: Created the private GitHub repository `https://github.com/GloriaMarian/git` and pushed `main`.
- 2026-08-24: Migrated the maintainable source state of the Qingheng family weight-management website from `C:\Users\Administrator\Pictures\Screenshots\weight-family-site` into this repository.
- 2026-08-24: The migration included the legacy repository's current working-tree source changes but excluded its `.git`, dependencies, caches, logs, local environment files, and generated output.
- 2026-08-24: This repository is now the primary local source of truth for future Qingheng development. The legacy directory remains unchanged as a fallback snapshot.

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
