# Module Boundaries

## Purpose

本文件定義 Internal Assistant Embedded Chat Panel 的 production module boundaries，
避免 assistant 專屬邏輯被放錯層，或把 reference UI / public chatbot semantics 混入
正式實作。

## Target Structure

```txt
pages/
features/assistant/
components/
composables/
services/index.ts
services/api/assistant.ts
stores/assistant/
utils/assistant/
types/assistant/
tests/unit/assistant/
tests/component/assistant/
tests/contract/assistant/
tests/fixtures/assistant-api/
tests/fixtures/assistant-sse/
```

## Actual Baseline After Phase 0 Batch B

- source root has been established as `app/`
- `app/services/index.ts` has been reserved as the only shared HTTP client location
- `app/services/api/assistant.ts` has been reserved as the only assistant domain service location
- this batch only establishes file locations and baseline skeletons
- this batch does **not** implement `AssistantService` methods, shared HTTP client logic, SSE parsing, or session behavior

## Layer Responsibilities

### `pages/`

- 只負責 route-level page assembly、layout entry、demo / playground entry
- MUST NOT 放 assistant 子元件
- MUST NOT 承載 assistant orchestration logic

### `features/assistant/`

- assistant widget UI / feature-local composables 的唯一落點
- 包含 widget shell、message renderers、input、session UI orchestration

### `components/`

- 只放跨 domain 共用 UI primitives
- MUST NOT 放 assistant 專屬 UI

### `composables/`

- 只放跨 domain 共用 composables
- MUST NOT 放 assistant 專屬 orchestration

### `services/index.ts`

- 專案唯一 shared HTTP client
- 可負責 baseURL、default headers、extra headers merge、JSON request、stream request、
  AbortSignal、error envelope handling
- MUST NOT 含 assistant UI 邏輯

### `services/api/assistant.ts`

- assistant domain service 唯一入口
- 對應 backend assistant contract 的 REST / SSE surface
- MUST NOT 含 component / store 邏輯

### `stores/assistant/`

- 放 assistant widget / session / message 共享 state

### `utils/assistant/`

- 只放 pure functions / parser / sanitizer / mapper / resolver
- MUST NOT 放 component logic

### `types/assistant/`

- 只放 contract-first types 與 UI normalized models
- MUST NOT 放 runtime side effects

### `tests/...`

- `tests/unit/assistant/`: pure logic / parser / mapper / resolver / store unit tests
- `tests/component/assistant/`: component behavior tests
- `tests/contract/assistant/`: contract-oriented tests
- `tests/fixtures/assistant-api/`: REST fixtures
- `tests/fixtures/assistant-sse/`: SSE fixtures

## Forbidden Placements

以下路徑或做法明確禁止：

- `app/lib/assistant/`
- `app/components/assistant/cards/`
- assistant 專屬 UI 放進 shared `components/`
- assistant 專屬 orchestration 放進 shared `composables/`

## Architecture Rules

1. `pages/` 不放 assistant 子元件。
2. `components/` 不放 assistant 專屬 UI。
3. `composables/` 不放 assistant 專屬 orchestration。
4. `features/assistant/` 才放 assistant widget UI / feature-local composables。
5. `services/index.ts` 不含 assistant UI 邏輯。
6. `services/api/assistant.ts` 不含 component / store 邏輯。
7. `utils/assistant/` 只放 pure functions / parser / sanitizer / mapper。
8. `types/assistant/` 只放 contract-first types 與 UI normalized models。

## Assistant-Specific Placement Summary

- assistant widgets / message renderers -> `app/features/assistant/components/`
- assistant orchestration -> `app/features/assistant/composables/`
- assistant service calls -> `app/services/api/assistant.ts`
- shared HTTP transport -> `app/services/index.ts`
- assistant pure logic -> `app/utils/assistant/`
- assistant types -> `app/types/assistant/`
- assistant shared state -> `app/stores/assistant/`
