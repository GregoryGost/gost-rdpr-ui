# Codex Project Profile

## Activation Semantics

This is the target-project profile for `gost-rdpr-ui`.
Apply `AGENTS.md` and mandatory `.codex/rules/request_routing.md` before task-specific work.
Only exact entries in Active Stack Profiles, Active Rules, Active Skills and enabled specialized sections activate
materials. File presence or a mention in documentation alone does not activate a material.
Read applicable entrypoints and validate their entire hard-dependency closure with
`.codex/rules/material_dependencies.md` before applying them. Intentional mutual rule/skill pairs are permitted.

The current user request controls authorized surfaces and side effects. This profile, rules, skills and role files
cannot broaden that scope. Do not install packages, create commits, publish changes, contact external systems,
or create task/context files merely because an integration is available.
After compaction or resumption, re-establish the bootstrap and applicable entrypoints from source.

## Project Identity

- Project key: `gost-rdpr-ui`
- Workspace: repository root; resolve paths relative to the checkout, never a machine-specific absolute directory.
- Project type: frontend SPA administering the separate GOST-RDPR REST API.
- Primary programming language: TypeScript.
- Secondary programming languages: Vue SFC templates, CSS and component-local SCSS.
- Package and version sources: `package.json`, `pnpm-lock.yaml` and installed package manifests.
- Project documentation: `README.md`, `docs/DEVELOPMENT.md`, `docs/PROJECT_STATUS.md`,
  `docs/PROJECT_HISTORY.md`, `src/composables/README.md`.

## Natural Language Profile

- User-facing answers language: Russian.
- Git commit text language: Russian; follow active `git.md` for commit-text requests.
- Documentation language policy: project-maintained guides in Russian;
  agent bootstrap, profiles and materials in English.
- Test/comment natural language policy: English for comments, docstrings, JSDoc/TSDoc, test descriptions,
  and other explanatory code-adjacent prose. UI text and accessible names are Russian.
- Keep identifiers, library names, protocol names, command names, paths, package names and exact contract values
  in English or their original language.
- Use `comment-language-audit` for prose language and the independently active comment-quality pair for coverage
  and technical accuracy. Neither permits a repository-wide rewrite during a narrow change.

## Agent Roles And Model Selection

- Subagents enabled for authorized executable application/test-code changes and bounded read-only evaluation.
- In `review-only` or `analysis-only`, the primary may assign `code_explorer` or `code_reviewer` to evaluate the
  current application, proposed work, UI/UX findings or existing test coverage when the current request permits it.
  Limit assignments to evidence gathering and findings in the session. File edits, generated artifacts and external
  mutations are outside this scope.
- Documentation-only, comment-only, docstring-only and instruction-only edits stay with the primary.
- Primary agent model/effort: `gpt-6.2-sol / xhigh`; select in the client or local `.codex/config.toml`.
- Mandatory coordination support: `.codex/rules/subagent_coordination.md`.
- Selected role files:

| Role | Custom agent file | Model | Effort |
| --- | --- | --- | --- |
| Architecture: stability | `.codex/agents/architect_stability.toml` | gpt-6.2-sol | xhigh |
| Architecture: evolution | `.codex/agents/architect_evolution.toml` | gpt-6.2-sol | xhigh |
| Codebase research | `.codex/agents/code_explorer.toml` | gpt-6-luna | high |
| Documentation/API research | `.codex/agents/docs_researcher.toml` | gpt-6-luna | high |
| Complex implementation | `.codex/agents/complex_implementer.toml` | gpt-6.2-sol | high |
| Small fixes | `.codex/agents/simple_implementer.toml` | gpt-6-luna | high |
| Independent test engineering | `.codex/agents/test_engineer.toml` | gpt-6.2-sol | high |
| Independent code review | `.codex/agents/code_reviewer.toml` | gpt-6.2-sol | high |
| Difficult bugs / design disputes | `.codex/agents/deep_debugger.toml` | gpt-6.2-astra | xhigh |

- Model availability: verify with the current client/account before dispatch;
  never silently substitute models or effort.
- Fresh thread policy: every assignment uses a new `spawn_agent` with `fork_turns: "none"`; never `followup_task`.
- Subagent handoff persistence: `in-session-only`. Local handoff files and hooks are not enabled.
- Dispatch only relevant roles with bounded original requirements, authorization, verified baseline, applicable
  rules/skills, file ownership, safe commands and required report format.
- Before dependent code/test work explicitly select Architecture Gate `NOT_REQUIRED`, or `PENDING` when both
  architects are appointed. Both the primary and subagents obey the gate.
- `PENDING`, `REOPENED` and architecture `BLOCKED` stop affected downstream planning, scenarios, edits,
  testing and acceptance. Authorized read-only fact gathering and architecture proposals/critique may continue.
- For approval, both architects independently endorse the identical canonical final revision; the primary issues
  a scoped Architecture Handoff with `decision_version`, contracts, ownership and validation obligations.
- When opening or reopening architecture mid-task, interrupt affected agents and verify commands and partial writes
  are quiescent before proceeding. A stop message alone does not prove a pause.
- Test engineer and implementer have disjoint owned paths. Complex, high-impact or security-sensitive code requires
  independent tester and reviewer; explain omission for a bounded low-risk change without waiving project checks.
- Final acceptance requires a stable identified source/test/config snapshot, current gate and required verification.
  A subsequent material change invalidates affected acceptance/review results.
- Distinguish implementation defects from defects in the approved design. Track architecture, testing and review
  statuses independently. Recover the explicit gate and current handoff, when applicable, after compaction.
- Verify exclusive writing ownership or authorized isolation for overlapping sessions. Do not create worktrees,
  commits, CI workflows or external task notes automatically.

## Active Stack Profiles

- `typescript-core`
- `vue3-typescript-vite`
- `vue-router`
- `pinia`
- `vitest-vue-testing`
- `vue-router-testing`
- `pinia-testing`
- `vue-playwright-e2e-testing`
- `eslint-typescript`
- `prettier-formatting`
- `css`
- `css-animation`
- `tailwind-css`
- `scss`
- `ui-ux-validation`
- `playwright-ui-validation-mcp`

## Active Rules

- Required routing rule: `.codex/rules/request_routing.md`
- `source_code_hygiene.md`
- `mark.md`
- `git.md`
- `typescript_core.md`
- `vue3_typescript_vite.md`
- `vue_router.md`
- `pinia.md`
- `vitest_vue_testing.md`
- `vue_router_testing.md`
- `pinia_testing.md`
- `vue_playwright_e2e_testing.md`
- `css.md`
- `css_animation.md`
- `tailwind_css.md`
- `scss_styling.md`
- `ui_ux_validation.md`
- `playwright_ui_validation.md`
- `eslint_typescript.md`
- `prettier_formatting.md`
- `context7_documentation.md`
- `code_comment_quality.md`

Rule filenames above resolve under `.codex/rules/`.
Conditional bootstrap support, independent of this optional list:
`.codex/rules/material_dependencies.md` for hard dependencies and
`.codex/rules/subagent_coordination.md` for all enabled subagent work.

## Active Skills

- `code-comment-quality`
- `comment-language-audit`
- `typescript-core`
- `vue3-typescript-vite-expert`
- `vue-router-expert`
- `pinia-expert`
- `vitest-vue-testing`
- `vue-router-testing`
- `pinia-testing`
- `vue-playwright-e2e-testing`
- `css-expert`
- `css-animation-expert`
- `tailwind-expert`
- `scss-expert`
- `ui-ux-review`
- `apple-hig-design`
- `playwright-ui-checks-mcp`
- `eslint-typescript`
- `prettier-formatting`

Skill names resolve to complete packages under `.agents/skills/<name>/`.

## Build And Validation Commands

Use the declared pnpm version and project-local tools. Do not invent package scripts or download missing tools.
Commands may write generated output only when the current request permits it.

| Purpose | Command / policy |
| --- | --- |
| Install dependencies | `pnpm install --frozen-lockfile`, only when installation is authorized |
| Development server | `pnpm dev`; configured port 5000 |
| Type check | `pnpm type-check`; writes build-info caches under `node_modules/.tmp/` |
| Build | `pnpm build`; includes type check and writes `dist/` |
| Build without type check | `pnpm build-only`; `pnpm build:docker` is also Vite build only |
| Preview | `pnpm preview --host 127.0.0.1 --port 5001 --strictPort` after a successful build |
| Lint without source writes | `pnpm exec eslint .` |
| Existing lint report | `pnpm lint-dry-run`; uses `--fix-dry-run` and writes `lint-result.html` |
| Format changed source only | `pnpm exec prettier --write <explicit changed source paths>` |
| Check changed source formatting | `pnpm exec prettier --check <explicit changed source paths>` |
| Existing broad formatter | `pnpm format` formats all `src/`; do not use for a narrow change |
| Markdown lint | none; review changed project Markdown against `.markdownlint.json` |
| Unit / component tests | `pnpm test`; watch mode: `pnpm test:watch`; coverage: `pnpm test:coverage` |
| Integration tests | `pnpm test tests/integration` |
| Browser E2E | `pnpm test:e2e`; builds a fresh isolated preview and runs Chromium against API fixtures |
| UI validation | active UI/Playwright MCP policies; verify the configured connection; record actual browser coverage |
| Agent-material validation | parse role TOML; verify local references, activation, hard dependencies and import hashes |

For agent-instruction/documentation-only changes, validate the affected materials and links; application build,
lint and browser checks are required only when their inputs or visible behavior change.
Keep imported materials verbatim except for the local adaptations documented below.
Imported materials are excluded from Prettier by `.prettierignore`.
Use `.markdownlint.json` for project-maintained Markdown; do not reformat imported examples or prose wholesale.

## TypeScript / JavaScript Profile

- TypeScript/JavaScript enabled: yes.
- Runtime: browser application; Node.js for Vite, type checking, lint and formatting tools.
- Node.js constraint: `>=26.12.1` from `package.json`; no Node.js backend service in this repository.
- Package manager: `pnpm@12.18.0` from `package.json`; workspace policy in `pnpm-workspace.yaml`.
- TypeScript: `6.0.3`; framework: Vue; build tool: Vite; module format: ESM.
- TypeScript configs: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.e2e.json`.
- Application alias: `@/* -> src/*`; preserve the matching Vite alias.
- Public API types: `src/api/types/`; endpoint wrappers: `src/api/endpoints/`; transport: `src/api/client.ts`.
- Shared constants/UI text: `src/constants.ts`; reusable logic: `src/composables/`.
- Preserve existing public type contracts and inspect consumers; use `unknown` and narrowing for untrusted input.
- Mandatory source documentation: every authored/affected function, method, callback, type, field, variable and
  constant within the affected owned definitions, including locals, destructuring, loops and catch bindings.
  Use English JSDoc/TSDoc or adjacent comments; a group must name and explain every binding.
  Explain verified behavior, constraints, side effects and errors at the needed level of detail.
  Do not add tooling or unrelated documentation rewrites solely to enforce this policy.

## Vue 3 + TypeScript + Vite Profile

- Vue frontend enabled: yes; Vue `3.5.45`; TypeScript in Vue SFCs: yes.
- Build tool: Vite `8.3.8`; Composition API and `<script setup lang="ts">` for new SFCs.
- SFC style policy: Tailwind utilities first; component-local CSS/SCSS only when justified.
- Vue Router enabled: yes, `5.5.0`; hash router: `src/router/index.ts`; shared records: `src/router/routes.ts`.
- History mode: `createWebHashHistory()`; lazy routes, route names and Russian title metadata are public contracts.
- Pinia enabled: yes, `4.1.0`; setup stores in `src/stores/`.
- Persistence: existing theme/settings storage only; no new persistence plugin or cross-tab mechanism implicitly.
- VueUse enabled: no.
- UI primitives: `src/ui/`; shared components: `src/components/`; pages: `src/pages/`.
- UI dependencies: Headless UI `1.7.23`, Heroicons `2.2.0`.
- HTTP contract: current backend
  [OpenAPI specification](https://github.com/GregoryGost/gost-rdpr/blob/develop/docs/OPENAPI.json).
  Retrieve relevant current contracts before changing API behavior; do not infer backend semantics from UI types.
- Development API URL: `/api` proxied by Vite to process `VITE_API_BASE_URL`, default `http://127.0.0.1:4000`;
  the proxy removes the `/api` prefix.
- Production API URL: `import.meta.env.VITE_API_BASE_URL`, then the fallback in `src/constants.ts`.
- Vite config reads proxy environment from `process.env`; do not assume `.env.local` configures that proxy.

## Formatting And Linting Profile

- Prettier enabled: yes, `3.10.1`; config: `.prettierrc.json`; ignore file: `.prettierignore`.
- Source style: 2 spaces, no semicolons, single quotes, print width 120.
- Prettier plugins: existing `prettier-plugin-tailwindcss@0.8.1` only; stylesheet: `src/css/main.css`.
- Tailwind class sorting enabled through Prettier: yes.
- ESLint enabled: yes, `10.14.0`; flat config: `eslint.config.ts`.
- ESLint/Prettier conflict handling: `eslint-config-prettier/flat` after Vue/TypeScript rules.
- Preserve existing Vue/TypeScript lint scopes and globals; do not add typed linting or rule exceptions implicitly.
- Formatter scope policy: changed files only; preserve imported agent materials.
- Markdown config: `.markdownlint.json`; no project-declared automated Markdown lint command.

## Styling Profile

### Plain CSS

- CSS enabled: yes; entry point: `src/css/main.css`, imported in `src/main.ts`.
- CSS Modules enabled: no.
- Tokens: Tailwind v4 `@theme`, CSS custom properties and `currentColor`.
- Browser support policy: `vite.config.ts -> build.target`:
  Chrome/Edge 111+, Firefox 128+, Safari/iOS 16.4+. Build targets do not prove runtime browser validation.
- Use existing layers/tokens and component-local scope; verify modern features against these browser targets.
- Active CSS rule/skill: `css.md + css-expert`.

### CSS Animation / Motion

- CSS animation/motion enabled: yes; existing Vue/Headless UI transitions,
  chart interactions and notification keyframes.
- Motion token source: existing component rules and Tailwind durations; no separate motion-token module.
- Reduced-motion policy: required for new/affected non-trivial motion; existing coverage is not assumed.
- Active CSS animation rule/skill: `css_animation.md + css-animation-expert`.

### Tailwind CSS

- Tailwind enabled: yes, `4.3.5`; integration: `@tailwindcss/vite` in `vite.config.ts`.
- Stylesheet entry point: `src/css/main.css`; theme and dark variant live there.
- Source detection: existing Tailwind integration; use full statically detectable class names.
- Tailwind/SCSS coexistence: separate plain CSS entry for Tailwind v4; never process its directives through Sass.
- Theme: `.dark` variant managed by `src/stores/darkMode.ts`; validate both themes for affected visible changes.
- No BEM or hardcoded pixel styling for new work; prefer existing tokens/utilities.
- Do not infer a separate PostCSS/autoprefixer pipeline from installed packages; the configured integration is Vite.
- Active Tailwind rule/skill: `tailwind_css.md + tailwind-expert`.

### SCSS

- SCSS enabled: yes; Dart Sass `1.108.2`.
- Entry point: component-local `<style lang="scss" scoped>` in `src/components/ErrorNotification.vue`.
- Shared SCSS module policy: `@use/@forward` for new modules; no shared SCSS entry currently.
- Active SCSS rule/skill: `scss_styling.md + scss-expert`.

## UI / Browser Validation Profile

- UI/UX validation enabled: yes; active rule/skill: `ui_ux_validation.md + ui-ux-review`.
- Dev server URL source: `vite.config.ts`; local target `http://127.0.0.1:5000/`.
  Confirm the actual bound port/readiness from runtime output before navigation.
- Hash routes: `/#/`, `/#/dns`, `/#/domains/lists`, `/#/domains`, `/#/ips/lists`,
  `/#/ips`, `/#/ros`, `/#/commands`, `/#/stats`; use only routes relevant to the change.
- Wait targets: affected page heading and its loaded, empty or error state; no fixed sleeps.
- UI checks: Russian text/accessible names, keyboard/focus, light/dark themes, loading/empty/error states,
  responsive layout at 375, 768 and 1440 CSS-pixel widths when relevant.
- Screenshot/artifact path: `.playwright-mcp/`, already ignored by Git; create evidence only when authorized.
- Output directory: `--output-dir .playwright-mcp` in the local MCP configuration.
- Browser session: headless Chrome with `--isolated`.
- MCP process working directory: repository root, explicitly set by `cwd` in local `.codex/config.toml`.
  Resolve output paths from that root and keep explicit artifact filenames under `.playwright-mcp/`.
- Playwright MCP validation enabled: yes, as an agent instruction profile.
- Active Playwright MCP rule/skill: `playwright_ui_validation.md + playwright-ui-checks-mcp`.
- Playwright MCP server name: `playwright`, configured locally through `pnpm dlx @playwright/mcp@latest`.
- Verify client startup and browser operations in the active session before reporting a successful check.
  Browser computer-use tools do not establish a Playwright MCP connection or cross-browser coverage.

## Testing Profiles

The testing and browser profiles are explicitly active as agent rules and skills.
Activation does not install packages, configure runners, connect MCP servers or authorize those side effects.
All required material dependencies are active; runtime/tool availability is tracked separately below.
Report the profile/tooling mismatch when a requested check cannot run; do not silently disable the profile,
invent commands, claim passing tests or install missing tools without authorization.

### Vue Unit / Component Testing

- Vue component testing enabled: yes, as an agent instruction profile.
- Selected and installed test runner: Vitest `5.1.0`; config: `vitest.config.ts`; command: `pnpm test`.
- Vue Test Utils: `2.5.1`; DOM environment: `jsdom@31.0.1`; explicit Vitest API imports, no test globals.
- Pinia testing helper: `@pinia/testing@2.0.2`; use real Pinia for action and persistence tests.
- Coverage: `@vitest/coverage-v8@5.1.0`, `pnpm test:coverage`; reports under `coverage/`.
- Tests: `tests/unit/`, `tests/components/`, `tests/integration/`; fixtures: `tests/fixtures/`;
  cleanup: `tests/setup.ts`. Type checking includes tests through `tsconfig.app.json`.
- Active Vue testing rule/skill: `vitest_vue_testing.md + vitest-vue-testing`.
- Router testing overlay: `vue_router_testing.md + vue-router-testing`.
- Pinia testing overlay: `pinia_testing.md + pinia-testing`.
- Execution status: configured; verify actual command outcomes for the current source/test/config snapshot.

### Vue Playwright E2E Testing

- Vue Playwright E2E enabled: yes, as an agent instruction profile.
- Active Vue Playwright E2E rule/skill: `vue_playwright_e2e_testing.md + vue-playwright-e2e-testing`.
- Installed E2E runner: `@playwright/test@1.65.1`; config: `playwright.config.ts`; command: `pnpm test:e2e`.
- Required browser: Chromium; install separately with `pnpm exec playwright install chromium`.
- Test sources and stateful API fixtures: `e2e/`; separate types: `tsconfig.e2e.json`.
- Web server: `scripts/start-e2e-server.ts` builds in `e2e` mode with `VITE_API_BASE_URL=/api`, then previews
  on loopback port 5001 with strict port binding and an empty proxy. Existing servers are never reused.
- Base URL: `http://127.0.0.1:5001`, verified against server readiness output; routes use hash history.
- Backend isolation: fixtures handle API requests; unexpected API or external requests fail the test.
  No real backend, database, DNS or RIPEstat calls. These checks do not establish real backend integration.
- Artifacts: `playwright-report/`, `test-results/`; traces and screenshots retained on failure.
- Execution status: configured; verify actual outcomes and browser coverage for the current snapshot.
- CI: `.github/workflows/develop-checks.yml` runs on pull requests targeting `develop` only, with locked
  Node.js/pnpm, frozen installation, types, ESLint, coverage, preview build and Chromium E2E.

- Do not treat test-related include globs in `tsconfig*`, ignore entries or old screenshot directories
  as proof of installed test infrastructure.
- No Jest, Node.js service E2E, VueUse testing, or backend testing profile is selected.

## Technical Documentation And Available Interfaces

- Context7 documentation rule: `context7_documentation.md`; configured MCP server: `context7`.
- Use project/installed versions first, then Context7 for the exact relevant library/topic/version.
  When no reliable match exists, use official primary documentation and state remaining verification gaps.
- Keep queries free of credentials, private source and personal data. Credentials remain in the local ignored config.
- VS Code workspace recommendations: `.vscode/extensions.json`.
- Available extension inventory includes Vue (Volar), ESLint, Prettier, Tailwind CSS and markdownlint.
  Installed extensions do not prove active LSP diagnostics or access to Problems/unsaved buffers.
- Agent-accessible LSP/Problems API: unverified; saved-file CLI tools are the available validation boundary.
- Bootstrap inspection on 2026-11-13: Node.js `26.12.1`, Codex CLI `0.169.0-alpha.11.1`;
  installed core package versions matched `package.json` and the lockfile.
- Global pnpm installation: `12.18.0`, verified from the installed package manifest;
  it matches the project's `packageManager` pin. Node.js runtime: `26.12.1`.
- Local agent config: `.codex/config.toml` is ignored and already enables agents with a four-subagent limit.
  A sanitized example is `.codex/config.example.toml`; merge only needed settings when configuring another checkout.
  Do not copy credentials into tracked files.

## Dependency Policy

- Existing dependency source of truth: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`.
- New dependencies require explicit user approval: yes.
- Runtime dependencies policy: preserve exact existing versions; no upgrades or new packages by implication.
- Development dependencies policy: adding runners, DOM environments, browser downloads, linters, plugins or CI
  requires explicit authorization. Installing agent materials alone does not install application dependencies.
- Security-sensitive dependencies and credentials: use verified sources and existing secret boundaries.
- Backend migrations and persistence schemas belong to the separate backend repository; no local database profile
  or database-architect role is selected here.

## Material Provenance And Updates

- Source: [agent-projects-tools](https://github.com/GregoryGost/agent-projects-tools).
- Imported revision: [`v1.22.0`](https://github.com/GregoryGost/agent-projects-tools/tree/v1.22.0),
  commit `29bf0e1b0651a8f9cdc80fdd9faa853b176d2af1` (2026-11-25).
- This profile adapts the applicable parts of the upstream `.codex/project.template.md`.
- Local read-only evaluation policy adapts `AGENTS.md`, `.codex/rules/subagent_coordination.md` and the
  `code_explorer` and `code_reviewer` role files. Review these changes when updating the upstream baseline.
- Local supplement: `eslint-typescript/references/review-checklist.md` supplies a reference missing upstream.
- Update bootstrap, routing, coordination, selected roles and dependent materials together.
  Revalidate exact names, activation signals, dependency closure, references and hashes after an authorized update.
