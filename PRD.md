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
