# Tasks: Internal Assistant Embedded SDK Package

**Input**: `spec.md`, `design.md`, `plan.md`  
**Prerequisites**: Frontend 002 accepted spec/design/plan; Frontend 001 existing runtime; Backend 001 public contract handoff.  
**Tests**: Test-first. Every feature phase must create contract / unit / component / integration tests before implementation.  
**Organization**: Tasks are grouped by Frontend 002 plan phases. Frontend 001 remains the only chat runtime owner; Frontend 002 adds package / SDK integration boundaries only.

## Format: `[ID] [P?] [US?] Description`

- **[P]**: Can run in parallel only when files and dependencies do not overlap.
- **[US]**: Included when the task clearly maps to a spec User Story.
- **Paths**: Each task names exact primary file paths. No task relies on a vague glob as its only path.
- **Task detail rule**: Each task includes primary path, dependencies, completion condition, and validation method.

## Product Positioning

```text
Frontend 001
= AI 助理聊天面板本體與 chat runtime

Frontend 002
= npm package / SDK、Host App integration contract、
  package lifecycle、context provider、session isolation、
  consumer integration 與 package compatibility
```

Frontend 002 只能封裝與整合既有能力，不得重新實作 ChatWidget、assistant API client、SSE parser、session / history pipeline、AnswerDecision mapping、EvidenceRef rendering、feedback flow、ActionDraft confirmation、ApprovalRequest display behavior、retry / cancel / interrupted behavior。

SSE parser ownership 的意思是：Frontend 002 package 對外保有 transport / stream contract ownership，並重用 Frontend 001 既有 `app/utils/assistant/assistantSseParser.ts` 與 `app/features/assistant/composables/useAssistantSseStream.ts`；不得在 package 內建立第二套 SSE parser、fork parser、export parser internals、建立 mode-specific SSE parser，或讓 injected executor 自己解析 SSE 成第二套 contract。

## User Story / Phase Mapping

| Phase | Focus | Primary User Stories |
| --- | --- | --- |
| Phase 0 | Contract and Architecture Guardrails | US5, US8 |
| Phase 1 | Workspace Package Skeleton and Public Exports | US1 |
| Phase 2 | Runtime Reuse Boundary and Frontend 001 Extraction Points | US5 |
| Phase 3 | Provider / Configuration / Callbacks Boundary | US2, US6, US8 |
| Phase 4 | Request Builder Modes and Sanitization | US2, US3, US8 |
| Phase 5 | Transport Ownership and SSE Integration | US5, US8 |
| Phase 6 | Session Ownership, Fallback and Lifecycle | US4, US8 |
| Phase 7 | Host Events, Styling and Reference Consumer | US1, US6, US7 |
| Phase 8 | Backend 001 Compatibility Mode Smoke and Regression Gates | US1, US5, US7 |
| Phase 9 | Backend 002 Integration-dependent Smoke Gates | US9 |
| Phase 10 | Release Readiness and Documentation | US1, US7, US8 |

## Phase 0: Contract and Architecture Guardrails

**Purpose**: 在 package 建立前先鎖定不可違反的架構邊界。  
**Independent Test**: Guard tests fail if SDK introduces a second runtime, leaks forbidden backend authority fields, or exposes deep imports.

### Tests First

- [ ] T001 [P] Inspect repository package manager and validation scripts in `specs/002-internal-assistant-embedded-sdk-package/validation-commands.md`; depends on accepted spec/design/plan and root `package.json`; complete when npm + `package-lock.json`, existing scripts (`test:unit`, `test:component`, `test:contract`, `typecheck`, `build`, `test:e2e`), missing `test:integration`, and SDK validation command policy are documented; validate by comparing notes with root `package.json`.
- [ ] T002 [P] [US5] Add public package boundary architecture guard tests in `tests/contract/assistant-sdk/public-boundary.spec.ts`; depends on T001 and accepted spec/design/plan; complete when tests assert root exports only and no Frontend 001 internal deep import contract; validate with command confirmed by T001 for contract tests.
- [ ] T003 [P] [US5] Add no-second-runtime architecture guard tests in `tests/unit/assistant-sdk/no-second-runtime.spec.ts`; depends on T001 and Frontend 001 baseline files; complete when tests detect duplicate ChatWidget, API client, SSE parser, session/history runtime, AnswerDecision mapper, EvidenceRef renderer, feedback/action/approval runtime; validate with command confirmed by T001 for unit tests.
- [ ] T004 [P] [US8] Add forbidden backend authority field guard tests in `tests/security/assistant-sdk/forbidden-outgoing-fields.spec.ts`; depends on T001 and FR-050/FR-051; complete when tests cover `sourceSystem`, connector, adapter, dataSource, candidate tools, permission results, evidence source, raw evidence, routing hints, approval navigation metadata, token, credential, secret; validate with command confirmed by T001 for security/unit tests.
- [ ] T005 [P] [US8] Add frontend mode boundary guard tests in `tests/contract/assistant-sdk/mode-boundary.spec.ts`; depends on T001 and Backend 001 contract notes; complete when tests assert modes are frontend integration / request-builder / provider validation modes, not backend request modes, and no nested `hostContext` or backend `sessionScope`; validate with command confirmed by T001 for contract tests.

### Implementation

- [ ] T006 [US5] Create architecture guard fixture manifest in `tests/fixtures/assistant-sdk/architecture-guardrails.ts`; depends on T002-T005; complete when manifest lists canonical Frontend 001 runtime paths and forbidden duplicated modules; validate by importing it from all Phase 0 guard tests.
- [ ] T007 [US8] Create forbidden outgoing fields fixture in `tests/fixtures/assistant-sdk/forbidden-fields.ts`; depends on T004; complete when fixture enumerates all backend-owned authority fields and local-only fields; validate by reusing it in security and request builder tests.

**Checkpoint**: Architecture guardrails are testable before workspace package implementation begins.

## Phase 1: Workspace Package Skeleton and Public Exports

**Purpose**: 建立 `@internal-ai-assistant/assistant-sdk` workspace package skeleton。  
**Independent Test**: Consumer can resolve public root entry, public types, and stylesheet entry without importing internal package source.

### Tests First

- [ ] T008 [P] [US1] Add public export contract tests in `tests/contract/assistant-sdk/public-exports.spec.ts`; depends on T002; complete when tests assert `AssistantWidget`, `mountAssistantWidget`, provider/config/callback/event/session/transport/safe error/sanitized context types are reachable from root entry; validate with command confirmed by T001 for contract tests.
- [ ] T009 [P] [US1] Add stylesheet export contract tests in `tests/contract/assistant-sdk/stylesheet-entry.spec.ts`; depends on T002; complete when tests assert `@internal-ai-assistant/assistant-sdk/styles.css` resolves as explicit public entry; validate with command confirmed by T001 for contract tests.
- [ ] T010 [P] [US1] Add peer dependency boundary tests in `tests/unit/assistant-sdk/peer-dependency-boundary.spec.ts`; depends on package naming decision; complete when tests fail on bundled duplicate Vue runtime or missing diagnosable peer warnings; validate with command confirmed by T001 for unit tests.

### Implementation

- [ ] T011 [US1] Create SDK package manifest in `packages/assistant-sdk/package.json`; depends on T008-T010; complete when package name is `@internal-ai-assistant/assistant-sdk`, exports root and `./styles.css`, and declares Vue/Nuxt as peer dependency boundary; validate with public export contract tests.
- [ ] T012 [US1] Add npm workspace package registration in `package.json`; depends on T011; complete when `packages/assistant-sdk` is discoverable as `@internal-ai-assistant/assistant-sdk` by npm workspace resolution; validate with package-manager command confirmed by T001.
- [ ] T013 [US1] Create Vite library config in `packages/assistant-sdk/vite.config.ts`; depends on T011-T012; complete when config supports Vue SFC library output and does not bundle a second Vue runtime; validate with peer dependency boundary tests.
- [ ] T014 [US1] Create public root entry in `packages/assistant-sdk/src/index.ts`; depends on T011-T012; complete when only formal public API and public types are exported; validate with public export contract tests.
- [ ] T015 [P] [US1] Create public type barrel in `packages/assistant-sdk/src/types/public.ts`; depends on T014; complete when public provider/config/callback/event/session/transport/safe error/sanitized context types have stable names; validate with type import assertions in `tests/contract/assistant-sdk/public-exports.spec.ts`.
- [ ] T016 [P] [US1] Create stylesheet entry in `packages/assistant-sdk/styles.css`; depends on T009; complete when file provides package root styling hooks without global reset; validate with stylesheet entry contract tests.
- [ ] T017 [US1] Create component shell export in `packages/assistant-sdk/src/components/AssistantWidget.vue`; depends on T014; complete when component is SSR import-safe and delegates runtime behavior to later reusable boundary; validate with component mount tests added in Phase 7.
- [ ] T018 [US1] Create imperative mount helper shell in `packages/assistant-sdk/src/mountAssistantWidget.ts`; depends on T014; complete when helper exposes idempotent mount handle shape without creating a second Vue app for Nuxt component usage; validate with public export contract tests.

**Checkpoint**: SDK package skeleton and public entries exist without implementing a second runtime.

## Phase 2: Runtime Reuse Boundary and Frontend 001 Extraction Points

**Purpose**: 讓 Frontend 002 能使用 Frontend 001 runtime，而不是複製 runtime。  
**Independent Test**: SDK runtime entry wraps canonical Frontend 001 behavior and Frontend 001 regression tests remain valid.

### Tests First

- [ ] T019 [P] [US5] Add ChatWidget reuse boundary tests in `tests/component/assistant-sdk/runtime-reuse.spec.ts`; depends on T003 and T017; complete when tests assert `AssistantWidget` wraps canonical `app/features/assistant/components/ChatWidget.vue` behavior, not a copied widget; validate with command confirmed by T001 for component tests.
- [ ] T020 [P] [US5] Add composable reuse tests in `tests/unit/assistant-sdk/runtime-composables-reuse.spec.ts`; depends on T003; complete when tests assert use of `useChat.ts`, `useAssistantSession.ts`, and `useAssistantSseStream.ts` boundaries; validate with command confirmed by T001 for unit tests.
- [ ] T021 [P] [US5] Add service/store/helper reuse tests in `tests/unit/assistant-sdk/runtime-services-reuse.spec.ts`; depends on T003; complete when tests assert reuse of `app/services/api/assistant.ts`, `app/stores/assistant/useChatWidgetStore.ts`, `app/stores/assistant/useSessionStore.ts`, and assistant utils; validate with command confirmed by T001 for unit tests.

### Implementation

- [ ] T022 [US5] Create package runtime bridge in `packages/assistant-sdk/src/runtime/frontend001Runtime.ts`; depends on T019-T021; complete when bridge references canonical Frontend 001 runtime entry points without copying implementation; validate with runtime reuse tests.
- [ ] T023 [US5] Add stable ChatWidget adapter seam in `app/features/assistant/components/ChatWidget.vue`; depends on T019; complete when existing component can be consumed by SDK bridge with minimal behavior-preserving boundary; validate with Frontend 001 component regression tests.
- [ ] T024 [US5] Add stable chat composable adapter seam in `app/features/assistant/composables/useChat.ts`; depends on T020; complete when SDK can invoke canonical send/retry/cancel behavior without fork; validate with composable reuse tests and existing chat unit tests.
- [ ] T025 [US5] Add stable session/SSE adapter seams in `app/features/assistant/composables/useAssistantSession.ts`; depends on T020; complete when session/history behavior remains canonical for SDK and Frontend 001; validate with existing session history tests.
- [ ] T026 [US5] Add stable stream adapter seam in `app/features/assistant/composables/useAssistantSseStream.ts`; depends on T020; complete when SDK reuses existing stream runtime and no second SSE parser is introduced; validate with existing SSE stream tests.
- [ ] T027 [US5] Add stable assistant service adapter seam in `app/services/api/assistant.ts`; depends on T021; complete when default SDK transport can call existing Backend 001 assistant service shape; validate with existing assistant service contract tests.
- [ ] T028 [US5] Add stable assistant helper exports in `app/types/assistant/index.ts`; depends on T021; complete when SDK bridge can reuse public assistant types without deep importing private internals; validate with typecheck and runtime services reuse tests.

**Checkpoint**: Frontend 002 consumes Frontend 001 runtime through stable boundaries with no forked runtime.

## Phase 3: Provider / Configuration / Callbacks Boundary

**Purpose**: 實作 public integration contracts。  
**Independent Test**: Provider is request-scoped and async; WidgetConfiguration and HostCallbacks remain local-only; callback failures are isolated.

### Tests First

- [ ] T029 [P] [US2] Add provider resolution tests in `tests/unit/assistant-sdk/host-context-provider.spec.ts`; depends on T015; complete when tests cover async resolve, re-resolve before send/retry, failure safe error, and stale context rejection; validate with command confirmed by T001 for unit tests.
- [ ] T030 [P] [US8] Add provider/config/callback serialization boundary tests in `tests/security/assistant-sdk/local-only-boundary.spec.ts`; depends on T007 and T015; complete when tests reject WidgetConfiguration, HostCallbacks, callbacks, tokens, credentials, local UI state, and `sessionScope` from outgoing request; validate with command confirmed by T001 for security/unit tests.
- [ ] T031 [P] [US6] Add callback exception isolation tests in `tests/unit/assistant-sdk/host-callbacks.spec.ts`; depends on T015; complete when callback throw does not crash assistant runtime and payload stays minimal; validate with command confirmed by T001 for unit tests.

### Implementation

- [ ] T032 [US2] Implement provider contract types and resolver in `packages/assistant-sdk/src/context/hostContextProvider.ts`; depends on T029; complete when provider supports async request-scoped resolution and fail-closed behavior; validate with provider resolution tests.
- [ ] T033 [US2] Implement stale context prevention adapter in `packages/assistant-sdk/src/context/contextResolution.ts`; depends on T032; complete when send/retry always resolves fresh context and never reuses failed snapshot; validate with host context provider tests.
- [ ] T034 [US8] Implement WidgetConfiguration local-only types in `packages/assistant-sdk/src/types/widgetConfiguration.ts`; depends on T030; complete when endpoint/transport mode, locale, theme, panel position, size, launcher, z-index, session behavior, integration mode, and feature flags are typed as local-only; validate with local-only boundary tests.
- [ ] T035 [US6] Implement HostCallbacks and HostEvents types in `packages/assistant-sdk/src/events/hostEvents.ts`; depends on T031; complete when event payloads are minimal and never serialize to PageContext or backend request; validate with host callbacks tests.
- [ ] T036 [US6] Implement callback isolation runner in `packages/assistant-sdk/src/events/callbackRunner.ts`; depends on T035; complete when callback errors emit safe error events without breaking runtime; validate with callback exception isolation tests.

**Checkpoint**: Provider, configuration, and callbacks are separate public contracts with local-only boundaries enforced.

## Phase 4: Request Builder Modes and Sanitization

**Purpose**: 建立 mode-tiered request builder 與 frontend sanitization。  
**Independent Test**: Backend 001 mode omits Frontend 002-only fields; Backend 002 mode fails closed; PageContext is sanitized and bounded.

### Tests First

- [ ] T037 [P] [US2] Add Backend 001 Compatibility Mode request builder tests in `tests/contract/assistant-sdk/backend001-request-builder.spec.ts`; depends on T005 and T032; complete when tests assert Backend 001 public shape, omission of Frontend 002-only fields, no unknown fields, no hidden prompt, no message text injection; validate with command confirmed by T001 for contract tests.
- [ ] T038 [P] [US2] Add Backend 002 Mode fail-closed tests in `tests/contract/assistant-sdk/backend002-request-builder.spec.ts`; depends on T005 and T032; complete when tests assert missing required organization / identity / permission context stops before transport; validate with command confirmed by T001 for contract tests.
- [ ] T039 [P] [US3] Add PageContext sanitization tests in `tests/unit/assistant-sdk/page-context-sanitizer.spec.ts`; depends on existing `app/utils/assistant/pageContextSanitizer.ts`; complete when tests cover primitive/plain-object validation, raw row rejection, selectedRows max 20, >20 whole-context rejection, secret-like rejection, DOM/function/class/circular rejection; validate with command confirmed by T001 for unit tests.
- [ ] T040 [P] [US8] Add forbidden field gate request tests in `tests/security/assistant-sdk/outgoing-request-gate.spec.ts`; depends on T007; complete when tests block backend-owned authority fields, local-only state, token, credential, secret, and approval navigation metadata before transport; validate with command confirmed by T001 for security/unit tests.

### Implementation

- [ ] T041 [US2] Implement integration mode types in `packages/assistant-sdk/src/types/integrationMode.ts`; depends on T037-T038; complete when only Backend 001 Compatibility Mode and Backend 002 Mode are formal public modes; validate with mode boundary tests.
- [ ] T042 [US2] Implement request builder entry in `packages/assistant-sdk/src/transport/requestBuilder.ts`; depends on T041; complete when request builder owns final outgoing request construction before transport; validate with Backend 001 and Backend 002 request builder tests.
- [ ] T043 [US2] Implement Backend 001 omission adapter in `packages/assistant-sdk/src/transport/backend001RequestAdapter.ts`; depends on T042; complete when Frontend 002-only Host Context fields are omitted from Backend 001 request transport; validate with backend001 request builder tests.
- [ ] T044 [US2] Implement Backend 002 validation adapter in `packages/assistant-sdk/src/transport/backend002RequestAdapter.ts`; depends on T042; complete when required context failures stop request with `context unavailable` / `integration error`; validate with backend002 request builder tests.
- [ ] T045 [US3] Extend generic PageContext sanitizer in `app/utils/assistant/pageContextSanitizer.ts`; depends on T039; complete when raw row objects, functions, DOM nodes, class instances, circular structures, secret-like fields, and `selectedRows` >20 are rejected as specified; validate with page-context sanitizer tests.
- [ ] T046 [US8] Implement forbidden outgoing fields gate in `packages/assistant-sdk/src/transport/forbiddenFieldsGate.ts`; depends on T040; complete when blocked fields never reach request builder output or transport executor; validate with outgoing request gate tests.
- [ ] T047 [US3] Implement developer diagnostics and user-safe context errors in `packages/assistant-sdk/src/types/safeErrors.ts`; depends on T044-T046; complete when diagnostics are actionable for engineers and safe for users; validate with request builder and sanitizer tests.

**Checkpoint**: Request building and sanitization are enforced before any default or injected transport runs.

## Phase 5: Transport Ownership and SSE Integration

**Purpose**: default transport 與 injected low-level executor integration。  
**Independent Test**: Default transport reuses Frontend 001 assistant service and injected executor cannot bypass package request builder or SSE stream contract.

### Tests First

- [ ] T048 [P] [US5] Add default transport reuse tests in `tests/contract/assistant-sdk/default-transport.spec.ts`; depends on T027 and T042; complete when tests assert default transport wraps existing `app/services/api/assistant.ts` behavior; validate with command confirmed by T001 for contract tests.
- [ ] T049 [P] [US8] Add injected executor boundary tests in `tests/contract/assistant-sdk/injected-executor.spec.ts`; depends on T042 and T046; complete when tests assert executor cannot rewrite route, request envelope, parse SSE into second contract, or bypass sanitization/mode validation; validate with command confirmed by T001 for contract tests.
- [ ] T050 [P] [US5] Add SSE ownership tests in `tests/unit/assistant-sdk/sse-ownership.spec.ts`; depends on T026; complete when tests assert package reuses `assistantSseParser.ts` and `useAssistantSseStream.ts` without copying parser internals or exposing them as public API; validate with command confirmed by T001 for unit tests.

### Implementation

- [ ] T051 [US5] Implement default transport adapter in `packages/assistant-sdk/src/transport/defaultTransport.ts`; depends on T048; complete when adapter delegates to existing assistant service and preserves Backend 001 request/SSE contract; validate with default transport tests.
- [ ] T052 [US8] Implement low-level authenticated executor adapter in `packages/assistant-sdk/src/transport/authenticatedExecutor.ts`; depends on T049; complete when executor receives only package-built request/stream instructions and cannot own endpoint, envelope, parser, retry, cancel, or error flow; validate with injected executor tests.
- [ ] T053 [US5] Implement SSE stream bridge in `packages/assistant-sdk/src/transport/sseStreamBridge.ts`; depends on T050; complete when bridge uses existing stream runtime and parser behavior without second parser; validate with SSE ownership tests and existing SSE parser tests.
- [ ] T054 [US5] Implement transport error propagation in `packages/assistant-sdk/src/transport/transportErrors.ts`; depends on T051-T053; complete when transport exceptions return to existing Frontend 001 error / retry flow; validate with default transport and injected executor tests.

**Checkpoint**: Transport ownership is package-controlled while HTTP authentication execution may be host-injected at low level only.

## Phase 6: Session Ownership, Fallback and Lifecycle

**Purpose**: session ownership、fallback session、lifecycle cleanup。  
**Independent Test**: Sessions isolate by host/organization/scope/page/entity, cleanup is reliable, and fallback never becomes identity proof.

### Tests First

- [ ] T055 [P] [US4] Add session fallback namespace tests in `tests/unit/assistant-sdk/session-fallback.spec.ts`; depends on existing `app/utils/assistant/sessionScopeKeyGenerator.ts`; complete when tests cover package/version, hostApp, organization, sessionScope, page identity, entity type, entity ID; validate with command confirmed by T001 for unit tests.
- [ ] T056 [P] [US8] Add organization isolation and identity proof tests in `tests/security/assistant-sdk/session-isolation.spec.ts`; depends on T055; complete when tests assert missing organization prevents persistent fallback and memory/sessionId are not identity proof; validate with command confirmed by T001 for security/unit tests.
- [ ] T057 [P] [US4] Add lifecycle cleanup tests in `tests/component/assistant-sdk/widget-lifecycle.spec.ts`; depends on T017 and T018; complete when tests cover duplicate mount, stale SSE cleanup, listener/timer/observer cleanup, unmount/destroy idempotency, post-unmount callback suppression; validate with command confirmed by T001 for component tests.

### Implementation

- [ ] T058 [US4] Implement SDK session namespace manager in `packages/assistant-sdk/src/session/sessionNamespace.ts`; depends on T055; complete when namespace includes package major compatibility, hostApp, organization, sessionScope, page/entity identity; validate with session fallback tests.
- [ ] T059 [US4] Implement sessionStorage fallback pointer adapter in `packages/assistant-sdk/src/session/sessionStorageFallback.ts`; depends on T058; complete when fallback is conditional MUST only when host sessionId absent, mode allows fallback, safe namespace fields exist, and `sessionStorage` is available; validate with session fallback tests.
- [ ] T060 [US4] Implement same-runtime memory-only fallback in `packages/assistant-sdk/src/session/memorySessionFallback.ts`; depends on T059; complete when storage unavailable uses same page JS runtime continuity only and never `localStorage` or cookie; validate with session fallback tests.
- [ ] T061 [US8] Implement organization/entity/scope cleanup coordinator in `packages/assistant-sdk/src/session/sessionLifecycle.ts`; depends on T056 and T057; complete when organization, entity, or scope changes terminate old session context, SSE, history loading, listeners, timers, observers; validate with session isolation and widget lifecycle tests.
- [ ] T062 [US4] Implement mount handle lifecycle in `packages/assistant-sdk/src/lifecycle/mountHandle.ts`; depends on T057; complete when open/close/unmount/destroy are idempotent and duplicate mount is diagnosable; validate with widget lifecycle tests.
- [ ] T063 [US8] Implement sessionScope local-only guard in `packages/assistant-sdk/src/session/sessionScopeGuard.ts`; depends on T040 and T058; complete when `sessionScope` never enters backend body, headers, PageContext, hidden prompt, message text, transport metadata, or HostCallbacks payload; validate with outgoing request gate and session isolation tests.

**Checkpoint**: Session continuity is safe, isolated, and never treated as backend identity or permission authority.

## Phase 7: Host Events, Styling and Reference Consumer

**Purpose**: host events、callbacks、styles、Nuxt reference consumer integration。  
**Independent Test**: Reference consumer can use public entries, callbacks are minimal, and styles do not leak globally.

### Tests First

- [ ] T064 [P] [US6] Add host event payload tests in `tests/unit/assistant-sdk/host-events.spec.ts`; depends on T035; complete when tests cover opened/closed, session created/changed, answer completed, error occurred, approval detail requested, escalation requested, context resolution failed; validate with command confirmed by T001 for unit tests.
- [ ] T065 [P] [US6] Add approval detail IDs-only tests in `tests/unit/assistant-sdk/approval-callback.spec.ts`; depends on T035; complete when payload contains only `approvalRequestId`, `sessionId`, `messageId` and no navigation URL or raw object; validate with command confirmed by T001 for unit tests.
- [ ] T066 [P] [US1] Add style isolation tests in `tests/style/assistant-sdk/style-isolation.spec.ts`; depends on T016; complete when tests assert no global reset, no host root token mutation outside documented CSS variables, and diagnosable missing stylesheet behavior; validate with command confirmed by T001 for style tests or with script added by package setup.
- [ ] T067 [P] [US7] Add Nuxt reference consumer smoke tests in `tests/integration/assistant-sdk/reference-consumer.spec.ts`; depends on T011-T018; complete when tests assert public package entry, stylesheet import, provider registration, WidgetConfiguration, HostCallbacks, `AssistantWidget`, `mountAssistantWidget`, route and selectedRows updates; validate with command confirmed by T001 for integration tests or with script added by package setup.

### Implementation

- [ ] T068 [US6] Implement host event emitter in `packages/assistant-sdk/src/events/hostEventEmitter.ts`; depends on T064; complete when event payloads are minimal and local-only; validate with host event payload tests.
- [ ] T069 [US6] Implement approval detail callback adapter in `packages/assistant-sdk/src/events/approvalDetailRequested.ts`; depends on T065; complete when callback emits IDs-only payload and never infers Host App navigation URL; validate with approval callback tests.
- [ ] T070 [US1] Implement scoped SDK styles in `packages/assistant-sdk/styles.css`; depends on T066; complete when styles use package root scoping, documented CSS variables, light/dark/system hooks, panel position/size, launcher, z-index, accessibility basics; validate with style isolation tests.
- [ ] T071 [US7] Create Nuxt reference consumer plugin in `app/plugins/assistant-sdk.client.ts`; depends on T067; complete when current Nuxt app registers provider/config/callbacks via public SDK entry only; validate with reference consumer smoke tests.
- [ ] T072 [US7] Create Nuxt reference preview page in `app/pages/assistant-sdk-preview.vue`; depends on T071; complete when page mounts `AssistantWidget`, imports stylesheet, exercises default and injected transport initialization path, and updates route/entity/selectedRows context; validate with reference consumer smoke tests.
- [ ] T073 [US1] Update Nuxt auto-import/component integration boundary in `nuxt.config.ts`; depends on T071-T072; complete when reference consumer can resolve workspace package without deep-importing Frontend 001 internals; validate with reference consumer smoke tests.

**Checkpoint**: Host App integration surface is usable through public SDK entries and safe callback/style boundaries.

## Phase 8: Backend 001 Compatibility Mode Smoke and Regression Gates

**Purpose**: 證明 Backend 002 未完成時仍可宣告 package readiness。  
**Independent Test**: Backend 001 session/message/history/SSE/feedback/action/approval flows work through SDK package and Frontend 001 regression gates remain intact.

### Tests First

- [ ] T074 [P] [US5] Add Backend 001 session/message smoke tests in `tests/integration/assistant-sdk/backend001-chat-flow.spec.ts`; depends on T051 and T072; complete when session creation, message send, history load, and SSE streaming work through SDK; validate with command confirmed by T001 for integration tests or with script added by package setup.
- [ ] T075 [P] [US5] Add Backend 001 answer/evidence/feedback smoke tests in `tests/integration/assistant-sdk/backend001-rendering-flow.spec.ts`; depends on T053 and existing fixtures; complete when AnswerDecision, EvidenceRef, feedback, no-answer, clarification, permission-denied, tool-failure render through reused runtime; validate with command confirmed by T001 for integration tests or with script added by package setup.
- [ ] T076 [P] [US7] Add reference consumer readiness smoke tests in `tests/integration/assistant-sdk/package-readiness.spec.ts`; depends on T067 and T074; complete when build/install/mount/provider/config/callback/session/lifecycle/Backend 001 flow pass without Backend 002; validate with command confirmed by T001 for integration tests or with script added by package setup.
- [ ] T077 [P] [US5] Add Frontend 001 regression gate references in `tests/contract/assistant-sdk/frontend001-regression-gate.spec.ts`; depends on existing `tests/unit/assistant/`, `tests/component/assistant/`, `tests/contract/assistant/`; complete when gate documents and checks critical Frontend 001 tests required before SDK release; validate with command confirmed by T001 for contract tests.

### Implementation

- [ ] T078 [US5] Wire Backend 001 Compatibility Mode smoke fixtures in `tests/fixtures/assistant-sdk/backend001-compatibility.ts`; depends on T074-T075; complete when fixtures reuse Backend 001 public request/SSE/AnswerDecision/EvidenceRef behavior and do not claim host-aware semantics; validate with Backend 001 smoke tests.
- [ ] T079 [US7] Create package readiness notes in `specs/002-internal-assistant-embedded-sdk-package/package-readiness.md`; depends on T076-T078; complete when notes distinguish Independent Package Readiness from Backend 002 Integration-dependent Acceptance and list minimum Backend 001 Compatibility Mode smoke / package readiness pass criteria; validate by reviewing package readiness notes with Phase 8 smoke tests.

**Checkpoint**: Independent Package Readiness can be validated without Backend 002.

## Phase 9: Backend 002 Integration-dependent Smoke Gates

**Purpose**: 建立 later / gated / optional Backend 002 integration-dependent validation。  
**Independent Test**: When Backend 002 integration environment exists, SDK can fail closed on missing context and consume backend safe outcomes; these tests do not block Independent Package Readiness.

### Tests First

- [ ] T080 [P] [US9] Add gated Backend 002 missing-context tests in `tests/integration/assistant-sdk/backend002-fail-closed.gated.spec.ts`; depends on T038 and T044; complete when missing organization / identity / permission context stops before request and emits context resolution failed; validate only with gated Backend 002 integration flag and command confirmed by T001.
- [ ] T081 [P] [US9] Add gated sanitized context submission smoke in `tests/integration/assistant-sdk/backend002-sanitized-context.gated.spec.ts`; depends on T042-T046; complete when sanitized PageContext submits without frontend-owned source/connector/permission/evidence fields; validate only with gated Backend 002 integration flag and command confirmed by T001.
- [ ] T082 [P] [US9] Add gated Backend 002 safe outcome rendering smoke in `tests/integration/assistant-sdk/backend002-safe-outcomes.gated.spec.ts`; depends on T053 and T075; complete when host-aware clarification, permission_denied, tool_failure, permission-safe evidence, backend-derived source metadata, and SSE final safe outcomes are consumed; validate only with gated Backend 002 integration flag and command confirmed by T001.

### Implementation

- [ ] T083 [US9] Add Backend 002 gated test harness switch in `tests/fixtures/assistant-sdk/backend002-gated-env.ts`; depends on T080-T082; complete when tests skip unless integration environment is explicitly enabled and skip message states not package-readiness blocking; validate by running gated tests without env using command confirmed by T001.
- [ ] T084 [US9] Add Backend 002 fixture contract notes in `tests/fixtures/assistant-sdk/backend002-contract-fixtures.ts`; depends on T081-T082; complete when fixtures align to Frontend 002 spec/design/plan boundary and do not define a third provider contract; validate with gated smoke tests.

**Checkpoint**: Backend 002 integration-dependent tests are available later and explicitly non-blocking for package readiness.

## Phase 10: Release Readiness and Documentation

**Purpose**: 整理 release readiness、consumer guidance、documentation。  
**Independent Test**: Consumer guidance explains public API, stylesheet, provider/config/callbacks, modes, security boundaries, and release gates.

### Tests First

- [ ] T085 [P] [US1] Add package documentation smoke test in `tests/contract/assistant-sdk/docs-readiness.spec.ts`; depends on T011-T018; complete when test checks public API docs mention install/import/mount/styles/provider/config/callbacks; validate with command confirmed by T001 for contract tests.
- [ ] T086 [P] [US8] Add security documentation smoke test in `tests/security/assistant-sdk/security-docs.spec.ts`; depends on T046 and T063; complete when test checks docs mention privacy, forbidden fields, session isolation, Backend 001/002 boundaries, and no frontend permission/source/connector authority; validate with command confirmed by T001 for security/unit tests.

### Implementation

- [ ] T087 [US1] Create SDK package README in `packages/assistant-sdk/README.md`; depends on T085; complete when README documents install, public imports, `AssistantWidget`, `mountAssistantWidget`, stylesheet import, provider/config/callback examples, peer dependency diagnostics; validate with docs readiness test.
- [ ] T088 [US8] Create SDK security and boundary notes in `packages/assistant-sdk/SECURITY.md`; depends on T086; complete when notes document sanitized PageContext, forbidden outgoing fields, token/credential prohibition, session isolation, Backend 002 non-authority boundary; validate with security docs test.
- [ ] T089 [US7] Create release readiness checklist in `specs/002-internal-assistant-embedded-sdk-package/release-readiness.md`; depends on T079 and T087-T088; complete when checklist separates Independent Package Readiness from Backend 002 Integration-dependent Acceptance and states no public npm registry requirement for this feature; validate by reviewing docs readiness test and package readiness smoke.

**Checkpoint**: SDK is documented for consumer integration and release readiness without expanding scope.

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0**: No dependencies; establishes validation preflight and guardrails.
- **Phase 1**: Depends on Phase 0 guardrails and confirmed validation commands.
- **Phase 2**: Depends on Phase 1 skeleton, npm workspace registration, and public entry.
- **Phase 3**: Depends on Phase 2 runtime bridge and public types.
- **Phase 4**: Depends on Phase 3 provider/config/callback boundary.
- **Phase 5**: Depends on Phase 4 request builder and sanitizer gates.
- **Phase 6**: Depends on Phase 2 runtime bridge and Phase 4 request boundary.
- **Phase 7**: Depends on Phase 3, Phase 5, and Phase 6.
- **Phase 8**: Depends on Phase 7 reference consumer integration.
- **Phase 9**: Depends on Phase 4/5 safe request and transport behavior plus an external Backend 002 integration environment; does not block package readiness.
- **Phase 10**: Depends on desired readiness gates and docs smoke tests.

### User Story Dependencies

- **US1 安裝並初始化 Assistant Package (P1)**: Can validate after Phase 1 and Phase 7; MVP starts here after guardrails.
- **US2 提供最新 Host Context (P1)**: Depends on Phase 3 provider and Phase 4 request builder.
- **US3 安全地處理 PageContext (P1)**: Depends on Phase 4 sanitizer and forbidden field gates.
- **US4 管理 Widget 與 Session Lifecycle (P1)**: Depends on Phase 6 session/lifecycle work.
- **US5 重用 Frontend 001 Chat Runtime (P1)**: Depends on Phase 0, Phase 2, Phase 5, Phase 8.
- **US6 暴露安全的 Host Events 與 Callbacks (P2)**: Depends on Phase 3 and Phase 7 callbacks/events.
- **US7 安裝到 Nuxt 4 Reference Host App (P2)**: Depends on Phase 7 and Phase 8.
- **US8 保護隱私、隔離與 Host Boundaries (P1)**: Cross-cutting across Phases 0, 3, 4, 5, 6, 10.
- **US9 驗證 Backend 002 Contract Compatibility (P3)**: Depends on Phase 9 and external Backend 002 environment; not required for Independent Package Readiness.

### MVP Scope

MVP for package readiness should complete Phase 0, Phase 1, Phase 2 minimum runtime bridge, Phase 3 provider boundary, Phase 4 Backend 001 request builder/sanitizer gates, Phase 5 default transport, Phase 6 basic session lifecycle, Phase 7 minimal reference consumer, and Phase 8 Backend 001 smoke. Phase 9 is excluded from MVP readiness.

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
- Phase 9 gated tests T080-T082 can run in parallel when Backend 002 environment is available.
- Phase 10 documentation tests T085-T086 can run in parallel.

## Parallel Examples

```bash
# Phase 0 guardrails after validation preflight T001
Task: "T002 Add public package boundary architecture guard tests in tests/contract/assistant-sdk/public-boundary.spec.ts"
Task: "T003 Add no-second-runtime architecture guard tests in tests/unit/assistant-sdk/no-second-runtime.spec.ts"
Task: "T004 Add forbidden backend authority field guard tests in tests/security/assistant-sdk/forbidden-outgoing-fields.spec.ts"
Task: "T005 Add frontend mode boundary guard tests in tests/contract/assistant-sdk/mode-boundary.spec.ts"
```

```bash
# Phase 4 request and sanitization tests
Task: "T037 Add Backend 001 Compatibility Mode request builder tests in tests/contract/assistant-sdk/backend001-request-builder.spec.ts"
Task: "T038 Add Backend 002 Mode fail-closed tests in tests/contract/assistant-sdk/backend002-request-builder.spec.ts"
Task: "T039 Add PageContext sanitization tests in tests/unit/assistant-sdk/page-context-sanitizer.spec.ts"
Task: "T040 Add forbidden field gate request tests in tests/security/assistant-sdk/outgoing-request-gate.spec.ts"
```

```bash
# Phase 9 gated Backend 002 validation, not package-readiness blocking
Task: "T080 Add gated Backend 002 missing-context tests in tests/integration/assistant-sdk/backend002-fail-closed.gated.spec.ts"
Task: "T081 Add gated sanitized context submission smoke in tests/integration/assistant-sdk/backend002-sanitized-context.gated.spec.ts"
Task: "T082 Add gated Backend 002 safe outcome rendering smoke in tests/integration/assistant-sdk/backend002-safe-outcomes.gated.spec.ts"
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
- Backend 001 Compatibility Mode integration tests
- Frontend 001 regression gates

## Backend 002 Integration-dependent Tests

Backend 002 Integration-dependent tests do not block Independent Package Readiness.

These tests are later / gated / optional integration-dependent validation:

- Backend 002 Mode fail-closed context tests
- sanitized context submission smoke
- host-aware clarification consumption
- permission_denied rendering
- tool_failure rendering
- permission-safe evidence consumption
- backend-derived source metadata display / preservation
- SSE final safe outcome consumption

## Final Validation Checklist

- [ ] `specs/002-internal-assistant-embedded-sdk-package/tasks.md` is the only generated or overwritten artifact for this cleanup.
- [ ] No changes to `spec.md`, `design.md`, `plan.md`, Frontend 001 docs, Backend 001 docs, production code, tests, package config, README, or other artifacts during tasks generation.
- [ ] Task IDs are sequential from T001 to T089.
- [ ] Every task follows `- [ ] T### [P?] [US?] Description with exact primary file path`.
- [ ] No implementation task uses `specs/002-internal-assistant-embedded-sdk-package/tasks.md` as its primary path.
- [ ] Every functional phase lists tests before implementation tasks.
- [ ] Backend 002 integration-dependent tests are explicitly gated and non-blocking for Independent Package Readiness.
- [ ] No task plans a second ChatWidget, assistant API client, SSE parser, session/history runtime, AnswerDecision mapper, EvidenceRef renderer, frontend-owned permission/source/connector/evidence authority, DataAdapter runtime, HostApp Registry copy, backend request mode, nested `hostContext`, backend `sessionScope`, iframe, Shadow DOM, framework-agnostic SDK, package backend proxy, production connector implementation, approval navigation URL generation, hidden prompt context injection, or message text context injection.
