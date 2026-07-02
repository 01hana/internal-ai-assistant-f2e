# Project Initialization Baseline

## Summary

本文件記錄 `001-internal-assistant-embedded-chat-panel` 在 Phase 0 Batch B 建立的
Nuxt 4 frontend baseline，供後續 Phase 1 之後的 contract types、session、SSE、
UI implementation 使用。

## Repository State Before Batch B

- `package.json`: missing before this batch
- `nuxt.config.ts`: missing before this batch
- `app.config.ts`: missing before this batch
- `app/` source root: missing before this batch
- `tests/fixtures/assistant-api/README.md`: present from Batch A
- `tests/fixtures/assistant-sse/README.md`: present from Batch A
- `tests/contract/assistant/README.md`: present from Batch A

## Installed Baseline Targets

### Framework and runtime

- Nuxt: `^4.4.8`
- Vue: `^3.5.39`
- TypeScript: `^6.0.3`

### UI and app modules

- `@nuxt/ui`: `^4.9.0`
- `@pinia/nuxt`: `^0.11.3`
- `@nuxt/eslint`: `^1.16.0`
- `vee-validate`: `^4.15.1`

### Testing baseline

- `vitest`: `^4.1.9`
- `@vue/test-utils`: `^2.4.11`
- `@nuxt/test-utils`: `^4.0.3`
- `@playwright/test`: `^1.61.1`
- `vue-tsc`: `^3.3.6`

## Scripts Baseline

Current scripts:

- `prepare`: `nuxt prepare`
- `postinstall`: `nuxt prepare`
- `dev`: `nuxt dev`
- `build`: `nuxt build`
- `preview`: `nuxt preview`
- `typecheck`: `nuxt typecheck`
- `test`: `npm run test:unit && npm run test:component && npm run test:contract`
- `test:unit`: `vitest run tests/unit`
- `test:component`: `vitest run tests/component`
- `test:contract`: `vitest run tests/contract`
- `test:e2e`: `playwright test`
- `lint`: `eslint .`
- `lint:fix`: `eslint . --fix`

## Source Root

- source root is now established as `app/`
- implementation must continue to follow the Batch A source-structure guardrails

## Baseline Files Created

- `package.json`
- `tsconfig.json`
- `.gitignore`
- `nuxt.config.ts`
- `app.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `app/layouts/default.vue`
- `app/error.vue`
- `app/assets/css/main.css`

## Production Directory Baseline

Established or reserved:

- `app/features/assistant/`
- `app/features/assistant/components/`
- `app/features/assistant/composables/`
- `app/services/`
- `app/services/api/`
- `app/stores/assistant/`
- `app/utils/assistant/`
- `app/types/assistant/`

## Reserved Service Roles

- `app/services/index.ts` is reserved as the only shared HTTP client location
- `app/services/api/assistant.ts` is reserved as the only assistant domain service location
- No `AssistantService` methods are implemented in this batch

## Test Baseline Status

Established or confirmed:

- `tests/unit/assistant/`
- `tests/component/assistant/`
- `tests/contract/assistant/`
- `tests/fixtures/assistant-api/`
- `tests/fixtures/assistant-sse/`
- `tests/e2e/`

## Pending / Constraints

- dependencies may still need `npm install` to materialize local toolchain
- lint is placeholder-only in this batch
- no assistant feature logic, components, composables, session, SSE, or service behavior is implemented in this batch
- Tailwind CSS v4 baseline is kept minimal via `app/assets/css/main.css`

## TypeScript / Nuxt Type Environment

### Original issue

- root `tsconfig.json` was missing
- `.nuxt` generated type environment had not been prepared
- editor and `nuxt typecheck` could not resolve Nuxt macro globals such as
  `defineNuxtConfig` and `defineAppConfig`

### Applied fix

- add root `tsconfig.json` with `extends: "./.nuxt/tsconfig.json"`
- add `prepare` and `postinstall` scripts using `nuxt prepare`
- keep Nuxt-generated typing as the source of truth instead of overriding it with
  custom TypeScript path or module-resolution rules

### Local baseline workflow

1. install dependencies
2. run `npm run prepare`
3. verify `.nuxt/tsconfig.json` is generated
4. run `npm run typecheck`

### Guardrails

- do not add custom `compilerOptions` here unless a later phase proves they are
  required and Nuxt-compatible
- if `app.config.ts` still shows schema or type drift after the Nuxt type
  environment is prepared, reduce it to the smallest safe baseline instead of
  preserving large unverified UI schema overrides

### Validation status after cleanup

- `npm run prepare`: passed, `.nuxt/tsconfig.json` generated successfully
- `npm run typecheck`: passed after adding root `tsconfig.json`
- `npm run build`: passed
- `app.config.ts`: no additional schema reduction was required in this cleanup
  batch once the Nuxt type environment was available
- build emitted external font-provider fetch warnings in the restricted network
  environment, but the production build still completed successfully

## ESLint Baseline

### Applied baseline

- use `@nuxt/eslint` as the official Nuxt ESLint integration
- use ESLint flat config only
- keep the root config at `eslint.config.mjs`
- do not use legacy `.eslintrc*`

### Runtime dependency on generated config

- `npm run prepare` generates the Nuxt ESLint baseline at `.nuxt/eslint.config.mjs`
- root `eslint.config.mjs` consumes the generated `withNuxt(...)` helper instead of
  copying generated rules into versioned source

### Scripts

- `lint`: `eslint .`
- `lint:fix`: `eslint . --fix`

### Ignore boundaries

Lint baseline ignores:

- `.nuxt/**`
- `.output/**`
- `node_modules/**`
- `dist/**`
- `coverage/**`
- `playwright-report/**`
- `test-results/**`
- `docs/reference/**`

### Reference UI boundary for lint

- lint baseline does not scan `docs/reference/**`
- reference UI files remain reference-only and are not treated as production
  implementation targets in Phase 0
