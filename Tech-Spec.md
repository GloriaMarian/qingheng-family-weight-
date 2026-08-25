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

## 2026-08-25 User-Connected AI Design

### Client Contract

- `rules`: generate and save the deterministic `createRuleInsight` result locally.
- `deepseek` / `qwen` with API key: send the selected provider in the JSON body and the ephemeral key in `x-provider-api-key`.
- Qwen may also send `x-provider-base-url`; the server accepts only HTTPS URLs on documented Alibaba Cloud DashScope or `*.maas.aliyuncs.com` hosts.
- The API key exists only in React component memory and is omitted from `AppState`, IndexedDB, D1, CloudBase state, logs, and error messages.

### Provider Calls

- DeepSeek endpoint: `https://api.deepseek.com/chat/completions`; default model `deepseek-v4-flash`.
- Qwen default endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`; default model `qwen-plus`, with an optional validated Model Studio API host.
- Both providers use the existing structured JSON contract and the same health-safety prompt.
- Missing or rejected credentials return an explicit non-2xx error. The server does not substitute a local result for an explicitly selected online provider.

### Official Chat Handoff

- DeepSeek opens `https://chat.deepseek.com/`; Qwen opens `https://chat.qwen.ai/`.
- The browser copies a prompt built from the same daily aggregate used by API analysis.
- Imported text may be plain JSON or a JSON Markdown fence. It is validated against the shared insight schema before saving.

### Verification

1. Unit-test prompt construction and imported result parsing.
2. Test the server-side provider credential and endpoint validation helpers.
3. Run `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm cloudbase:build`, and `pnpm cloudbase:check`.
4. Verify the Today page on desktop and mobile with local, DeepSeek, and Qwen selections.

## 2026-08-25 Cute Theme Implementation

### Scope

- Keep the existing React structure and introduce only a small `VIEW_ICONS` display map for navigation.
- Implement the visual system in `app/globals.css` using design tokens, CSS gradients, generated decorative shapes, and Unicode symbols.
- Reuse existing component classes to give each Today card a distinct pastel accent; do not add an icon package, asset request, or runtime dependency.
- Keep decorative symbols `aria-hidden`; every navigation action retains its visible text and existing accessible label.

### Responsive and Interaction Rules

- Desktop keeps the fixed sidebar and three-column dashboard.
- Mobile keeps the four-item bottom navigation and single-column card flow.
- Interactive controls retain at least the current touch target size, visible keyboard focus, and disabled states.
- Decorative movement is optional and must be disabled by `prefers-reduced-motion`.

### Verification

1. Run lint, automated tests, primary build, CloudBase frontend build, and CloudBase function syntax check.
2. Check generated markup for the navigation icon class and new theme copy-independent hooks.
3. Review responsive breakpoints and overflow-prone grids statically when browser screenshot automation is not authorized.
