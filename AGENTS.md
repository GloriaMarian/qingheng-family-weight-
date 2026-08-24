# Project Instructions

## Project

- Name: `qingheng-family-weight`
- Initialized: 2026-08-24
- Status: Active Qingheng family weight-management web application migrated from `weight-family-site`.

## Stack

- TypeScript, React 19, Next.js 16, Vinext, and Vite.
- pnpm is the only package manager; preserve `pnpm-lock.yaml`.
- OpenAI Sites/Cloudflare uses D1 through Drizzle migrations in `drizzle/`.
- Tencent CloudBase uses the source under `cloudbase/` and the `qingheng-api` function.

## Commands

- `pnpm dev`: start the primary local development server.
- `pnpm lint`: run ESLint.
- `pnpm test`: build and run the automated test suite.
- `pnpm build`: build the primary Sites/Cloudflare target.
- `pnpm cloudbase:build`: build the CloudBase frontend.
- `pnpm cloudbase:check`: syntax-check the CloudBase function.

## Working Rules

- Keep changes minimal and directly tied to the requested goal.
- Preserve unrelated user changes.
- Do not add dependencies, frameworks, or deployment configuration without a concrete requirement.
- Never commit credentials, tokens, private keys, `.env` files, or generated secrets.
- Do not edit generated output under `dist/`, `cloudbase/dist/`, `.vinext/`, or `.wrangler/`; regenerate it from source.
- Do not deploy, change routes, or mutate production data without explicit user authorization.
- Update `MEMORY.md` only with durable project decisions and non-secret operational context.

## Validation

- Run checks appropriate to the files introduced by each change.
- For application changes, prefer `pnpm lint`, focused tests, and the relevant platform build.
- Before committing, review `git status` and the staged diff.
