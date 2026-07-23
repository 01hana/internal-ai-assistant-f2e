# Tasks: Internal Assistant Embedded SDK Package

**Input**: `spec.md`, `design.md`, `plan.md`  
**Prerequisites**: Frontend 002 accepted spec/design/plan; Frontend 001 existing runtime; Backend 001 public contract handoff.  
**Tests**: Test-first. Every feature phase must create contract / unit / component / integration tests before implementation.  
**Organization**: Tasks are grouped by Frontend 002 plan phases. Frontend 001 remains the product behavior and regression baseline through the Frontend 001 Nuxt Adapter. `packages/assistant-runtime/**` becomes the single reusable canonical runtime implementation owner during Phase 11 extraction. Frontend 002 owns the SDK/public integration, lifecycle, security, transport-adapter, and package artifact boundaries.

## Format: `[ID] [P?] [US?] Description`

- **[P]**: Can run in parallel only when files and dependencies do not overlap.
- **[US]**: Included when the task clearly maps to a spec User Story.
- **Paths**: Each task names exact primary file paths. No task relies on a vague glob as its only path.
- **Task detail rule**: Each task includes primary path, dependencies, completion condition, and validation method.

## Product Positioning

```text
Frontend 001 Nuxt Adapter
= Nuxt / app-specific integration、product behavior baseline、
  regression expectations、Nuxt runtime config、Nuxt HTTP/auth/headers、
  route/page/layout/theme integration

Shared Canonical Assistant Runtime
= packages/assistant-runtime/**、
  reusable canonical assistant implementation、
  session / history orchestration、canonical SSE parser and stream lifecycle、
  retry / cancel / timeout / interrupted state、AnswerDecision / safe outcomes、
  EvidenceRef、feedback、ActionDraft / confirmation、ApprovalRequest display、
  Pinia stores / runtime controller、library-safe canonical Vue UI

Frontend 002 SDK Adapter
= npm package / SDK、Host App integration contract、
  public SDK API、provider / configuration / callbacks、
  request / security adapter、Compatibility Mode omission、
  default / injected transport adapter、session / lifecycle adapter、
  public component / mount integration 與 package compatibility
```

Frontend 002 不是新的聊天產品，也不是 Frontend 001 runtime 的 fork。Phase 11 的目標不是把 Frontend 001 app source 直接包入 SDK，而是將 canonical reusable implementation 抽取到 `packages/assistant-runtime/**`，再由 Frontend 001 與 Frontend 002 透過各自 adapter 使用同一 shared runtime。

Frontend 002 只能封裝與整合 shared canonical runtime 與 SDK adapter 能力，不得重新實作 ChatWidget、assistant API client contract、SSE parser、session / history pipeline、AnswerDecision mapping、EvidenceRef rendering、feedback flow、ActionDraft confirmation、ApprovalRequest display behavior、retry / cancel / timeout / interrupted behavior。

SSE ownership 的意思是：Shared Canonical Assistant Runtime owns the canonical SSE parser, stream event model, stream lifecycle, and retry / cancel / timeout / interrupted flow. Frontend 001 Nuxt Adapter provides Nuxt / app transport capability and does not own a second parser. Frontend 002 SDK Adapter provides request / security / default or injected transport capability and must not parse SSE into a second contract or own a second parser. Phase 11 final SDK code must not directly import `app/utils/assistant/assistantSseParser.ts` or `app/features/assistant/composables/useAssistantSseStream.ts`; historical Phase 2 / Phase 5 seams are baseline records to migrate toward `packages/assistant-runtime/**`.

Packaging boundary 的意思是：SDK package artifact must be installable by consuming apps without requiring Frontend 001 internal app paths. Historical Phase 2 source-time `app/**` bridge seams were early reuse / no-fork guardrails, not the final Phase 11 SDK architecture. Phase 11新增或修改的 Frontend 002 SDK code 不得 import `app/**`; it may consume only `packages/assistant-runtime/**`, approved internal shared-runtime entries, and Frontend 002-owned public/internal adapter modules. Published / installed package consumers must use `@internal-ai-assistant/assistant-sdk` and `@internal-ai-assistant/assistant-sdk/styles.css` public entries only, and SDK source graph / dist must retain no active Frontend 001 internal path dependency.

## Validation Command Policy

- Package manager: npm.
- Evidence: `package-lock.json` exists; `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, and `pnpm-workspace.yaml` were not found.
- T012 workspace registration path: root `package.json`.
- Available scripts: `test`, `test:unit`, `test:component`, `test:contract`, `test:e2e`, `typecheck`, `build`, `lint`.
- Initial missing scripts at T001: `test:integration`, `test:style`, SDK package build script, Backend 002 gated integration script.
- Current status after Phase 10: SDK package build script is available through the implemented Phase 10 package setup.
- `test:integration`, `test:style`, and Backend 002 gated integration commands may still require direct Vitest execution or `/private/tmp` temporary config routing unless dedicated scripts are added later.
- Contract tests use `npm run test:contract -- <pattern>`.
- Unit tests use `npm run test:unit -- <pattern>`.
- Component tests use `npm run test:component -- <pattern>`.
- Do not hard-run missing scripts; integration/style/gated commands must be added or explicitly routed by later package setup before use.
- Backend 002 gated tests do not block Independent Package Readiness.

## User Story / Phase Mapping

| Phase    | Focus                                                                                              | Primary User Stories |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| Phase 0  | Contract and Architecture Guardrails                                                               | US5, US8             |
| Phase 1  | Workspace Package Skeleton and Public Exports                                                      | US1                  |
| Phase 2  | Historical Runtime Reuse Seams and Guardrails                                                      | US5                  |
| Phase 3  | Provider / Configuration / Callbacks Boundary                                                      | US2, US6, US8        |
| Phase 4  | Request Builder Modes and Sanitization                                                             | US2, US3, US8        |
| Phase 5  | Historical Transport Seam and SSE Integration Baseline                                             | US5, US8             |
| Phase 6  | Session Ownership, Fallback and Lifecycle                                                          | US4, US8             |
| Phase 7  | Host Events, Styling and Reference Consumer                                                        | US1, US6, US7        |
| Phase 8  | Backend 001 Compatibility Mode Smoke and Regression Gates                                          | US1, US5, US7        |
| Phase 9  | Host Integration-dependent Smoke Gates                                                             | US9                  |
| Phase 10 | Package Artifact Release Boundary Validation                                                       | US1, US5, US7        |
| Phase 11 | Canonical Runtime Library-Safe Extraction, Adapter Migration and Productized SDK Publish Readiness | US1, US5, US7, US8   |

## Phase 0: Contract and Architecture Guardrails

**Purpose**: 在 package 建立前先鎖定不可違反的架構邊界。  
**Independent Test**: Guard tests fail if SDK introduces a second runtime, leaks forbidden backend authority fields, or exposes deep imports.

### Tests First

- [x] T001 [P] Inspect repository package manager and validation scripts in `package.json`; depends on accepted spec/design/plan plus `package-lock.json`, `vitest.config.ts`, `playwright.config.ts`, and `nuxt.config.ts`; complete when execution report confirms package manager, available scripts, missing scripts, and T012 workspace registration path; validate by comparing reported findings with the Validation Command Policy section.
- [x] T002 [P] [US5] Add public package boundary architecture guard tests in `tests/contract/assistant-sdk/public-boundary.spec.ts`; depends on T001 and accepted spec/design/plan; complete when tests assert root exports only and no Frontend 001 internal deep import contract; validate with `npm run test:contract -- public-boundary`.
- [x] T003 [P] [US5] Add no-second-runtime architecture guard tests in `tests/unit/assistant-sdk/no-second-runtime.spec.ts`; depends on T001 and Frontend 001 baseline files; complete when tests detect duplicate ChatWidget, API client, SSE parser, session/history runtime, AnswerDecision mapper, EvidenceRef renderer, feedback/action/approval runtime; validate with `npm run test:unit -- no-second-runtime`.
- [x] T004 [P] [US8] Add forbidden backend authority field guard tests in `tests/unit/assistant-sdk/security/forbidden-outgoing-fields.spec.ts`; depends on T001 and FR-050/FR-051; complete when tests cover `sourceSystem`, connector, adapter, dataSource, candidate tools, permission results, evidence source, raw evidence, routing hints, approval navigation metadata, token, credential, secret; validate with `npm run test:unit -- forbidden-outgoing-fields`.
- [x] T005 [P] [US8] Add frontend mode boundary guard tests in `tests/contract/assistant-sdk/mode-boundary.spec.ts`; depends on T001 and Backend 001 contract notes; complete when tests assert modes are frontend integration / request-builder / provider validation modes, not backend request modes, and no nested `hostContext` or backend `sessionScope`; validate with `npm run test:contract -- mode-boundary`.

### Implementation

- [x] T006 [US5] Create architecture guard fixture manifest in `tests/fixtures/assistant-sdk/architecture-guardrails.ts`; depends on T002-T005; complete when manifest lists canonical Frontend 001 runtime paths and forbidden duplicated modules; validate by importing it from all Phase 0 guard tests.
- [x] T007 [US8] Create forbidden outgoing fields fixture in `tests/fixtures/assistant-sdk/forbidden-fields.ts`; depends on T004; complete when fixture enumerates all backend-owned authority fields and local-only fields; validate by reusing it in security and request builder tests.

**Checkpoint**: Architecture guardrails are testable before workspace package implementation begins.

## Phase 1: Workspace Package Skeleton and Public Exports

**Purpose**: 建立 `@internal-ai-assistant/assistant-sdk` workspace package skeleton。  
**Independent Test**: Consumer can resolve public root entry, public types, and stylesheet entry without importing internal package source.

### Tests First

- [x] T008 [P] [US1] Add public export contract tests in `tests/contract/assistant-sdk/public-exports.spec.ts`; depends on T002; complete when tests assert `AssistantWidget`, `mountAssistantWidget`, provider/config/callback/event/session/transport/safe error/sanitized context types are reachable from root entry; validate with `npm run test:contract -- public-exports`.
- [x] T009 [P] [US1] Add stylesheet export contract tests in `tests/contract/assistant-sdk/stylesheet-entry.spec.ts`; depends on T002; complete when tests assert `@internal-ai-assistant/assistant-sdk/styles.css` resolves as explicit public entry; validate with `npm run test:contract -- stylesheet-entry`.
- [x] T010 [P] [US1] Add peer dependency boundary tests in `tests/unit/assistant-sdk/peer-dependency-boundary.spec.ts`; depends on package naming decision; complete when tests fail on bundled duplicate Vue runtime or missing diagnosable peer warnings; validate with `npm run test:unit -- peer-dependency-boundary`.

### Implementation

- [x] T011 [US1] Create SDK package manifest in `packages/assistant-sdk/package.json`; depends on T008-T010; complete when package name is `@internal-ai-assistant/assistant-sdk`, exports root and `./styles.css`, and declares Vue/Nuxt as peer dependency boundary; validate with public export contract tests.
- [x] T012 [US1] Add npm workspace package registration in `package.json`; depends on T011; complete when `packages/assistant-sdk` is discoverable as `@internal-ai-assistant/assistant-sdk` by npm workspace resolution; validate with package-manager command from Validation Command Policy.
- [x] T013 [US1] Create Vite library config in `packages/assistant-sdk/vite.config.ts`; depends on T011-T012; complete when config supports Vue SFC library output and does not bundle a second Vue runtime; validate with peer dependency boundary tests.
- [x] T014 [US1] Create public root entry in `packages/assistant-sdk/src/index.ts`; depends on T011-T012; complete when only formal public API and public types are exported; validate with public export contract tests.
- [x] T015 [P] [US1] Create public type barrel in `packages/assistant-sdk/src/types/public.ts`; depends on T014; complete when public provider/config/callback/event/session/transport/safe error/sanitized context types have stable names; validate with type import assertions in `tests/contract/assistant-sdk/public-exports.spec.ts`.
- [x] T016 [P] [US1] Create stylesheet entry in `packages/assistant-sdk/styles.css`; depends on T009; complete when file provides package root styling hooks without global reset; validate with stylesheet entry contract tests.
- [x] T017 [US1] Create component shell export in `packages/assistant-sdk/src/components/AssistantWidget.vue`; depends on T014; complete when component is SSR import-safe and delegates runtime behavior to later reusable boundary; validate with component mount tests added in Phase 7.
- [x] T018 [US1] Create imperative mount helper shell in `packages/assistant-sdk/src/mountAssistantWidget.ts`; depends on T014; complete when helper exposes idempotent mount handle shape without creating a second Vue app for Nuxt component usage; validate with public export contract tests.

**Checkpoint**: SDK package skeleton and public entries exist without implementing a second runtime.

## Phase 2: Runtime Reuse Boundary and Frontend 001 Extraction Points

**Purpose**: 讓 Frontend 002 能使用 Frontend 001 runtime，而不是複製 runtime。  
**Independent Test**: SDK runtime entry wraps canonical Frontend 001 behavior and Frontend 001 regression tests remain valid.

**Historical Scope Note**: Phase 2 completed early runtime reuse contracts, source-time adapter seams, no-fork / no-second-runtime guardrails, and initial SDK integration points. Phase 2 did not complete `packages/assistant-runtime/**`, library-safe canonical source extraction, Nuxt dependency removal, vue-tsc-safe declaration boundaries, or full SDK source graph removal of `app/**` imports. Phase 11 is not a rerun of Phase 2; it adds the missing Canonical Runtime Library-Safe Extraction prerequisite discovered after package artifact work.

**Packaging Boundary Note**: Phase 2 adapter seams historically allowed source-time Frontend 001 app source references inside this monorepo as early reuse seams. Those seams must remain internal-only and must not become package public exports, consumer deep imports, or unresolved `app/features` / `app/services` / `app/stores` / `app/utils` imports in the built SDK artifact. Phase 11 must migrate active SDK runtime reuse to `packages/assistant-runtime/**` or approved shared-runtime entries and must not preserve active SDK `app/**` dependency as the final architecture.

### Tests First

- [x] T019 [P] [US5] Add ChatWidget reuse boundary tests in `tests/component/assistant-sdk/runtime-reuse.spec.ts`; depends on T003 and T017; complete when tests assert `AssistantWidget` wraps canonical `app/features/assistant/components/ChatWidget.vue` behavior, not a copied widget; validate with `npm run test:component -- runtime-reuse`.
- [x] T020 [P] [US5] Add composable reuse tests in `tests/unit/assistant-sdk/runtime-composables-reuse.spec.ts`; depends on T003; complete when tests assert use of `useChat.ts`, `useAssistantSession.ts`, and `useAssistantSseStream.ts` boundaries; validate with `npm run test:unit -- runtime-composables-reuse`.
- [x] T021 [P] [US5] Add service/store/helper reuse tests in `tests/unit/assistant-sdk/runtime-services-reuse.spec.ts`; depends on T003; complete when tests assert reuse of `app/services/api/assistant.ts`, `app/stores/assistant/useChatWidgetStore.ts`, `app/stores/assistant/useSessionStore.ts`, and assistant utils; validate with `npm run test:unit -- runtime-services-reuse`.

### Implementation

- [x] T022 [US5] Create package runtime bridge in `packages/assistant-sdk/src/runtime/frontend001Runtime.ts`; depends on T019-T021; complete when bridge references canonical Frontend 001 runtime entry points without copying implementation; validate with runtime reuse tests.
- [x] T023 [US5] Add stable ChatWidget adapter seam in `packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts`; depends on T019; complete when SDK internal adapter references canonical Frontend 001 `app/features/assistant/components/ChatWidget.vue` without copying ChatWidget template, ChatPanel, message rendering pipeline, feedback, action, approval, session, or SSE runtime; validate with runtime reuse tests and public boundary tests.
- [x] T024 [US5] Add stable chat composable adapter seam in `packages/assistant-sdk/src/runtime/composableAdapter.ts`; depends on T020; complete when SDK internal adapter references canonical Frontend 001 `useChat.ts`, `useAssistantSession.ts`, and `useAssistantSseStream.ts` boundaries without creating duplicate composables or local retry / cancel / interrupted runtime; validate with composable reuse tests and no-second-runtime tests.
- [x] T025 [US5] Add stable session lifecycle adapter seam in `packages/assistant-sdk/src/runtime/sessionAdapter.ts`; depends on T020 and T024; complete when SDK internal adapter references canonical Frontend 001 session lifecycle owner without creating duplicate session/history runtime, `useAssistantSession.ts`, `useSessionStore.ts`, `useSessionHistory.ts`, cursor pagination, retry/cancel/interrupted state machine, or fallback session implementation; validate with runtime composables reuse tests and no-second-runtime tests.
- [x] T026 [US5] Add stable SSE stream adapter seam in `packages/assistant-sdk/src/runtime/sseStreamAdapter.ts`; depends on T020 and T024; complete when SDK internal adapter references canonical Frontend 001 SSE stream owner without creating duplicate `useAssistantSseStream.ts`, `assistantSseParser.ts`, SSE event loop, token/done/error/interrupted/approval_required parsing, or mode-specific SSE parser; validate with runtime composables reuse tests, runtime services reuse tests, and no-second-runtime tests.
- [x] T027 [US5] Add stable assistant service adapter seam in `packages/assistant-sdk/src/runtime/serviceAdapter.ts`; depends on T021; complete when SDK internal adapter references canonical Frontend 001 assistant service shape without creating a second assistant API client, backend proxy, transport, request builder, `fetchAssistant`, `sendAssistantMessage`, or `createAssistantClient`; validate with runtime services reuse tests and no-second-runtime tests.
- [x] T028 [US5] Add stable assistant type/helper adapter seam in `packages/assistant-sdk/src/runtime/assistantTypeAdapter.ts`; depends on T021 and T027; complete when SDK internal adapter can reference canonical Frontend 001 assistant public types/helpers needed by runtime bridge without deep-importing private internals from public SDK entry, exposing adapter internals, or duplicating AnswerDecision, EvidenceRef, renderer, feedback, action, or approval types; validate with typecheck, runtime services reuse tests, and public boundary tests.

**Checkpoint**: Phase 2 historical reuse seams and no-fork guardrails are established. Phase 11 will migrate these seams to the shared runtime boundary and must not retain active SDK `app/**` dependencies as the final package architecture.

## Phase 3: Provider / Configuration / Callbacks Boundary

**Purpose**: 實作 public integration contracts。  
**Independent Test**: Provider is request-scoped and async; WidgetConfiguration and HostCallbacks remain local-only; callback failures are isolated.

### Tests First

- [x] T029 [P] [US2] Add provider resolution tests in `tests/unit/assistant-sdk/host-context-provider.spec.ts`; depends on T015; complete when tests cover async resolve, re-resolve before send/retry, failure safe error, and stale context rejection; validate with `npm run test:unit -- host-context-provider`.
- [x] T030 [P] [US8] Add provider/config/callback serialization boundary tests in `tests/unit/assistant-sdk/security/local-only-boundary.spec.ts`; depends on T007 and T015; complete when tests reject WidgetConfiguration, HostCallbacks, callbacks, tokens, credentials, local UI state, and `sessionScope` from outgoing request; validate with `npm run test:unit -- local-only-boundary`.
- [x] T031 [P] [US6] Add callback exception isolation tests in `tests/unit/assistant-sdk/host-callbacks.spec.ts`; depends on T015; complete when callback throw does not crash assistant runtime and payload stays minimal; validate with `npm run test:unit -- host-callbacks`.

### Implementation

- [x] T032 [US2] Implement provider contract types and resolver in `packages/assistant-sdk/src/context/hostContextProvider.ts`; depends on T029; complete when provider supports async request-scoped resolution and fail-closed behavior; validate with provider resolution tests.
- [x] T033 [US2] Implement stale context prevention adapter in `packages/assistant-sdk/src/context/contextResolution.ts`; depends on T032; complete when send/retry always resolves fresh context and never reuses failed snapshot; validate with host context provider tests.
- [x] T034 [US8] Implement WidgetConfiguration local-only types in `packages/assistant-sdk/src/types/widgetConfiguration.ts`; depends on T030; complete when endpoint/transport mode, locale, theme, panel position, size, launcher, z-index, session behavior, integration mode, and feature flags are typed as local-only; validate with local-only boundary tests.
- [x] T035 [US6] Implement HostCallbacks and HostEvents types in `packages/assistant-sdk/src/events/hostEvents.ts`; depends on T031; complete when event payloads are minimal and never serialize to PageContext or backend request; validate with host callbacks tests.
- [x] T036 [US6] Implement callback isolation runner in `packages/assistant-sdk/src/events/callbackRunner.ts`; depends on T035; complete when callback errors emit safe error events without breaking runtime; validate with callback exception isolation tests.

**Checkpoint**: Provider, configuration, and callbacks are separate public contracts with local-only boundaries enforced.

## Phase 4: Request Builder Modes and Sanitization

**Purpose**: 建立 mode-tiered request builder 與 frontend sanitization。  
**Independent Test**: Backend 001 mode omits Frontend 002-only fields; Backend 002 mode fails closed; PageContext is sanitized and bounded.

### Tests First

- [x] T037 [P] [US2] Add core assistant contract compatibility request builder tests in `tests/contract/assistant-sdk/core-assistant-request-builder.spec.ts`; depends on T005 and T032; complete when tests assert Backend 001 public shape, omission of Frontend 002-only fields, no unknown fields, no hidden prompt, no message text injection; validate with `npm run test:contract -- core-assistant-request-builder`.
- [x] T038 [P] [US2] Add host integration contract fail-closed tests in `tests/contract/assistant-sdk/host-integration-request-builder.spec.ts`; depends on T005 and T032; complete when tests assert missing required organization / identity / permission context stops before transport; validate with `npm run test:contract -- host-integration-request-builder`.
- [x] T039 [P] [US3] Add PageContext sanitization tests in `tests/unit/assistant-sdk/page-context-sanitizer.spec.ts`; depends on existing `app/utils/assistant/pageContextSanitizer.ts`; complete when tests cover primitive/plain-object validation, raw row rejection, selectedRows max 20, >20 whole-context rejection, secret-like rejection, DOM/function/class/circular rejection; validate with `npm run test:unit -- page-context-sanitizer`.
- [x] T040 [P] [US8] Add forbidden field gate request tests in `tests/unit/assistant-sdk/security/outgoing-request-gate.spec.ts`; depends on T007; complete when tests block backend-owned authority fields, local-only state, token, credential, secret, and approval navigation metadata before transport; validate with `npm run test:unit -- outgoing-request-gate`.

### Implementation

- [x] T041 [US2] Implement integration mode types in `packages/assistant-sdk/src/types/integrationMode.ts`; depends on T037-T038; complete when only Backend 001 Compatibility Mode and Backend 002 Mode are formal public modes; validate with mode boundary tests.
- [x] T042 [US2] Implement request builder entry in `packages/assistant-sdk/src/transport/requestBuilder.ts`; depends on T041; complete when request builder owns final outgoing request construction before transport; validate with core assistant and host integration request builder tests.
- [x] T043 [US2] Implement core assistant request contract omission adapter in `packages/assistant-sdk/src/request/coreAssistantRequestAdapter.ts`; depends on T042; complete when Frontend 002-only Host Context fields are omitted from Backend 001 request transport; validate with core assistant request builder tests.
- [x] T044 [US2] Implement host integration request contract validation adapter in `packages/assistant-sdk/src/request/hostIntegrationRequestAdapter.ts`; depends on T042; complete when required context failures stop request with `context unavailable` / `integration error`; validate with host integration request builder tests.
- [x] T045 [US3] Extend generic PageContext sanitizer in `app/utils/assistant/pageContextSanitizer.ts`; depends on T039; complete when raw row objects, functions, DOM nodes, class instances, circular structures, secret-like fields, and `selectedRows` >20 are rejected as specified; validate with page-context sanitizer tests.
- [x] T046 [US8] Implement forbidden outgoing fields gate in `packages/assistant-sdk/src/transport/forbiddenFieldsGate.ts`; depends on T040; complete when blocked fields never reach request builder output or transport executor; validate with outgoing request gate tests.
- [x] T047 [US3] Implement developer diagnostics and user-safe context errors in `packages/assistant-sdk/src/types/safeErrors.ts`; depends on T044-T046; complete when diagnostics are actionable for engineers and safe for users; validate with request builder and sanitizer tests.

**Checkpoint**: Request building and sanitization are enforced before any default or injected transport runs.

## Phase 5: Transport Ownership and SSE Integration

**Purpose**: default transport 與 injected low-level executor integration。  
**Independent Test**: Default transport reuses Frontend 001 assistant service and injected executor cannot bypass package request builder or SSE stream contract.

**Historical Ownership Note**: Phase 5 historical implementation established default / injected transport seams against the then-current Frontend 001 runtime. During Phase 11 extraction, final ownership supersedes that source arrangement: Shared Canonical Assistant Runtime owns canonical session, SSE, retry, error, timeout, interrupted, and safe outcome state; Frontend 001 AssistantService becomes a Nuxt transport adapter; Frontend 002 transport becomes a Shared Runtime port adapter returning safe transport results.

### Tests First

- [x] T048 [P] [US5] Add default transport reuse tests in `tests/contract/assistant-sdk/default-transport.spec.ts`; depends on T027 and T042; complete when tests assert default transport wraps existing `app/services/api/assistant.ts` behavior; validate with `npm run test:contract -- default-transport`.
- [x] T049 [P] [US8] Add injected executor boundary tests in `tests/contract/assistant-sdk/injected-executor.spec.ts`; depends on T042 and T046; complete when tests assert executor cannot rewrite route, request envelope, parse SSE into second contract, or bypass sanitization/mode validation; validate with `npm run test:contract -- injected-executor`.
- [x] T050 [P] [US5] Add SSE ownership tests in `tests/unit/assistant-sdk/sse-ownership.spec.ts`; depends on T026; complete when tests assert package reuses `assistantSseParser.ts` and `useAssistantSseStream.ts` without copying parser internals or exposing them as public API; validate with `npm run test:unit -- sse-ownership`.

### Implementation

- [x] T051 [US5] Implement default transport adapter in `packages/assistant-sdk/src/transport/defaultTransport.ts`; depends on T048; complete when adapter delegates to existing assistant service and preserves Backend 001 request/SSE contract; validate with default transport tests.
- [x] T052 [US8] Implement low-level authenticated executor adapter in `packages/assistant-sdk/src/transport/authenticatedExecutor.ts`; depends on T049; complete when executor receives only package-built request/stream instructions and cannot own endpoint, envelope, parser, retry, cancel, or error flow; validate with injected executor tests.
- [x] T053 [US5] Implement SSE stream bridge in `packages/assistant-sdk/src/transport/sseStreamBridge.ts`; depends on T050; complete when bridge uses existing stream runtime and parser behavior without second parser; validate with SSE ownership tests and existing SSE parser tests.
- [x] T054 [US5] Implement transport error propagation in `packages/assistant-sdk/src/transport/transportErrors.ts`; depends on T051-T053; complete when transport exceptions return to existing Frontend 001 error / retry flow; validate with default transport and injected executor tests.

**Checkpoint**: Phase 5 established the historical package transport seam and low-level host executor boundary. T054 records the Phase 5 baseline; during Phase 11 extraction, canonical error / retry / timeout / interrupted ownership moves to Shared Canonical Assistant Runtime, and Frontend 001 / Frontend 002 transports return safe transport results to that shared flow.

## Phase 6: Session Ownership, Fallback and Lifecycle

**Purpose**: session ownership、fallback session、lifecycle cleanup。  
**Independent Test**: Sessions isolate by host/organization/scope/page/entity, cleanup is reliable, and fallback never becomes identity proof.

### Tests First

- [x] T055 [P] [US4] Add session fallback namespace tests in `tests/unit/assistant-sdk/session-fallback.spec.ts`; depends on existing `app/utils/assistant/sessionScopeKeyGenerator.ts`; complete when tests cover package/version, hostApp, organization, sessionScope, page identity, entity type, entity ID; validate with `npm run test:unit -- session-fallback`.
- [x] T056 [P] [US8] Add organization isolation and identity proof tests in `tests/unit/assistant-sdk/security/session-isolation.spec.ts`; depends on T055; complete when tests assert missing organization prevents persistent fallback and memory/sessionId are not identity proof; validate with `npm run test:unit -- session-isolation`.
- [x] T057 [P] [US4] Add lifecycle cleanup tests in `tests/component/assistant-sdk/widget-lifecycle.spec.ts`; depends on T017 and T018; complete when tests cover duplicate mount, stale SSE cleanup, listener/timer/observer cleanup, unmount/destroy idempotency, post-unmount callback suppression; validate with `npm run test:component -- widget-lifecycle`.

### Implementation

- [x] T058 [US4] Implement SDK session namespace manager in `packages/assistant-sdk/src/session/sessionNamespace.ts`; depends on T055; complete when namespace includes package major compatibility, hostApp, organization, sessionScope, page/entity identity; validate with session fallback tests.
- [x] T059 [US4] Implement sessionStorage fallback pointer adapter in `packages/assistant-sdk/src/session/sessionStorageFallback.ts`; depends on T058; complete when fallback is conditional MUST only when host sessionId absent, mode allows fallback, safe namespace fields exist, and `sessionStorage` is available; validate with session fallback tests.
- [x] T060 [US4] Implement same-runtime memory-only fallback in `packages/assistant-sdk/src/session/memorySessionFallback.ts`; depends on T059; complete when storage unavailable uses same page JS runtime continuity only and never `localStorage` or cookie; validate with session fallback tests.
- [x] T061 [US8] Implement organization/entity/scope cleanup coordinator in `packages/assistant-sdk/src/session/sessionLifecycle.ts`; depends on T056 and T057; complete when organization, entity, or scope changes terminate old session context, SSE, history loading, listeners, timers, observers; validate with session isolation and widget lifecycle tests.
- [x] T062 [US4] Implement mount handle lifecycle in `packages/assistant-sdk/src/lifecycle/mountHandle.ts`; depends on T057; complete when open/close/unmount/destroy are idempotent and duplicate mount is diagnosable; validate with widget lifecycle tests.
- [x] T063 [US8] Implement sessionScope local-only guard in `packages/assistant-sdk/src/session/sessionScopeGuard.ts`; depends on T040 and T058; complete when `sessionScope` never enters backend body, headers, PageContext, hidden prompt, message text, transport metadata, or HostCallbacks payload; validate with outgoing request gate and session isolation tests.

**Checkpoint**: Session continuity is safe, isolated, and never treated as backend identity or permission authority.

## Phase 7: Host Events, Styling and Reference Consumer

**Purpose**: host events、callbacks、styles、Nuxt reference consumer integration。  
**Independent Test**: Reference consumer can use public entries, callbacks are minimal, and styles do not leak globally.

### Tests First

- [x] T064 [P] [US6] Add host event payload tests in `tests/unit/assistant-sdk/host-events.spec.ts`; depends on T035; complete when tests cover opened/closed, session created/changed, answer completed, error occurred, approval detail requested, escalation requested, context resolution failed; validate with `npm run test:unit -- host-events`.
- [x] T065 [P] [US6] Add approval detail IDs-only tests in `tests/unit/assistant-sdk/approval-callback.spec.ts`; depends on T035; complete when payload contains only `approvalRequestId`, `sessionId`, `messageId` and no navigation URL or raw object; validate with `npm run test:unit -- approval-callback`.
- [x] T066 [P] [US1] Add style isolation tests in `tests/style/assistant-sdk/style-isolation.spec.ts`; depends on T016; complete when tests assert no global reset, no host root token mutation outside documented CSS variables, and diagnosable missing stylesheet behavior; validate with future `npm run test:style -- style-isolation` once the style test script exists.
- [x] T067 [P] [US7] Add Nuxt reference consumer smoke tests in `tests/integration/assistant-sdk/reference-consumer.spec.ts`; depends on T011-T018; complete when tests assert public package entry, stylesheet import, provider registration, WidgetConfiguration, HostCallbacks, `AssistantWidget`, `mountAssistantWidget`, route and selectedRows updates; validate with integration/smoke command added by package setup, not available at T001 time.

### Implementation

- [x] T068 [US6] Implement host event emitter in `packages/assistant-sdk/src/events/hostEventEmitter.ts`; depends on T064; complete when event payloads are minimal and local-only; validate with host event payload tests.
- [x] T069 [US6] Implement approval detail callback adapter in `packages/assistant-sdk/src/events/approvalDetailRequested.ts`; depends on T065; complete when callback emits IDs-only payload and never infers Host App navigation URL; validate with approval callback tests.
- [x] T070 [US1] Implement scoped SDK styles in `packages/assistant-sdk/styles.css`; depends on T066; complete when styles use package root scoping, documented CSS variables, light/dark/system hooks, panel position/size, launcher, z-index, accessibility basics; validate with style isolation tests.
- [x] T071 [US7] Create Nuxt reference consumer plugin in `app/plugins/assistant-sdk.client.ts`; depends on T067; complete when current Nuxt app registers provider/config/callbacks via public SDK entry only; validate with reference consumer smoke tests.
- [x] T072 [US7] Create Nuxt reference preview page in `app/pages/assistant-sdk-preview.vue`; depends on T071; complete when page mounts `AssistantWidget`, imports stylesheet, exercises default and injected transport initialization path, and updates route/entity/selectedRows context; validate with reference consumer smoke tests.
- [x] T073 [US1] Update Nuxt auto-import/component integration boundary in `nuxt.config.ts`; depends on T071-T072; complete when reference consumer can resolve workspace package without deep-importing Frontend 001 internals; validate with reference consumer smoke tests.

**Checkpoint**: Host App integration surface is usable through public SDK entries and safe callback/style boundaries.

## Phase 8: Compatibility Mode Smoke and Canonical Runtime Regression Gates

**Purpose**: 證明 Backend 002 未完成時仍可宣告 package readiness。  
**Independent Test**: Compatibility Mode session/message/history/SSE/feedback/action/approval flows work through SDK package and canonical assistant runtime regression gates remain intact.

### Tests First

- [x] T074 [P] [US5] Add Compatibility Mode session/message smoke tests in `tests/integration/assistant-sdk/compatibility-chat-flow.spec.ts`; depends on T051 and T072; complete when session creation, message send, history load, and SSE streaming work through SDK for integrationMode `"backend001-compatibility"`; validate with integration/smoke command added by package setup, not available at T001 time.
- [x] T075 [P] [US5] Add Compatibility Mode answer/evidence/feedback smoke tests in `tests/integration/assistant-sdk/compatibility-rendering-flow.spec.ts`; depends on T053 and existing fixtures; complete when AnswerDecision, EvidenceRef, feedback, no-answer, clarification, permission-denied, tool-failure render through reused runtime; validate with integration/smoke command added by package setup, not available at T001 time.
- [x] T076 [P] [US7] Add reference consumer readiness smoke tests in `tests/integration/assistant-sdk/reference-consumer-readiness.spec.ts`; depends on T067 and T074; complete when build/install/mount/provider/config/callback/session/lifecycle/Compatibility Mode flow pass without Backend 002; validate with integration/smoke command added by package setup, not available at T001 time.
- [x] T077 [P] [US5] Add canonical assistant runtime regression gate references in `tests/contract/assistant-sdk/runtime-regression-gate.spec.ts`; depends on existing `tests/unit/assistant/`, `tests/component/assistant/`, `tests/contract/assistant/`; complete when gate documents and checks critical canonical assistant runtime tests required before SDK release; validate with `npm run test:contract -- runtime-regression-gate`.

### Implementation

- [x] T078 [US5] Wire Compatibility Mode smoke fixtures in `tests/fixtures/assistant-sdk/compatibility-mode-fixtures.ts`; depends on T074-T075; complete when fixtures reuse the integrationMode `"backend001-compatibility"` public request/SSE/AnswerDecision/EvidenceRef behavior and do not claim host-aware semantics; validate with Compatibility Mode smoke tests after integration/smoke command exists.

**Checkpoint**: Independent Package Readiness can be validated without Backend 002.

**Regression Gate Positioning**: Phase 8 Frontend 001 regression gates protect product behavior and Compatibility Mode readiness. They do not declare that `app/**` remains the permanent reusable canonical implementation owner. Compatibility Mode remains the Independent Package Readiness baseline, does not require Backend 002 completion, and does not send Frontend 002 Host Context body fields.

## Phase 9: Host Integration-dependent Smoke Gates

**Purpose**: 建立 later / gated / optional Host Integration validation。  
**Independent Test**: When Host Integration environment exists, SDK can fail closed on missing context and consume backend safe outcomes; these tests do not block Independent Package Readiness.

### Tests First

- [x] T079 [P] [US9] Add gated Host Integration missing-context tests in `tests/integration/assistant-sdk/host-integration-fail-closed.gated.spec.ts`; depends on T038 and T044; complete when missing organization / identity / permission context stops before request and emits context resolution failed; validate only with gated integration command and env flag added by package setup.
- [x] T080 [P] [US9] Add gated Host Integration sanitized context submission smoke in `tests/integration/assistant-sdk/host-integration-sanitized-context.gated.spec.ts`; depends on T042-T046; complete when sanitized PageContext submits without frontend-owned source/connector/permission/evidence fields; validate only with gated integration command and env flag added by package setup.
- [x] T081 [P] [US9] Add gated Host Integration safe outcome rendering smoke in `tests/integration/assistant-sdk/host-integration-safe-outcomes.gated.spec.ts`; depends on T053 and T075; complete when host-aware clarification, permission_denied, tool_failure, permission-safe evidence, backend-derived source metadata, and SSE final safe outcomes are consumed; validate only with gated integration command and env flag added by package setup.

### Implementation

- [x] T082 [US9] Add Host Integration gated test harness switch in `tests/fixtures/assistant-sdk/host-integration-gated-env.ts`; depends on T079-T081; complete when tests skip unless integration environment is explicitly enabled and skip message states not readiness blocking; validate with gated integration command once added, and confirm no-env execution skips.
- [x] T083 [US9] Add Host Integration fixture contract notes in `tests/fixtures/assistant-sdk/host-integration-contract-fixtures.ts`; depends on T080-T081; complete when fixtures align to Frontend 002 spec/design/plan boundary and do not define a third provider contract; validate with gated smoke tests once gated command exists.

**Checkpoint**: Host Integration-dependent tests are available later and explicitly non-blocking for package readiness.

## Phase 10: Package Artifact Release Boundary Validation

**Purpose**: 驗證 built / packed SDK artifact 可被 consuming app 只透過 public package entries 使用，而不是依賴 Frontend 001 repo source layout。  
**Independent Test**: Local package artifact can be consumed through `@internal-ai-assistant/assistant-sdk` and stylesheet entry only, with no unresolved Frontend 001 internal app path imports.

### Tests First

- [x] T084 [P] [US1] Add package artifact smoke test in `tests/contract/assistant-sdk/package-artifact-smoke.spec.ts`; depends on T013-T018 and T025-T028; complete when test validates an SDK build / pack artifact can be inspected without requiring consuming app access to Frontend 001 `app/**` paths; validate with `npm run test:contract -- package-artifact-smoke` after SDK package build command exists.
- [x] T085 [P] [US7] Add reference consumer public-entry install smoke in `tests/integration/assistant-sdk/reference-consumer-package-smoke.spec.ts`; depends on T064-T078 and T084; complete when reference consumer imports only `@internal-ai-assistant/assistant-sdk` and `@internal-ai-assistant/assistant-sdk/styles.css`, never `app/features`, `app/services`, `app/stores`, `app/utils`, or `packages/assistant-sdk/src/runtime`; validate with integration/smoke command added by package setup.
- [x] T086 [P] [US5] Add SDK dist unresolved internal path scan in `tests/contract/assistant-sdk/dist-internal-path-scan.spec.ts`; depends on T084; complete when scan fails on unresolved `../../../../app/features`, `../../../../app/services`, `../../../../app/stores`, `../../../../app/utils`, or equivalent Frontend 001 app-path imports in built SDK output; validate with `npm run test:contract -- dist-internal-path-scan` after SDK build command exists.
- [x] T087 [P] [US1] Add package export release-boundary validation in `tests/contract/assistant-sdk/package-release-exports.spec.ts`; depends on T084; complete when package artifact exports only root public API and `./styles.css`, and does not expose `./runtime`, `./runtime/*`, adapter internals, or Frontend 001 internal paths; validate with `npm run test:contract -- package-release-exports`.

### Implementation / Closeout

- [x] T088 [US1] Add SDK package build support in `packages/assistant-sdk/package.json`, `packages/assistant-sdk/vite.config.ts`, and root `package.json`; depends on T084-T087 and existing npm workspace setup; complete when npm workspace can build `@internal-ai-assistant/assistant-sdk` into `packages/assistant-sdk/dist/index.mjs` and `packages/assistant-sdk/dist/index.d.ts` without bundling a second Vue runtime or leaving unresolved Frontend 001 `app/**` imports for consuming apps; validate with the SDK build command established by implementation, `npm run test:contract -- package-artifact-smoke`, `npm run test:contract -- dist-internal-path-scan`, and `npm run typecheck`; implementation must inspect existing tools before adding any dependency for `.d.ts` generation.
- [x] T089 [US1] Define package artifact contents and files boundary in `packages/assistant-sdk/package.json` and `packages/assistant-sdk/styles.css`; depends on T088 built artifact; complete when package artifact contains only public install contents including `package.json`, `dist/index.mjs`, `dist/index.d.ts`, and `styles.css`, excludes tests/fixtures/specs/app source/private SDK internals, and exports only `"."` plus `"./styles.css"` with no `./runtime`, `./transport`, `./session`, `./context`, `./request`, or adapter internals; validate with `npm run test:contract -- package-release-exports`, `npm run test:contract -- package-artifact-smoke`, and `npm pack --dry-run` or equivalent local pack inspection.
- [x] T090 [US7] Add local package pack / install smoke validation in `tests/integration/assistant-sdk/reference-consumer-package-smoke.spec.ts`; depends on T088-T089; complete when reference consumer package smoke verifies a built / packed SDK can be resolved by a consuming app using only `@internal-ai-assistant/assistant-sdk` and `@internal-ai-assistant/assistant-sdk/styles.css`; validate with direct Vitest execution for the integration spec or the integration/smoke command added by package setup, using `/private/tmp` temporary consumer fixtures only and without repo config changes, real publish, external backend calls, or Host Integration environment requirements.
- [x] T091 [US1] Close Phase 10 artifact readiness validation in `tests/fixtures/assistant-sdk/release-readiness-contract.ts`; depends on T088-T090; complete when build / pack / install / artifact contents checklist items validate the real SDK dist / package artifact directly with no temporary pass condition; validate with `npm run test:contract -- package-artifact-smoke`, `npm run test:contract -- dist-internal-path-scan`, `npm run test:contract -- package-release-exports`, direct Vitest execution for `tests/integration/assistant-sdk/reference-consumer-package-smoke.spec.ts` or the added integration command, and `npm run typecheck`.

**Checkpoint**: Phase 10 proves the package skeleton, build / pack / local install smoke, public export boundary, and artifact scan baseline. It does not complete library-safe canonical runtime extraction; Phase 11 resolves runtime completeness and source ownership rather than rebuilding the package skeleton.

## Phase 11: Productized SDK Runtime and Publish Readiness

**Purpose**: 將已可 build / pack / local install 的 SDK artifact 產品化，讓 built `AssistantWidget` 成為完整聊天 widget，讓 `mountAssistantWidget` 可真正掛載完整 widget，並補齊 GitHub Packages publish readiness metadata、README、final release gates。  
**Independent Test**: A temporary consuming app can install / resolve the packed SDK through `@internal-ai-assistant/assistant-sdk` and `@internal-ai-assistant/assistant-sdk/styles.css` only, render the complete `AssistantWidget` chat UI, run Compatibility Mode through mock transport / mock SSE, and validate publish readiness metadata without real npm publish or external backend calls.

### Existing Productized SDK Tests First

- [x] T092 [P] [US5] Add productized AssistantWidget runtime completeness tests in `tests/component/assistant-sdk/productized-widget-runtime.spec.ts`; depends on T088-T091 and existing runtime reuse guardrails; complete when tests fail if built `AssistantWidget` contains shell placeholder text, lacks complete chat UI structure, creates a second ChatWidget/runtime, or leaves unresolved Frontend 001 `app/**` imports in the package artifact; validate with `npm run test:component -- productized-widget-runtime`, `npm run test:unit -- no-second-runtime`, and `npm run test:contract -- dist-internal-path-scan`.
- [x] T093 [P] [US1] Add productized `mountAssistantWidget` smoke tests in `tests/integration/assistant-sdk/productized-mount-smoke.spec.ts`; depends on T088-T092; complete when tests prove `mountAssistantWidget` in a temporary consuming app mounts the complete widget DOM, supports open/close/unmount/destroy, cleans listeners and callbacks, and does not require Host Integration or external backend calls; validate with direct Vitest execution or an integration smoke command using `/private/tmp` temporary config only.
- [x] T094 [P] [US7] Add packaged Compatibility Mode chat flow smoke tests in `tests/integration/assistant-sdk/packaged-compatibility-chat-flow.spec.ts`; depends on T088-T093 and Phase 8 compatibility fixtures; complete when a temporary consuming app installs or resolves the packed SDK, imports only root public entry and stylesheet, initializes provider/config/callbacks, sends a Compatibility Mode message through mock transport / mock SSE, and renders safe answer states through canonical runtime; validate with direct Vitest execution and no external backend calls.
- [x] T095 [P] [US5] Add packaged runtime source boundary tests in `tests/contract/assistant-sdk/packaged-runtime-source-boundary.spec.ts`; depends on T088-T094 and T086; complete when tests assert the packed SDK may contain compiled canonical runtime code but never exposes internal exports, never requires consuming app to resolve `app/features`, `app/services`, `app/stores`, `app/utils`, `packages/assistant-sdk/src/**`, specs, tests, or fixtures, and does not include sourcemaps; validate with `npm run test:contract -- packaged-runtime-source-boundary` and `npm run test:contract -- dist-internal-path-scan`.
- [x] T096 [P] [US1] Add GitHub Packages publish metadata and README readiness tests in `tests/contract/assistant-sdk/publish-readiness.spec.ts`; depends on T088-T091 and confirmed Phase 11 publish decisions; complete when tests assert package name remains `@internal-ai-assistant/assistant-sdk`, version remains `0.1.0`, license is `UNLICENSED`, GitHub Packages `publishConfig.registry` and restricted access are present only after runtime completeness gate, Nuxt is optional peer, README is included in package files, and no real publish is required; validate with `npm run test:contract -- publish-readiness`.

**Canonical Runtime Extraction Note**: Phase 0-Phase 10 remain completed historical implementation, contract, security, lifecycle, transport, and package artifact baselines. T092-T096 remain checked as existing final productized SDK readiness tests. Phase 11 does not re-implement product behavior as a second runtime; it moves the reusable canonical implementation into `packages/assistant-runtime/**`, migrates Frontend 001 into the Nuxt Adapter role, and migrates Frontend 002 into the SDK Adapter role. Phase 2 / Phase 5 legacy `app/**` bridges are historical baselines that Phase 11 tasks must replace or remove. Frontend 002 Phase 11 new tasks must not add or retain active SDK `app/**` imports.

### A. Baseline and Extraction Inventory

- [x] T097 [US5] Record Phase 11 baseline validation in `specs/002-internal-assistant-embedded-sdk-package/runtime-extraction-inventory.md`; depends on T092-T096; complete when the inventory records pass/fail/skip plus reason for focused Frontend 001 unit/component/contract regressions, Frontend 002 unit/component/contract regressions, T092-T096 target tests, `npm run typecheck`, SDK clean build, package artifact/dist internal path tests, and `npm pack --dry-run` or repository equivalent without reopening Phase 0-Phase 10 implementation; validate by diff review of the baseline command/result matrix.
- [x] T098 [US5] Add Canonical Runtime dependency and ownership inventory in `specs/002-internal-assistant-embedded-sdk-package/runtime-extraction-inventory.md`; depends on T097; complete when the single inventory artifact records ChatWidget transitive dependency graph, shared-safe capability classification, Nuxt-specific dependency classification, Frontend 001 app-specific dependency classification, Frontend 002 SDK-specific dependency classification, Nuxt UI / auto-import inventory, legacy SDK `app/**` bridge inventory, legacy reuse/transport/SSE test inventory, and old owner -> shared owner -> adapter -> cleanup mapping; validate by diff review of the inventory artifact only.

### B. Extraction Architecture Guards

- [x] T099 [P] [US5] Add Canonical Runtime owner guard tests in `tests/contract/assistant-sdk/canonical-runtime-owner.spec.ts`; depends on T097-T098; complete when tests assert `packages/assistant-runtime/**` is the only reusable canonical owner, no second ChatWidget/runtime exists, shared runtime cannot import `app/**`, Nuxt globals, `useRuntimeConfig`, or Frontend 001 active Pinia, and Frontend 002 SDK cannot import `app/features/**`, `app/services/**`, `app/stores/**`, or `app/utils/**`; validate with `npm run test:contract -- canonical-runtime-owner`.
- [x] T100 [P] [US1] Add SDK declaration and public package boundary guard tests in `tests/contract/assistant-sdk/sdk-declaration-boundary.spec.ts`; depends on T097-T098; complete when tests fail if SDK declarations reference `app/**`, expose `packages/assistant-runtime/**` internal paths, publish exports beyond root and `./styles.css`, make Pinia a public peer/API, or require a consumer to initialize Pinia before mounting; validate with `npm run test:contract -- sdk-declaration-boundary`.
- [x] T101 [P] [US8] Add runtime state isolation guard tests in `tests/unit/assistant-sdk/runtime-state-isolation.spec.ts`; depends on T097-T098; complete when tests require multiple SDK widgets to avoid sharing active Pinia, streams, timers, listeners, abort controllers, pending callbacks, or local runtime state while still allowing an explicit shared backend `sessionId`; validate with `npm run test:unit -- runtime-state-isolation`.
- [x] T102 [P] [US5] Add legacy SDK bridge source graph guard tests in `tests/contract/assistant-sdk/legacy-bridge-source-graph.spec.ts`; depends on T097-T098; complete when tests fail if legacy SDK runtime bridge files under `packages/assistant-sdk/src/runtime/` retain active `app/**` imports after migration instead of disappearing or becoming shared-runtime adapters; validate with `npm run test:contract -- legacy-bridge-source-graph`.
- [x] T103 [P] [US5] Add Shared Runtime transport port ownership tests in `tests/unit/assistant-runtime/transport-port.spec.ts`; depends on T097-T098; complete when tests cover `createSession`, `loadHistory`, `sendMessage`/`streamMessage`, `cancel`/`abort`, feedback, action/confirmation, approval operations, shared orchestration/SSE/retry/error ownership, Frontend 001 Nuxt transport capability, Frontend 002 request/security adapter capability, and failure on second API contract or SDK-owned parser; validate with direct Vitest execution or the shared runtime unit command once available.

### C. Shared Runtime Workspace and Transport Port Foundation

- [x] T104 [US5] Create private internal shared runtime workspace boundary in `packages/assistant-runtime/package.json` and `packages/assistant-runtime/tsconfig.json`; depends on T099-T103; complete when the boundary has private package identity, library-safe typecheck entry, no direct publish path, no public npm product contract, and no dependency on `app/**`; validate with canonical runtime owner guards and the new library typecheck entry.
- [x] T105 [US1] Align dependency ownership metadata in `packages/assistant-sdk/package.json`, `packages/assistant-runtime/package.json`, and root `package.json`; depends on T104; complete when Vue remains SDK peer/external, Pinia is an SDK regular runtime dependency rather than public peer/API, Nuxt remains optional/non-required, and consumers do not initialize Pinia; validate with peer dependency boundary, publish-readiness, and SDK declaration boundary tests.
- [x] T106 [US5] Define Shared Runtime transport port foundation in `packages/assistant-runtime/src/transport/ports.ts`; depends on T103-T105; complete when the port covers session creation, history loading, message send/stream, cancel/abort, feedback, action confirmation, and approval operations while adapters own only request/HTTP capability and shared runtime owns orchestration/SSE/retry/error state; validate with transport port ownership tests.

### D. Types and Pure Helpers

- [x] T107 [US5] Add shared assistant domain types and pure helper extraction tests in `tests/unit/assistant-runtime/types-and-helpers.spec.ts`; depends on T106; complete when tests require typecheck without `app/**` or Nuxt-generated types and prove SDK public types remain facade-owned; validate with direct Vitest execution or the shared runtime unit command once available.
- [x] T108 [US5] Extract assistant domain types and pure helpers into `packages/assistant-runtime/src/types/index.ts` and `packages/assistant-runtime/src/helpers/index.ts`; depends on T107; complete when shared implementation owns reusable types/helpers without claiming Frontend 001 switch, SDK wiring, or old-owner cleanup; validate with T107 and shared runtime typecheck.
- [x] T109 [US5] Migrate Frontend 001 type/helper adapters in `app/types/assistant/index.ts` and `app/utils/assistant/requestIdGenerator.ts`; depends on T108; complete when Frontend 001 uses shared type/helper owners through re-export, thinning, or removal of old app owners and affected Frontend 001 regressions pass; validate with T107, affected Frontend 001 type/helper regressions, and canonical owner guards.

### E. SSE Parser and Stream Event Model

- [x] T110 [US5] Add shared SSE parser and stream event model extraction tests in `tests/unit/assistant-runtime/sse-stream-model.spec.ts`; depends on T109; complete when tests cover canonical SSE events, timeout as inactivity-based, interrupted as EOF-before-final, and failure on duplicate parsers across Frontend 001, shared runtime, or SDK transport; validate with direct Vitest execution plus `npm run test:unit -- sse-ownership`.
- [x] T111 [US5] Extract canonical SSE parser and stream event model into `packages/assistant-runtime/src/sse/index.ts`; depends on T110; complete when shared implementation owns parser/event model without changing production transport contracts; validate with T110 and shared runtime typecheck.
- [x] T112 [US5] Migrate Frontend 001 SSE adapters in `app/utils/assistant/assistantSseParser.ts` and `app/features/assistant/composables/useAssistantSseStream.ts`; depends on T111; complete when Frontend 001 uses shared SSE owner, app parser/composable are thinned, re-exported, or removed, Frontend 001 SSE regressions pass, and Frontend 002 transport remains parser-free; validate with T110, Frontend 001 SSE parser/stream regressions, and `npm run test:unit -- sse-ownership`.

### F. Session and History

- [x] T113 [US4] Add shared session and history orchestration tests in `tests/unit/assistant-runtime/session-history.spec.ts`; depends on T112; complete when tests cover create/resume, history cursor, delta accumulation, retry/cancel lifecycle, cleanup, and adapter-only transport ports; validate with direct Vitest execution plus session fallback/isolation tests.
- [x] T114 [US4] Extract session and history orchestration into `packages/assistant-runtime/src/session/index.ts`; depends on T113; complete when shared implementation owns orchestration without claiming SDK namespace/lifecycle wiring or Frontend 001 switch; validate with T113 and shared runtime typecheck.
- [x] T115 [US4] Migrate session/history adapters in `app/features/assistant/composables/useAssistantSession.ts` and `app/stores/assistant/useSessionStore.ts`; depends on T114; complete when Frontend 001 session/history uses shared runtime, SDK session namespace/lifecycle can connect through adapters later, old app session/history owner is thinned, and session regressions pass; validate with T113, Frontend 001 session/history regressions, and session isolation tests.

### G. Outcomes and Evidence

- [x] T116 [US5] Add shared AnswerDecision, EvidenceRef, and safe outcome tests in `tests/unit/assistant-runtime/safe-outcomes.spec.ts`; depends on T115; complete when tests cover final, no_answer, clarification, permission_denied, tool_failure, timeout, interrupted, AnswerDecision mapping, EvidenceRef normalization/display model, and safe metadata without frontend-owned backend authority; validate with direct Vitest execution plus existing answer/evidence regressions.
- [x] T117 [US5] Extract safe outcomes and evidence handling into `packages/assistant-runtime/src/outcomes/index.ts` and `packages/assistant-runtime/src/evidence/index.ts`; depends on T116; complete when shared implementation owns outcome/evidence model without moving backend identity/authorization/source/evidence authority into frontend; validate with T116 and shared runtime typecheck.
- [x] T118 [US5] Migrate outcome/evidence adapters in `app/utils/assistant/answerDecisionStateMapper.ts`, `app/utils/assistant/assistantMessageRendererResolver.ts`, and `app/utils/assistant/evidenceNormalizationAdapter.ts`; depends on T117; complete when Frontend 001 renderer/mapping uses shared owners, SDK only projects safe callbacks/events later, old owner is thinned, and affected regressions pass; validate with T116, Frontend 001 answer/evidence regressions, and forbidden outgoing field guards.

### H. Feedback, Action and Approval

- [x] T119 [US6] Add shared feedback, action, and approval extraction tests in `tests/unit/assistant-runtime/feedback-action-approval.spec.ts`; depends on T118; complete when tests cover feedback, ActionDraft, confirmation, ApprovalRequest display, approval IDs-only callback/event inputs, and no Host App navigation URL generation; validate with direct Vitest execution plus existing feedback/action/approval regressions.
- [x] T120 [US6] Extract feedback, action, and approval runtime into `packages/assistant-runtime/src/feedback/index.ts`, `packages/assistant-runtime/src/actions/index.ts`, and `packages/assistant-runtime/src/approvals/index.ts`; depends on T119; complete when shared implementation owns these runtime capabilities without exposing raw approval payloads or navigation URLs to SDK callbacks; validate with T119 and shared runtime typecheck.
- [x] T121 [US6] Migrate feedback/action/approval adapters in `app/services/api/assistant.ts`, `app/stores/assistant/useSessionStore.ts`, and `app/features/assistant/components/ApprovalRequestDisplayMessage.vue`; depends on T120; complete when Frontend 001 uses shared owners, SDK/public callbacks expose only safe IDs and payloads later, old app owners are thinned, and regressions pass; validate with T119, Frontend 001 feedback/action/approval regressions, and host callback/event guards.

### I. Pinia Stores and Runtime Controller

- [x] T122 [US4] Add shared Pinia store and runtime controller tests in `tests/unit/assistant-runtime/runtime-controller.spec.ts`; depends on T121; complete when tests require explicit imports, no Nuxt auto-registration, injectable runtime scope, no active global app state, per-runtime isolation primitives, and optional shared backend `sessionId` without shared local runtime instance; validate with direct Vitest execution plus runtime state isolation guards.
- [x] T123 [US4] Extract shared stores and runtime controller into `packages/assistant-runtime/src/stores/index.ts` and `packages/assistant-runtime/src/runtime/index.ts`; depends on T122; complete when shared implementation defines store/runtime factories without requiring productized AssistantWidget, imperative mount, or `createPinia()` per SDK mount; validate with T122 and shared runtime typecheck.
- [x] T124 [US4] Migrate Frontend 001 Pinia adapter in `app/stores/assistant/useChatWidgetStore.ts` and `app/stores/assistant/useSessionStore.ts`; depends on T123; complete when Frontend 001 uses existing app Pinia with shared stores/adapters and does not create a second app-level Pinia; validate with T122 and Frontend 001 store regressions.
- [x] T125 [US4] Close Pinia/runtime controller regressions and old store cleanup in `tests/unit/assistant/session-restore.spec.ts` and `tests/component/assistant/session-history.spec.ts`; depends on T124; complete when old app store owners are removed, re-exported, or thinned, no parallel stores remain, and widget/session regressions pass; validate with focused Frontend 001 store regressions, runtime state isolation guards, and widget lifecycle tests.

### J. Canonical UI

- [x] T126 [US5] Add canonical UI extraction tests in `tests/component/assistant-runtime/canonical-ui.spec.ts`; depends on T125; complete when tests cover conversation/message list, composer, loading/streaming, safe outcomes, EvidenceRef, feedback, action confirmation, approval display, explicit imports, no Nuxt auto-registration, and no required Nuxt UI plugin; validate with direct Vitest execution plus productized widget runtime tests.
- [x] T127 [US5] Extract library-safe canonical assistant UI into `packages/assistant-runtime/src/components/AssistantRuntimeRoot.vue`; depends on T126; complete when shared UI uses explicit imports, library-safe Vue components, native semantic HTML or renderless adapter slots, and no SDK-only second chat UI; validate with T126 and shared runtime component tests.
- [x] T128 [US5] Migrate Frontend 001 ChatWidget/UI adapter in `app/features/assistant/components/ChatWidget.vue`; depends on T127; complete when ChatWidget becomes a shared-runtime thin wrapper or direct shared component usage while route/page/layout/theme remain in Frontend 001 adapter space; validate with ChatWidget open/close and component regressions.
- [x] T129 [US5] Close canonical UI regressions and old UI owner cleanup in `tests/component/assistant/ChatWidget.shell.spec.ts` and `tests/component/assistant/send-message-streaming.spec.ts`; depends on T128; complete when old UI owner is removed, re-exported, or thinned, no parallel business logic remains, and Frontend 001 component regressions pass; validate with focused Frontend 001 component tests and no-second-runtime guards.

### K. Frontend 001 Nuxt Adapter Migration

- [x] T130 [US5] Close Frontend 001 Nuxt transport adapter in `app/services/api/assistant.ts`; depends on T129; complete when the service provides Nuxt/app HTTP, `useRuntimeConfig`, auth/headers, app persistence, and safe transport results without owning canonical SSE/session/retry/outcome state; validate with Frontend 001 assistant service contract regressions and transport port ownership tests.
- [x] T131 [US5] Close Frontend 001 runtime integration adapter in `app/features/assistant/composables/useChat.ts` and `app/features/assistant/composables/useAssistantHostContext.ts`; depends on T130; complete when composables connect Nuxt/app context to shared runtime ports without retaining parallel business logic; validate with Frontend 001 composable/component regressions and canonical owner guards.
- [x] T132 [US5] Audit Frontend 001 regression coverage in `tests/fixtures/assistant-sdk/runtime-regression-gate.ts`; depends on T130-T131; complete when regression gate covers ChatWidget open/close, session/history, SSE, safe outcomes, retry/cancel, EvidenceRef, feedback, ActionDraft, ApprovalRequest, route/entity/organization/session changes, and cleanup before old owner removal; validate with `npm run test:contract -- runtime-regression-gate`.

### L. Legacy Test Migration

- [x] T133 [US5] Migrate legacy SDK reuse and transport tests in `tests/component/assistant-sdk/runtime-reuse.spec.ts`, `tests/unit/assistant-sdk/runtime-composables-reuse.spec.ts`, `tests/unit/assistant-sdk/runtime-services-reuse.spec.ts`, `tests/contract/assistant-sdk/default-transport.spec.ts`, `tests/contract/assistant-sdk/injected-executor.spec.ts`, and `tests/unit/assistant-sdk/sse-ownership.spec.ts`; depends on T132; complete when tests assert Frontend 001 Nuxt Adapter and Frontend 002 SDK Adapter consume Shared Canonical Assistant Runtime, SDK does not import `app/**`, SDK transport does not parse SSE, and error/retry ownership is Shared Runtime before SDK adapter implementation starts; validate with the listed focused tests.

### M. Frontend 002 SDK Adapter Migration

- [x] T134 [US8] Migrate SDK transport adapter to Shared Runtime ports in `packages/assistant-sdk/src/transport/defaultTransport.ts` and `packages/assistant-sdk/src/request/requestBuilder.ts`; depends on T133; complete when SDK transport implements shared runtime ports, reuses existing request builder/provider/security gates, preserves Compatibility Mode omission, and does not own SSE parser/session/outcome state; validate with default transport, injected executor, outgoing gate, and transport port ownership tests.
- [x] T135 [US4] Migrate SDK session and lifecycle adapter in `packages/assistant-sdk/src/session/sessionLifecycle.ts` and `packages/assistant-sdk/src/lifecycle/mountHandle.ts`; depends on T134; complete when SDK namespace/fallback/lifecycle cleanup connects shared runtime instances without creating a second session/history state machine; validate with session fallback/isolation, widget lifecycle, and runtime state isolation tests.
- [x] T136 [US6] Migrate SDK runtime/context/event adapter in `packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts`, `packages/assistant-sdk/src/context/contextResolution.ts`, and `packages/assistant-sdk/src/events/hostEventEmitter.ts`; depends on T135; complete when provider/config/callback wiring creates shared runtime instances through the new SDK runtime adapter, safe event projection remains intact, no active `app/**` imports remain, and legacy runtime bridge resolution remains scoped to T137; validate with host context, host events, public boundary, canonical owner, and legacy bridge source graph guards.

### N. Legacy Bridge Replacement and Cleanup

- [x] T137 [US5] Remove legacy SDK app-source runtime bridge `packages/assistant-sdk/src/runtime/frontend001Runtime.ts` and remove or replace other legacy bridge files in `packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts`, `packages/assistant-sdk/src/runtime/composableAdapter.ts`, `packages/assistant-sdk/src/runtime/sessionAdapter.ts`, `packages/assistant-sdk/src/runtime/sseStreamAdapter.ts`, `packages/assistant-sdk/src/runtime/serviceAdapter.ts`, and `packages/assistant-sdk/src/runtime/assistantTypeAdapter.ts`; depends on T136; complete when `packages/assistant-sdk/src/runtime/frontend001Runtime.ts` is deleted, all active SDK runtime imports redirect to `packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts`, no active SDK source retains a `frontend001Runtime` path, symbol, export, or import, other legacy bridge files are deleted or replaced with non-`app/**` shared-runtime adapters, `sseStreamAdapter.ts` no longer references the app SSE owner, and no-second-runtime plus source graph guards pass; validate with legacy bridge source graph, public boundary, and no-second-runtime tests.

### O. Regression and Old-owner Cleanup Closure

- [ ] T138 [US5] Close aggregate Frontend 001 and Frontend 002 regression gate in `tests/fixtures/assistant-sdk/runtime-regression-gate.ts`; depends on T137; complete when required regressions cover ChatWidget open/close, session create/resume, history cursor, SSE streaming, completed answer, no_answer, clarification, permission_denied, tool_failure, timeout, interrupted, retry, cancel, EvidenceRef, feedback, ActionDraft, ApprovalRequest, route/entity/organization/session changes, and destroy/unmount cleanup; validate with runtime regression gate plus focused Frontend 001 and SDK regression commands.
- [ ] T139 [US5] Complete aggregate old app owner cleanup in `app/features/assistant/components/ChatWidget.vue`, `app/stores/assistant/useSessionStore.ts`, and `app/utils/assistant/assistantMessageRendererResolver.ts`; depends on T138; complete when old app owners are removed, re-exported, or thinned, import graph points to shared owner, and no parallel app business logic remains; validate with canonical owner, runtime regression gate, and no-second-runtime guards.

### P. Declaration, Build and Package Artifact Closure

- [ ] T140 [US5] Close shared runtime typecheck gate in `packages/assistant-runtime/tsconfig.json`; depends on T139; complete when shared runtime typechecks with explicit imports, no Nuxt globals, no `app/**`, no SDK public type dependency, and no active app state; validate with shared runtime typecheck and canonical owner guards.
- [ ] T141 [US5] Close SDK declaration and build gate in `packages/assistant-sdk/tsconfig.build.json` and `packages/assistant-sdk/vite.config.ts`; depends on T140; complete when `dist/index.d.ts` does not reference `app/**` or expose `packages/assistant-runtime/**`, compiled shared runtime may enter `dist/index.mjs`, Vue remains external, Pinia resolves as a regular dependency, Nuxt is optional/non-required, and sourcemaps are absent; validate with `npm run build:assistant-sdk`, dist internal path scan, and SDK declaration boundary tests.
- [ ] T142 [US1] Close package artifact and temporary consumer gate in `packages/assistant-sdk/package.json` and `tests/integration/assistant-sdk/reference-consumer-package-smoke.spec.ts`; depends on T141; complete when the package can build, pack, and resolve, exports only root and `./styles.css`, exposes no deep/private runtime imports, allows a consumer artifact to load compiled Shared Runtime and public component/runtime primitives without consumer Pinia initialization, and does not claim complete Productized AssistantWidget behavior or imperative `createPinia()` mount lifecycle before T144-T145; validate with package artifact smoke, package-release-exports, packaged-runtime source boundary, reference consumer package smoke, and npm pack dry-run.

### Q. T094 Fixture Correction

- [ ] T143 [US7] Correct existing T094 packaged Compatibility Mode fixture in `tests/integration/assistant-sdk/packaged-compatibility-chat-flow.spec.ts`; depends on T142; complete when the test adapter routes `POST /assistant/sessions` to JSON session creation, `GET /assistant/sessions/:sessionId/messages` to JSON history, and `POST /assistant/sessions/:sessionId/messages` to `text/event-stream`, keeps timeout inactivity-based and interrupted EOF-before-final, preserves all seven T094 outcome contracts, and does not modify production transport; validate with direct Vitest execution for packaged Compatibility Mode chat flow and no production diff outside tests/fixtures.

### R. Productized SDK Runtime

- [ ] T144 [US5] Replace AssistantWidget shell with productized canonical runtime wrapper in `packages/assistant-sdk/src/components/AssistantWidget.vue`; depends on T143; complete when built `AssistantWidget` renders complete canonical chat UI, uses the same shared runtime, creates widget-local runtime scope for component usage, wires provider/configuration/callbacks through SDK boundaries, imports no `app/**`, and creates no second runtime; validate with productized widget runtime, runtime-reuse, no-second-runtime, dist scan, and typecheck.
- [ ] T145 [US1] Implement productized mount helper in `packages/assistant-sdk/src/mountAssistantWidget.ts`; depends on T144; complete when every mount creates an isolated Vue app and `createPinia()` instance, mounts the full canonical AssistantWidget, controls open/close through canonical component state, cleans up unmount/destroy, diagnoses duplicate mounts through WeakMap registry, and clears registry after destroy; validate with productized mount smoke, widget lifecycle, session isolation, and typecheck.
- [ ] T146 [US5] Stabilize packaged runtime bundling in `packages/assistant-sdk/vite.config.ts`, `packages/assistant-sdk/tsconfig.build.json`, and `packages/assistant-sdk/package.json`; depends on T145; complete when compiled shared runtime is included in dist, declarations stay stable, Vue is external, Pinia is regular dependency, Nuxt is optional, sourcemaps are absent, exports remain root plus styles only, and no `app/**` remains; validate with clean SDK build, artifact smoke, dist scan, packaged runtime source boundary, npm pack dry-run, and typecheck.

### S. Publish Readiness

- [ ] T147 [US1] Add GitHub Packages publish-readiness metadata in `packages/assistant-sdk/package.json`; depends on T146; complete when package remains `@internal-ai-assistant/assistant-sdk`, version is `0.1.0`, private flag is removed or disabled only after runtime completeness gates, GitHub Packages `publishConfig` uses restricted access, license is `UNLICENSED`, README is included in package files, Nuxt is optional peer, and no real publish is executed; validate with publish-readiness, package-release-exports, npm pack dry-run, and typecheck.
- [ ] T148 [US7] Add productized SDK usage documentation in `packages/assistant-sdk/README.md`; depends on T147; complete when README covers installation, stylesheet import, `AssistantWidget`, `mountAssistantWidget`, provider contract, configuration, callbacks/events, Compatibility Mode, Host Integration Mode, session lifecycle, security boundary, forbidden frontend-owned fields, backend responsibilities, troubleshooting, version compatibility, GitHub Packages install notes, and release notes placeholder; validate with publish-readiness tests and npm pack dry-run.
- [ ] T149 [US8] Close productized SDK release readiness in `tests/fixtures/assistant-sdk/release-readiness-contract.ts`; depends on T148; complete when final release gates require clean SDK build, packed SDK install/resolve, complete widget runtime, productized mount smoke, packaged Compatibility Mode smoke, package artifact checks, source boundary scan, GitHub Packages metadata, README inclusion, no sourcemaps, no temporary markers, no private runtime exports, no external backend calls, and no real publish; validate with all Phase 11 tests, Phase 10 artifact tests, Phase 8 compatibility tests, Phase 9 gated disabled/enabled checks, Phase 4-7 regressions, runtime regression gate, typecheck, and npm pack dry-run.

### Renumbering Map

- Old T097 -> New T144: Productized `AssistantWidget`.
- Old T098 -> New T145: Productized `mountAssistantWidget`.
- Old T099 -> New T146: Packaged runtime bundling stabilization.
- Old T100 -> New T147: GitHub Packages publish-readiness metadata.
- Old T101 -> New T148: Productized SDK README.
- Old T102 -> New T149: Final productized SDK release readiness gate.

**Checkpoint**: Productized SDK reaches formal publish readiness review without executing real publish or calling external backend services.

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0**: No dependencies; establishes validation preflight and guardrails.
- **Phase 1**: Depends on Phase 0 guardrails and validation command policy.
- **Phase 2**: Depends on Phase 1 skeleton, npm workspace registration, and public entry.
- **Phase 3**: Depends on Phase 2 runtime bridge and public types.
- **Phase 4**: Depends on Phase 3 provider/config/callback boundary.
- **Phase 5**: Depends on Phase 4 request builder and sanitizer gates.
- **Phase 6**: Depends on Phase 2 runtime bridge and Phase 4 request boundary.
- **Phase 7**: Depends on Phase 3, Phase 5, and Phase 6.
- **Phase 8**: Depends on Phase 7 reference consumer integration.
- **Phase 9**: Depends on Phase 4/5 safe request and transport behavior plus an external Host Integration environment; does not block package readiness.
- **Phase 10**: Depends on Phase 7 reference consumer integration, Phase 8 package readiness smoke, and historical Phase 2 runtime reuse boundaries; includes tests first plus build / pack / install artifact closeout tasks, with T088 package build support required before final artifact validation. Phase 10 does not prove library-safe canonical runtime extraction.
- **Phase 11**: Depends on Phase 10 real build / pack / install artifact closeout, Phase 8 Compatibility Mode smoke, and Phase 0 architecture guardrails; preserves T092-T096 as existing productized Tests First guardrails, then executes Canonical Runtime Library-Safe Extraction T097-T143, productized SDK runtime T144-T146, and publish readiness T147-T149 without real publish.

**Architecture Dependency Clarification**: Phase 2 and Phase 5 remain historical prerequisites, but their app-source ownership does not represent the final Phase 11 architecture. Phase 11 implementation graph must converge to Frontend 001 Nuxt Adapter -> Shared Canonical Assistant Runtime <- Frontend 002 SDK Adapter.

### User Story Dependencies

- **US1 安裝並初始化 Assistant Package (P1)**: Can validate after Phase 1 and Phase 7; MVP starts here after guardrails.
- **US2 提供最新 Host Context (P1)**: Depends on Phase 3 provider and Phase 4 request builder.
- **US3 安全地處理 PageContext (P1)**: Depends on Phase 4 sanitizer and forbidden field gates.
- **US4 管理 Widget 與 Session Lifecycle (P1)**: Depends on Phase 6 session/lifecycle work.
- **US5 重用 Frontend 001 Chat Runtime (P1)**: Depends on Phase 0, Phase 2, Phase 5, Phase 8.
- **US6 暴露安全的 Host Events 與 Callbacks (P2)**: Depends on Phase 3 and Phase 7 callbacks/events.
- **US7 安裝到 Nuxt 4 Reference Host App (P2)**: Depends on Phase 7 and Phase 8.
- **US8 保護隱私、隔離與 Host Boundaries (P1)**: Cross-cutting across Phases 0, 3, 4, 5, 6.
- **US9 驗證 Host Integration Contract Compatibility (P3)**: Depends on Phase 9 and external Host Integration environment; not required for Independent Package Readiness.

### MVP Scope

MVP for package readiness should complete Phase 0, Phase 1, Phase 2 minimum runtime bridge, Phase 3 provider boundary, Phase 4 Backend 001 request builder/sanitizer gates, Phase 5 default transport, Phase 6 basic session lifecycle, Phase 7 minimal reference consumer, and Phase 8 Backend 001 smoke. Phase 9 is excluded from MVP readiness.

Package release readiness additionally requires Phase 10 tests-first guardrails plus real build / pack / install artifact closeout validation before the SDK package is declared installable outside the monorepo source tree.

Formal Productized SDK Release Readiness additionally requires Phase 11 extraction, adapter migration, legacy cleanup, declaration/build, package artifact, and T094 fixture closure T097-T143, productized SDK runtime T144-T146, and publish readiness T147-T149. It is not satisfied by package artifact existence alone: `packages/assistant-runtime/**` must be the reusable canonical implementation owner, Frontend 001 must retain only Nuxt adapter / product integration responsibilities, Frontend 002 must retain only SDK adapter / public package responsibilities, and SDK source plus dist must have no active `app/**` dependency.

## Parallel Opportunities

- Phase 0 validation preflight T001 can run first; Phase 0 tests T002-T005 can run in parallel after T001.
- Phase 1 tests T008-T010 and independent files T015-T016 can run in parallel after their dependencies.
- Phase 2 tests T019-T021 can run in parallel before shared runtime bridge implementation.
- Phase 3 tests T029-T031 can run in parallel.
- Phase 4 tests T037-T040 can run in parallel.
- Phase 5 tests T048-T050 can run in parallel.
- Phase 6 tests T055-T057 can run in parallel.
- Phase 7 tests T064-T067 can run in parallel.
- Phase 8 smoke tests T074-T077 can run in parallel after reference consumer setup.
- Phase 9 gated tests T079-T081 can run in parallel when Host Integration environment is available.
- Phase 10 package artifact tests T084-T087 can run in parallel as guardrails; T088 must run before T089-T091 final validation, and T089-T091 depend on the built artifact from T088.
- Phase 11 tests T092-T096 can run in parallel after Phase 10 closeout and remain completed final readiness guardrails.
- T097-T098 run sequentially to create the single extraction inventory and classification artifact.
- T099-T103 can run in parallel after T097-T098 because they add distinct extraction guard test files.
- T104 depends on T099-T103.
- T105-T106 depend on T104 and establish dependency ownership plus transport ports before capability extraction.
- Capability slices run in order: types/helpers T107-T109, SSE T110-T112, session/history T113-T115, outcomes/evidence T116-T118, feedback/action/approval T119-T121.
- T107, T110, T113, T116, T119, T122, and T126 are each Tests First entries for sequential capability slices; because each slice depends on the previous slice completing, these tasks are not marked [P].
- Pinia/runtime controller T122-T125 depends on T121; canonical UI T126-T129 depends on T125.
- Frontend 001 adapter closure T130-T132 depends on canonical UI T129.
- Legacy test migration T133 depends on T132 and must precede SDK adapter migration.
- Frontend 002 SDK adapter migration T134-T136 depends on T133.
- Legacy bridge replacement/removal T137 depends on T136.
- Aggregate regression and old-owner cleanup T138-T139 depend on T137.
- Shared typecheck, SDK declaration/build, and package artifact closure T140-T142 depend on old-owner cleanup T139.
- T143 depends on package artifact/temporary consumer closure T142 and must run before productized SDK runtime tasks.
- T144-T146 run sequentially after T143 for productized `AssistantWidget`, `mountAssistantWidget`, and bundling stabilization.
- T147-T149 run sequentially after T146 for metadata, README, and final readiness.

## Parallel Examples

```bash
# Phase 0 guardrails after validation preflight T001
Task: "T002 Add public package boundary architecture guard tests in tests/contract/assistant-sdk/public-boundary.spec.ts"
Task: "T003 Add no-second-runtime architecture guard tests in tests/unit/assistant-sdk/no-second-runtime.spec.ts"
Task: "T004 Add forbidden backend authority field guard tests in tests/unit/assistant-sdk/security/forbidden-outgoing-fields.spec.ts"
Task: "T005 Add frontend mode boundary guard tests in tests/contract/assistant-sdk/mode-boundary.spec.ts"
```

```bash
# Phase 4 request and sanitization tests
Task: "T037 Add core assistant contract compatibility request builder tests in tests/contract/assistant-sdk/core-assistant-request-builder.spec.ts"
Task: "T038 Add host integration contract fail-closed tests in tests/contract/assistant-sdk/host-integration-request-builder.spec.ts"
Task: "T039 Add PageContext sanitization tests in tests/unit/assistant-sdk/page-context-sanitizer.spec.ts"
Task: "T040 Add forbidden field gate request tests in tests/unit/assistant-sdk/security/outgoing-request-gate.spec.ts"
```

```bash
# Phase 9 gated Host Integration validation, not readiness blocking
Task: "T079 Add gated Host Integration missing-context tests in tests/integration/assistant-sdk/host-integration-fail-closed.gated.spec.ts"
Task: "T080 Add gated Host Integration sanitized context submission smoke in tests/integration/assistant-sdk/host-integration-sanitized-context.gated.spec.ts"
Task: "T081 Add gated Host Integration safe outcome rendering smoke in tests/integration/assistant-sdk/host-integration-safe-outcomes.gated.spec.ts"
```

## Independent Package Readiness Tests

Must pass before declaring package readiness:

- public export tests
- SSR import safety tests
- component mount tests
- provider resolution and failure tests
- request builder mode tests
- PageContext sanitization tests
- forbidden fields tests
- selectedRows max 20 tests
- session fallback / isolation tests
- lifecycle cleanup tests
- transport ownership tests
- host events / callbacks tests
- style isolation tests
- reference consumer smoke tests
- package artifact smoke tests
- SDK dist unresolved internal path scan
- public package release export validation
- real SDK dist / package artifact validation before external install readiness is declared
- Compatibility Mode integration tests
- canonical assistant runtime regression gates

## Productized SDK Publish Readiness Tests

Must pass before declaring formal productized SDK publish readiness:

- productized widget runtime completeness
- productized mount smoke
- packaged Compatibility Mode chat flow
- packaged runtime source boundary
- publish metadata validation
- README / usage documentation validation
- GitHub Packages publish readiness checks
- no sourcemap validation
- final productized SDK release readiness gate

## Host Integration-dependent Tests

Host Integration-dependent tests do not block Independent Package Readiness.

These tests are later / gated / optional integration-dependent validation:

- Host Integration fail-closed context tests
- sanitized context submission smoke
- host-aware clarification consumption
- permission_denied rendering
- tool_failure rendering
- permission-safe evidence consumption
- backend-derived source metadata display / preservation
- SSE final safe outcome consumption

## Final Validation Checklist

- [ ] `specs/002-internal-assistant-embedded-sdk-package/tasks.md` is the primary long-term task artifact for Frontend 002 implementation planning.
- [ ] No extra Spec Kit documentation artifacts are required for this feature beyond `spec.md`, `design.md`, `plan.md`, `tasks.md`, and the Phase 11 `runtime-extraction-inventory.md`; `packages/assistant-sdk/README.md` is allowed only as a Phase 11 package artifact / product documentation task.
- [ ] No changes to `spec.md`, `design.md`, `plan.md`, Frontend 001 docs, Backend 001 docs, production code, tests, package config, README, or other artifacts during tasks generation.
- [ ] Task IDs are sequential from T001 to T149.
- [ ] Every task follows `- [ ] T### [P?] [US?] Description with exact primary file path`.
- [ ] No implementation task creates auxiliary Spec Kit documentation artifacts outside the Spec Kit four-file set except the single Phase 11 runtime extraction inventory.
- [ ] No implementation task uses `specs/002-internal-assistant-embedded-sdk-package/tasks.md` as its primary path.
- [ ] Every functional phase lists tests before implementation tasks.
- [ ] Host Integration-dependent tests are explicitly gated and non-blocking for Independent Package Readiness.
- [ ] Phase 11 does not duplicate completed Phase 0-10 work.
- [ ] Phase 11 does not execute real npm publish.
- [ ] Phase 11 does not require external backend calls.
- [ ] Phase 11 does not add `./nuxt` or runtime/internal public exports.
- [ ] Phase 11 keeps GitHub Packages publish readiness separate from actual publish execution.
- [ ] Product Positioning uses the three-layer ownership model: Frontend 001 Nuxt Adapter, Shared Canonical Assistant Runtime, and Frontend 002 SDK Adapter.
- [ ] Shared Canonical Assistant Runtime is the only reusable canonical implementation owner after Phase 11 extraction.
- [ ] Frontend 001 is the product behavior / regression baseline owner and Nuxt integration adapter, not the permanent reusable runtime source owner.
- [ ] Frontend 002 is the SDK / public integration / package artifact owner and must not become a second runtime owner.
- [ ] Phase 2 and Phase 5 app-source bridges are treated only as historical baselines to migrate or remove during Phase 11.
- [ ] Phase 11 new SDK tasks must not import active `app/**` paths.
- [ ] `tasks.md` no longer treats Frontend 001 as the only chat runtime owner as a final architecture rule.
- [ ] `tasks.md` no longer treats monorepo source-time `app/**` imports as an effective Phase 11 SDK rule.
- [ ] Legacy reuse / transport / SSE tests are migrated by T133 before Frontend 002 SDK Adapter implementation T134-T136.
- [ ] Sequential capability Tests First tasks T107, T110, T113, T116, T119, T122, and T126 are not marked [P].
- [ ] `packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts` is the final SDK runtime adapter.
- [ ] `packages/assistant-sdk/src/runtime/frontend001Runtime.ts` is deleted during T137 and no active path, symbol, export, or import remains.
- [ ] T137 owns SDK legacy bridge removal, while T139 owns only Frontend 001 old app owner cleanup.
- [ ] T142 validates package build / pack / resolve, compiled runtime loading, and no consumer Pinia initialization, but does not claim complete Productized AssistantWidget or imperative mount lifecycle completion.
- [ ] Complete component behavior is validated by T144, and complete imperative `createPinia()` mount lifecycle is validated by T145.
- [ ] The T097-T149 dependency graph contains no missing dependency, forward/self dependency, or cycle.
- [ ] No task plans a second ChatWidget, assistant API client, SSE parser, session/history runtime, AnswerDecision mapper, EvidenceRef renderer, frontend-owned permission/source/connector/evidence authority, DataAdapter runtime, HostApp Registry copy, backend request mode, nested `hostContext`, backend `sessionScope`, iframe, Shadow DOM, framework-agnostic SDK, package backend proxy, production connector implementation, approval navigation URL generation, hidden prompt context injection, or message text context injection.
