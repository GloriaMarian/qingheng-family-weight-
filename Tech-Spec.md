# Qingheng Migration Technical Specification

## Source and Destination

- Legacy source: `C:\Users\Administrator\Pictures\Screenshots\weight-family-site`
- Destination repository: `C:\Users\Administrator\Desktop\git`
- Package manager: pnpm, determined by `pnpm-lock.yaml`
- Runtime: Node.js 22.13 or newer, determined by `package.json`

## Transfer Strategy

Use the legacy Git index plus non-ignored working-tree files as the source inventory so committed files and current user changes are both retained. Copy only files that exist on disk.

Explicit exclusions:

- `.git/`
- `.env*` except `.env.example`
- `node_modules/`
- `.vinext/`, `.wrangler/`, `.next/`
- `dist/`, `cloudbase/dist/`, `out/`, `coverage/`
- `dev.stdout.log`, `dev.stderr.log`, and package-manager debug logs
- `*.tsbuildinfo`

The destination `AGENTS.md`, `MEMORY.md`, and `.git/` are retained and updated in place instead of copied from the legacy repository.

## Validation

1. Compare the filtered source inventory with the destination inventory.
2. Confirm the destination Git remote still points to `GloriaMarian/git`.
3. Run `pnpm install --frozen-lockfile` if dependencies are not already available in the destination.
4. Run `pnpm lint`.
5. Run `pnpm test`.
6. Run `pnpm build` if it was not already completed by the test script.
7. Run `pnpm cloudbase:build` and `pnpm cloudbase:check`.
8. Review `git status --short` and the final diff for generated files and sensitive data.

## Rollback

The migration does not alter the legacy project. Before any commit, rollback consists of removing only the newly added destination files while retaining the destination `.git`, `AGENTS.md`, and `MEMORY.md`. No online rollback is required because this task performs no deployment.
