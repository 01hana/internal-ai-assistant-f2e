# Design: Internal Assistant Embedded SDK Package

**Feature**: `002-internal-assistant-embedded-sdk-package`  
**Spec**: `specs/002-internal-assistant-embedded-sdk-package/spec.md`  
**Status**: 已加入 Canonical Runtime Library-Safe Extraction 架構 cleanup

## 1. Overview

Frontend 002 將 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 與 chat runtime 封裝成 Vue 3 / Nuxt 4 Host App 可安裝、初始化、掛載、卸載與整合的 npm-compatible SDK package。

```text
Frontend 001
= AI 助理聊天面板產品功能、canonical behavior 與 Nuxt host integration owner

Frontend 002
= npm package / SDK、Host App integration contract、
  package lifecycle、context provider、session isolation、
  consumer integration 與 package compatibility

Shared Canonical Assistant Runtime
= 從 Frontend 001 canonical implementation 抽取出的唯一 library-safe runtime source
```

Frontend 002 不是新的聊天產品，也不是 Frontend 001 的重寫。它不得建立第二套 ChatWidget、assistant API client、SSE parser、session / history pipeline、AnswerDecision mapper、EvidenceRef renderer、feedback flow、ActionDraft confirmation、ApprovalRequest display behavior、retry / cancel / interrupted behavior。

SDK 必須包含可運作的完整 Assistant Chat Widget。SDK runtime source 必須源自 Frontend 001 canonical implementation，但 Host App 不需要知道 Frontend 001 的 `app/features/**`、`app/services/**`、`app/stores/**` 或 `app/utils/**` repo layout。

Frontend 002 不改 Backend 001 / Backend 002 public API。Backend 001 Compatibility Mode 是 Independent Package Readiness 的主要基線；Backend 002 Host Integration 是後續 gated acceptance path，不是 publish prerequisite。Public package exports 只允許 root entry 與 `./styles.css`，Vue 是 peer dependency，Nuxt 不應是一般 SDK consumer 的必要執行環境。

## 2. Source Documents and Fixed Decisions

### Source Documents

Frontend 002 source of truth:

- `specs/002-internal-assistant-embedded-sdk-package/spec.md`

Frontend 001 design / runtime inputs:

- `specs/001-internal-assistant-embedded-chat-panel/spec.md`
- `specs/001-internal-assistant-embedded-chat-panel/design.md`
- `specs/001-internal-assistant-embedded-chat-panel/plan.md`
- `specs/001-internal-assistant-embedded-chat-panel/tasks.md`
- Repository Frontend 001 runtime files listed in Repository Baseline.

Backend 001 public contract inputs:

- Existing Frontend 001 assistant service / types / SSE parser / runtime behavior.
- Existing Backend 001 contract handoff docs under `docs/contracts/backend-assistant-core/`.
- Existing request / SSE / AnswerDecision / EvidenceRef behavior consumed by Frontend 001.

Backend 002 fixed input:

- `specs/002-host-integration-gateway-and-data-adapter-contract/spec.md`
- `specs/002-host-integration-gateway-and-data-adapter-contract/design.md`
- `specs/002-host-integration-gateway-and-data-adapter-contract/plan.md`
- `specs/002-host-integration-gateway-and-data-adapter-contract/tasks.md`

### Fixed Decisions

- Vue 3 / Nuxt 4 only.
- Package name: `@internal-ai-assistant/assistant-sdk`.
- Component export: `AssistantWidget`.
- Imperative helper: `mountAssistantWidget`.
- Stylesheet entry: `@internal-ai-assistant/assistant-sdk/styles.css`.
- Locale v1 guarantee: `zh-TW`.
- `selectedRows` max: 20 raw input rows.
- `selectedRows` overflow behavior: reject entire context, do not truncate.
- Fallback session: `sessionStorage` when safe; otherwise same-runtime memory-only fallback.
- Frontend 002 and Frontend 001 runtime use same-version track.
- Delivery target: repo-internal workspace package.
- Backend 001 Compatibility Mode and Backend 002 Mode are frontend integration / request-builder / provider validation modes, not backend request modes.
- Injected authenticated transport executor is low-level only.
- Backend remains the only owner of `sourceSystem`、connector、adapter、permission result、EvidenceRef authority、routing hints 與 approval navigation authority.

## 3. Repository Baseline

### Existing Frontend 001 Runtime

- Chat widget / shell: `app/features/assistant/components/ChatWidget.vue`
- Panel layout: `app/features/assistant/components/ChatPanel.vue`
- Message components: `app/features/assistant/components/AiMessageItem.vue`, `app/features/assistant/components/AiStreamingItem.vue`, `app/features/assistant/components/UserMessageItem.vue`, `app/features/assistant/components/AssistantMessageFrame.vue`, `app/features/assistant/components/ChatInputBar.vue`, `app/features/assistant/components/ChatMessageArea.vue`
- Risk / safe-state components: `app/features/assistant/components/ClarificationMessage.vue`, `app/features/assistant/components/NoAnswerMessage.vue`, `app/features/assistant/components/PermissionDeniedMessage.vue`, `app/features/assistant/components/ToolFailureMessage.vue`, `app/features/assistant/components/InterruptedMessage.vue`, `app/features/assistant/components/DegradedMessage.vue`, `app/features/assistant/components/SessionRecoveryMessage.vue`
- Action / approval / escalation UI: `app/features/assistant/components/ActionDraftConfirmationMessage.vue`, `app/features/assistant/components/ApprovalRequestDisplayMessage.vue`, `app/features/assistant/components/EscalationMessage.vue`
- Evidence and feedback UI: `app/features/assistant/components/EvidenceDisplay.vue`, `app/features/assistant/components/FeedbackControls.vue`

### Existing Runtime, Stores, Types, And Transport

- Main runtime orchestration: `app/features/assistant/composables/useChat.ts`
- Host context runtime: `app/features/assistant/composables/useAssistantHostContext.ts`, `app/features/assistant/composables/useAssistantHostContextAdapter.ts`
- Session runtime: `app/features/assistant/composables/useAssistantSession.ts`
- SSE stream runtime: `app/features/assistant/composables/useAssistantSseStream.ts`
- Assistant API service: `app/services/api/assistant.ts`
- HTTP client entry: `app/services/index.ts`
- Stores: `app/stores/assistant/useChatWidgetStore.ts`, `app/stores/assistant/useSessionStore.ts`
- Contract and UI types: `app/types/assistant/`
- SSE parser: `app/utils/assistant/assistantSseParser.ts`
- AnswerDecision / renderer / evidence helpers: `app/utils/assistant/answerDecisionStateMapper.ts`, `app/utils/assistant/assistantMessageRendererResolver.ts`, `app/utils/assistant/evidenceNormalizationAdapter.ts`
- Sanitization and session helpers: `app/utils/assistant/pageContextSanitizer.ts`, `app/utils/assistant/sessionScopeKeyGenerator.ts`, `app/utils/assistant/sessionStorageSessionMap.ts`, `app/utils/assistant/sessionRecovery.ts`, `app/utils/assistant/defaultSessionScopeResolver.ts`, `app/utils/assistant/requestIdGenerator.ts`

### Existing Reference Consumer

目前 Nuxt app root (`.`) 是 v1 reference consumer / preview harness。`nuxt.config.ts` 會 auto-register `app/features/assistant/components`，並匯入 `app/features/assistant/composables`。

### Post-Phase-10 Baseline

- `packages/assistant-sdk/` 已存在。
- `@internal-ai-assistant/assistant-sdk` workspace package 已存在。
- Vite library build support 已存在。
- Public package exports 已存在，且仍限制為 root entry 加 `./styles.css`。
- Phase 10 已驗證 real build / pack / dist / package artifact boundary。
- Phase 11 剩餘缺口是 productized runtime completeness 與 publish readiness，不是 package skeleton 或 artifact existence。

## 4. Implementation Discovery: Canonical Runtime Is Not Yet Library-Safe

T097-T099 implementation preflight 發現 Frontend 001 `ChatWidget.vue` 是 canonical behavior owner，但尚未是 SDK 可直接 bundle 並產生 declaration 的 library-safe runtime source。

Repository findings:

- Vite 可以沿著 `app/**` imports transitively bundle Frontend 001 `ChatWidget`。
- 當 SDK declaration graph 穿過 Frontend 001 `app/**` source 時，`vue-tsc` / declaration generation 無法安全完成。
- Declaration output 會暴露或依賴 Frontend 001 app paths，而 package consumers 不得需要 resolve 這些路徑。
- Runtime 使用 Nuxt auto-import globals，包含 `useRuntimeConfig`。
- Runtime dependencies 使用 app-level Pinia stores，例如 `useAssistantSessionStore` 與 `useChatWidgetStore`。
- Runtime dependencies 使用 Nuxt / VueUse auto-imports，例如 `onKeyStroke`。
- UI、service、type、session 與 transport dependencies 仍綁定 Nuxt app context。
- Isolated SDK mount 不能假設 Frontend 001 active Nuxt app、active Pinia instance、plugins 或 auto-registered components 存在。

因此，原本「最小 SDK adapter 可以直接包裝 `app/features/assistant/components/ChatWidget.vue` 作為最終 package source」的前提不成立。這不推翻 Frontend 001 canonical ownership，而是表示 canonical implementation 必須先抽取成 Frontend 001 與 Frontend 002 都能使用的 library-safe shared runtime。

本設計將該前置工作稱為 **Canonical Runtime Library-Safe Extraction**。

## 5. Target Architecture Layers

### Layer 1: Shared Canonical Assistant Runtime

`Shared Canonical Assistant Runtime` 是從既有 Frontend 001 canonical implementation 抽取出的唯一 library-safe runtime。

它不是:

- 第二套 runtime
- 簡化版 temporary widget
- 複製版 implementation
- 獨立產品
- public npm API

它負責 canonical implementation:

- assistant chat state
- session create / resume
- history loading and cursor lifecycle
- SSE parsing
- stream lifecycle
- token / delta accumulation
- done / no_answer / clarification
- permission_denied
- tool_failure
- timeout
- interrupted
- retry / cancel
- AnswerDecision mapping
- EvidenceRef normalization / display model
- feedback flow
- ActionDraft / confirmation state
- ApprovalRequest display state
- callback-ready runtime events
- reusable Vue chat runtime component or controller
- transport port
- session / history port when separated from transport

它不得依賴:

- `useRuntimeConfig`
- Nuxt auto-import globals
- Nuxt app instance
- Nuxt route instance
- Frontend 001 active Pinia instance
- `app/**` HTTP service implementation
- Nuxt plugin injection
- Nuxt component auto-registration
- Frontend 001 page / layout state
- SDK public configuration type
- SDK `HostCallbacks`
- Backend 002-specific host integration policy

Library-safe 要求:

- 使用 explicit imports。
- 在不依賴 Nuxt-generated app types 的 library tsconfig 下 typecheck。
- 產生 declarations 時不得引用 `app/**`。
- 可同時被 Frontend 001 與 Frontend 002 import。
- 保持單一 canonical state machine 與 SSE contract。
- 支援 instance isolation。
- 避免 global active app state。

### Layer 2: Frontend 001 Nuxt Adapter

`Frontend 001 Nuxt Adapter` 將 Nuxt-specific integration 留在 Frontend 001，並提供:

- `useRuntimeConfig`
- Nuxt `$fetch` or the current app HTTP client
- Nuxt app authentication integration
- Nuxt-specific session persistence when applicable
- Pinia app registration / adapter
- route / page integration
- Nuxt UI component or theme integration
- Frontend 001 host app wiring
- shared runtime ports 所需 dependencies

Extraction 後，Frontend 001 `ChatWidget` 應成為 shared runtime 的薄 wrapper，或直接使用 shared canonical component。Frontend 001 不得保留一套 active Nuxt runtime，同時讓 shared runtime 保留另一套 active business runtime。過渡 wrapper 只能 delegate 到 shared runtime，且不得包含 parallel business logic。

### Layer 3: Frontend 002 SDK Adapter

`Frontend 002 SDK Adapter` 負責 package integration surface:

- `AssistantWidget` public wrapper
- `mountAssistantWidget` imperative lifecycle
- `AssistantHostContextProvider`
- `WidgetConfiguration`
- `HostCallbacks` / `HostEvents`
- SDK request builder
- Compatibility Mode request boundary
- forbidden frontend-owned fields gate
- default transport
- injected authenticated executor
- isolated Vue app lifecycle
- duplicate mount registry
- callback isolation
- package public exports
- package artifact and declaration boundaries

Frontend 002 adapter must not reimplement shared runtime session, SSE, renderer, feedback, action, approval, or state machine behavior.

## 6. Approved Shared Source Boundary

The approved shared source boundary is:

```text
packages/assistant-runtime/**
```

決策:

- `packages/assistant-runtime` 是 internal-only private workspace package / source boundary。
- 它可以有自己的 `package.json`，但用途僅限 workspace、typecheck 與 build organization。
- 它不直接作為 public npm product 發布。
- SDK build 可將此 boundary 的 compiled code bundle 到 `packages/assistant-sdk/dist`。
- Frontend 001 可 import 此 boundary 作為 canonical runtime implementation。
- SDK package exports 不得暴露 `packages/assistant-runtime`、`./runtime`、`./transport`、`./session`、`./context`、`./request`、`./events`、`./fixtures`、`./tests` 或 `./nuxt`。

理由:

- Repo 已使用 `packages/assistant-sdk`，因此 `packages/assistant-runtime` 比 ad hoc top-level `shared/` directory 更符合 package-oriented workspace shape。
- 它可被 Frontend 001 與 Frontend 002 同時 import，且不需要經過 `app/**`。
- 它可擁有 library-specific tsconfig，讓 `vue-tsc` 在 Nuxt app context 之外理解。
- 它讓 no-second-runtime guards 能清楚辨識 canonical owner。
- 它避免 SDK declarations 引用 `app/**`。

Frontend 001 仍是 product behavior owner。Reusable implementation source of truth 會移到 approved shared runtime boundary，讓 ownership 與 source location 不互相衝突。

## 7. Ownership and Source of Truth

| Concern | Owner |
| ------- | ----- |
| Canonical assistant runtime logic | Shared Canonical Assistant Runtime |
| Product behavior, regression expectations, Nuxt host experience | Frontend 001 |
| Nuxt-specific runtime integration | Frontend 001 Nuxt Adapter |
| SDK public API and package integration | Frontend 002 SDK Adapter |
| Backend request authority | Backend |
| Host context input | Host Provider, after SDK validation into allowed request boundary |
| `sourceSystem`, connector, adapter, permission decisions | Backend only |
| Evidence authority and final safe outcome | Backend only |

Frontend 001 is still the original owner of assistant product behavior and canonical regression expectations. The reusable implementation source of truth becomes the shared runtime boundary after extraction. Frontend 002 consumes that runtime through SDK-specific ports and wrappers, not through Frontend 001 app paths.

## 8. Public Package Surface

Public exports:

- `AssistantWidget`
- `mountAssistantWidget`
- Public types for `AssistantHostContextProvider`, `WidgetConfiguration`, `HostCallbacks`, `HostEvents`, integration mode, mount options, mount handle, page context input, sanitized context result, and safe errors.
- Public style entry: `@internal-ai-assistant/assistant-sdk/styles.css`

Forbidden public exports:

- Internal stores.
- Private composables.
- Private transport implementation.
- SSE parser internals.
- Private Vue components.
- Frontend 001 internal paths.
- Shared runtime internal paths.
- Undocumented deep imports.
- `./nuxt`.

Public declarations 必須來自 `packages/assistant-sdk/src/types/**` facade declarations 或等效 SDK public barrels。Public declarations 不得暴露 `packages/assistant-runtime/**` 或 `app/**`。

## 9. Packaging / Release Boundary

Frontend 002 有三個不同邊界:

- **Migration source-time**: 只有 Frontend 001 transitional adapter 可在 extracting canonical implementation 期間 temporary delegate 到尚未搬完的舊 app implementation，且只能作為 delegation。
- **Approved shared runtime source-time**: 最終 reusable implementation 位於 `packages/assistant-runtime/**`。
- **Package build / release-time**: built SDK artifact 會包含來自 approved shared canonical runtime boundary 的 compiled code，不要求 consumers resolve monorepo source paths。

Frontend 002 SDK Adapter 在任何 migration stage 都不得 import `app/features/**`、`app/services/**`、`app/stores/**`、`app/utils/**`，不得透過 alias 直接 bundle Nuxt-bound `ChatWidget`，也不得暫時依賴 Frontend 001 active Nuxt / Pinia context。Canonical Runtime Library-Safe Extraction 完成前，T097-T099 保持 blocked；extraction 完成後，Frontend 002 只能 import `packages/assistant-runtime/**` 或其核准的 internal workspace entry。

可接受的短期 release strategy:

- SDK Vite library build 會將 `packages/assistant-runtime/**` 的 compiled shared runtime code bundle 進 `dist`。
- Vue 保持 external。
- Pinia 是 `assistant-sdk` regular runtime dependency，不是 public peer，不列為需要 consumer 提供的 peer external。
- Pinia 可由 package dependency resolution 提供；SDK build 不得要求 consumer 已有 active Pinia。
- Nuxt 不是一般 SDK consumer 的 required runtime dependency。
- Dist 與 declarations 不得包含 unresolved `app/features`、`app/services`、`app/stores`、`app/utils`、`tests`、`fixtures` 或 `specs` paths。
- Package artifacts 不產生 sourcemaps。

長期策略可以再引入正式 shared runtime package contract，但本 feature 不建立新的 public product，也不建立第二個 published runtime package。

禁止架構:

- SDK consumer 不得需要 Frontend 001 `app/**` repo layout。
- SDK package 不得只是 monorepo source-mode wrapper。
- SDK package 不得 copy 第二套 ChatWidget、composables、SSE parser、assistant API client、session/history runtime、mapper、renderer、feedback、action 或 approval runtime。
- Package exports 不得暴露 `./runtime`、`./runtime/*`、adapter internals、shared runtime internals 或 Frontend 001 internal paths。

## 10. Transport Port and Request Boundary

Shared runtime 只依賴 transport port，不得直接呼叫 `useRuntimeConfig`、`$fetch`、`app/services/api/assistant.ts` 或 SDK public configuration。

Transport port responsibilities include:

- `createSession`
- `loadHistory`
- `sendMessage` / `streamMessage`
- `cancel` / `abort`
- feedback endpoint when needed
- action or approval endpoint when needed

Frontend 001 provides:

- `NuxtAssistantTransportAdapter`
- Nuxt `$fetch` or current app HTTP client binding
- auth / runtime config handoff
- app-specific session persistence when needed

Frontend 002 provides:

- `SdkDefaultTransportAdapter`
- injected authenticated executor adapter
- SDK request builder and forbidden outgoing fields gate
- Compatibility Mode request boundary
- Host Integration fail-closed request boundary

Ownership split:

- SDK / Nuxt adapter builds legal HTTP request and provides fetch / executor capability.
- Shared runtime owns session/history orchestration and canonical SSE consumption.
- Backend owns identity, authorization, evidence, final safe outcome, source metadata, connector/tool choice, and permission decisions.

Transport adapter 不得實作第二套 canonical SSE parser、second session runtime、retry state machine、timeout state machine、renderer、feedback flow、action flow 或 approval display runtime。

## 11. Pinia and State Isolation Decision

本設計選擇方向 A：Shared runtime 保留 library-safe Pinia stores。

Dependency 與 bundling 策略:

- Vue 是 `assistant-sdk` peer dependency，並在 Vite build 中 external；consumer 提供 Vue runtime。
- Pinia 是 `assistant-sdk` regular runtime dependency，不是 public peer contract。
- 一般 SDK consumer 不需要自行安裝 Pinia、初始化 Pinia plugin，或理解 internal workspace layout。
- `packages/assistant-runtime` 可在 internal manifest 宣告 Pinia dependency；最終發布的 `assistant-sdk` package 必須保證 Pinia runtime 可解析。
- Vite 不應將 Pinia 列為需要 consumer 提供的 peer external。
- Pinia 不得成為 SDK public API；SDK public declarations 不得要求 consumer import Pinia types，除非不可避免且已由 SDK facade 封裝。
- Package artifact 與 temporary consumer tests 必須驗證沒有 consumer-side Pinia setup 也能掛載 widget。

規則:

- Shared runtime stores 必須使用 explicit imports，且不得假設 Nuxt-generated Pinia auto-registration。
- Frontend 001 透過 Frontend 001 Nuxt Adapter 建立或提供 Nuxt app Pinia instance。
- Frontend 001 不需要建立第二個 app-level Pinia；shared stores 仍來自 `packages/assistant-runtime`。
- `<AssistantWidget />` 由 SDK wrapper 建立或提供 widget-local runtime scope，不假設 Host App 已 `use()` Pinia。
- `mountAssistantWidget()` 每次 mount 建立 isolated Vue app 與自己的 `createPinia()` instance。
- 每個 widget instance 永遠維持隔離的 in-memory runtime state。
- 不同 widgets 不得共享 streams、listeners、timers、abort controllers、pending callbacks 或 duplicate-mount registry state。
- 多個 widgets 可以顯式指向同一個 backend `sessionId`。
- 共享 backend `sessionId` 不等於共享前端 Pinia / runtime instance。
- 若兩個 widgets 指向同一 backend session，其 local state 仍各自隔離，並由 backend session/history contract 維持資料一致性。
- `destroy` 會釋放 state、streams、listeners、timers、observers、abort controllers、pending callbacks 與 duplicate-mount registry entries。
- Frontend 001 與 SDK 不得隱性共享 active Pinia stores。

`sessionScope` 維持 local-only。它可影響 namespace / fallback behavior，但不得進入 backend request body、headers、PageContext、hidden prompt、message text、transport metadata 或 HostCallbacks payload。

## 12. Vue UI Component Boundary

Shared runtime owns library-safe canonical assistant UI:

- assistant chat component tree
- message list
- composer
- streaming / loading / error surfaces
- done / no_answer / clarification / permission_denied / tool_failure / timeout / interrupted rendering
- EvidenceRef display model
- feedback state
- ActionDraft confirmation visual state
- ApprovalRequest display visual state

Frontend 001 owns:

- Nuxt page wrapper
- app layout integration
- route integration
- Nuxt-only UI adapter
- host app theme integration

Frontend 002 owns:

- `AssistantWidget` public wrapper
- SDK launcher / shell behavior when it is public integration behavior
- theme / configuration adapter
- imperative lifecycle wrapper

Nuxt UI and auto-registered component strategy:

- Assistant child components that move into shared runtime must use explicit imports.
- Nuxt UI primitives used by current Frontend 001 components must be replaced in shared runtime by library-safe Vue components, native elements, or a renderless component plus adapter slot.
- Frontend 001 may keep Nuxt UI wrappers around shared runtime where the behavior remains delegated.
- General SDK consumers must not install a full Nuxt app or Nuxt UI plugin to render the basic widget.

## 13. AssistantHostContextProvider Design

`AssistantHostContextProvider` is request-scoped and async-capable. The package resolves it before every send, retry, restore, or request-builder operation that needs host context.

Required behavior:

- Re-read before each send / retry.
- Await async resolution.
- Stop request on provider failure.
- Show `context unavailable` / `integration error`.
- Allow user or Host App retry.
- Never use stale context as fallback.
- Do not treat provider as the only source of identity / permission metadata; trusted authenticated transport may provide backend contract required metadata.

Provider may provide:

- `hostApp`.
- Organization identifier.
- Authenticated actor handoff metadata.
- Authenticated permission-context handoff metadata, as backend-revalidated input.
- Sanitized PageContext.
- Host-managed `sessionId`.
- Request correlation metadata.
- `sessionScope`, local-only.

Provider must not include:

- `WidgetConfiguration`.
- `HostCallbacks`.
- Token / credential / secret.
- Callback objects.
- Theme, locale, z-index, panel position.
- Connector / adapter / source / permission result authority.

## 14. Mode-tiered Request Builder Design

These are frontend integration / request-builder / provider validation modes. They are not backend request modes.

Both modes share the same assistant session / message / SSE transport ownership. Neither mode changes backend route, request envelope, SSE event contract, AnswerDecision contract, or public assistant API.

### Backend 001 Compatibility Mode

- Use Backend 001 public request shape.
- Do not serialize Frontend 002 Host Context into the request body.
- Omit `pageContext`, `selectedRows`, `entityType`, `entityId`, `visibleColumns`, `screenId`, `route`, host-aware context fields, and Backend 002-only capability/context fields.
- Do not write unknown fields into request body.
- Do not append context into message text.
- Do not create hidden prompt content.
- If final outgoing request lacks Backend 001 required identity, stop or follow existing identity / integration error flow.
- Provider data such as `hostApp`, `sessionScope`, host-managed `sessionId`, and local route/context information may support SDK local lifecycle, namespace, or UI integration, but does not become Backend 001 Compatibility Mode request body data.
- Authenticated identity headers, organization / actor handoff, request correlation, and existing Backend 001 public required request fields remain owned by the transport/authenticated integration contract, not by Frontend 002 Host Context body serialization.
- If Backend 001 public contract later adds host-aware PageContext, it must be implemented as a new explicit contract-backed integration path, not by making Compatibility Mode conditionally accept host context without a dedicated contract.

### Backend 002 Mode

- Fail closed when required organization / identity / permission context is missing.
- Send only backend-contract-compatible sanitized context.
- Do not send frontend-provided `sourceSystem`, connector, adapter, data source, candidate tool, permission result, final evidence source, or approval navigation metadata.
- Consume backend-returned host-aware clarification, permission_denied, tool_failure, permission-safe evidence, backend-derived source metadata, and SSE final safe outcome.

| Field | Backend 001 Compatibility Mode | Backend 002 Mode | Notes |
| ----- | ------------------------------ | ---------------- | ----- |
| `hostApp` | Use only if required by Backend 001 identity headers / transport contract | Required when Backend 002 contract requires host app context | Not a frontend authority source |
| organization identifier | Required in final Backend 001 identity contract | Required; missing value fails closed | Not guessed from route/storage |
| actor handoff metadata | Required in final Backend 001 identity contract | Required by Backend 002 identity boundary | May be supplied by trusted transport |
| permission-context handoff metadata | Optional if Backend 001 contract allows | Backend-revalidated input; missing required context fails closed | Frontend never computes permission |
| sanitized PageContext | Omitted from Compatibility Mode request body | Sent only in contract-allowed shape | No raw entity payload |
| selectedRows | Omitted from Compatibility Mode request body | IDs / safe summary only, max 20 | Frontend validation does not replace backend authorization |
| `entityType` / `entityId` | Omitted from Compatibility Mode request body | Sent only when contract-allowed and sanitized | Not identity proof |
| host-managed sessionId | Existing session ownership / resume hint | Existing session ownership / resume hint | Not identity proof |
| `sessionScope` | Local-only, not transported | Local-only, not transported | Namespace / fallback only |
| `WidgetConfiguration` | Local-only | Local-only | Never serialized |
| `HostCallbacks` | Local-only | Local-only | Never serialized |
| `sourceSystem` | Forbidden | Forbidden | Backend-owned metadata |
| connector / adapter | Forbidden | Forbidden | Backend-owned selection |
| `permissionResult` | Forbidden | Forbidden | Backend-owned decision |
| token / credential | Forbidden | Forbidden | Never provider/config/callback/storage/log |

## 15. PageContext Sanitization Design

Frontend 002 performs generic validation and minimization before request building:

- Accept primitive / plain-object shapes only.
- Enforce defensive size and string limits.
- Reject raw row objects.
- Reject function, DOM node, class instance, circular object, prototype-pollution keys, and secret-like keys.
- Accept selectedRows only as ID or safe summary.
- Count raw selectedRows input before sanitization.
- Reject the entire context when selectedRows exceed 20.
- Do not truncate selectedRows silently.
- Treat route query / hash as untrusted.
- Treat visibleColumns as hints only.
- Do not use PageContext as permission, source, connector, adapter, or evidence authority.

Frontend sanitization does not replace Backend 002 HostApp-specific allowlists, row-level permission, field-level permission, organization authorization, capability governance, or backend validation.

## 16. Forbidden Outgoing Request Fields

Request builder must include a forbidden-fields gate before sending any backend request. The gate blocks:

- `sourceSystem`
- `connector`
- `connectorId`
- `adapter`
- `adapterId`
- `dataSource`
- `candidateTool`
- `candidateTools`
- `toolName`
- `permissionResult`
- `fieldPermissionResult`
- `rowPermissionResult`
- `finalEvidenceSource`
- `rawEvidence`
- `rawConnectorPayload`
- Routing hints
- Approval navigation metadata
- Token
- Credential
- Secret
- Connection detail
- `WidgetConfiguration`
- `HostCallbacks`
- Callback functions
- Raw business payload

Failure behavior:

- Stop request before transport.
- Surface integration error / context unavailable as appropriate.
- Provide developer-facing diagnostics that identify the rejected category.
- Show user-safe message without leaking rejected payload.
- Do not ask backend to accept forbidden fields.

## 17. Session Ownership and Fallback Design

Session priority:

- Host-managed `sessionId` wins.
- If no host-managed `sessionId`, and mode / namespace / storage conditions are safe, use `sessionStorage` fallback pointer.
- If `sessionStorage` is unavailable, use same-runtime memory-only fallback.
- Never use `localStorage` or cookie fallback.

Fallback namespace includes at minimum:

- Package namespace / package major compatibility namespace.
- `hostApp`.
- Organization identifier.
- `sessionScope`.
- Page identity for page scope.
- Entity type and entity ID for entity scope.

Safety rules:

- Missing organization identifier prevents organization-scoped persistent fallback.
- Organization change terminates old session context, SSE, history loading, listeners, timers, and fallback namespace usage.
- Entity / scope change cleans stale context and session pointers.
- Duplicate mount is guarded and diagnosable.
- Unmount / destroy is idempotent and cleans listeners, timers, observers, and active streams.

Host-managed `sessionId` is not identity / permission / organization proof. Memory-only session is not identity proof. `sessionScope` does not enter backend request.

## 18. Widget Lifecycle Design

Lifecycle operations:

- `initialize`: validate public configuration and prepare provider/config/callback boundaries.
- `mount`: client-only attach to target container with isolated runtime state.
- `open`: open panel and bootstrap session restore / create.
- `close`: close panel without destroying package state.
- `unmount` / `destroy`: cancel stream, remove listeners, release timers, stop post-unmount state updates.
- Route change: invalidate stale PageContext and re-resolve provider on next request.
- Entity change: update local session namespace and prevent stale entity history usage.
- selectedRows change: re-sanitize and reject overflow.
- Organization change: terminate old context and enter new namespace.
- `sessionScope` change: local namespace change only.
- Host-managed `sessionId` change: switch to corresponding session.
- Session reset: clear local pointer and start new session path.

SSR import must be safe: no top-level `window`, `document`, `sessionStorage`, DOM, or browser-only access. Widget interaction is client-only.

Mount container missing results in diagnosable integration error. Duplicate mount either returns the existing handle or fails safely according to implementation choice in `plan.md`, but must not create two active widget instances on one Host App page.

## 19. HostCallbacks / HostEvents Design

Minimum event surface:

- widget opened
- widget closed
- session created
- session changed
- answer completed
- error occurred
- approval detail requested
- escalation requested
- context resolution failed

Payload rules:

- Minimal event payloads only.
- No raw business data.
- No raw SSE payload.
- No token / credential / secret.
- No callback payload serialized into PageContext or backend request.

Approval detail callback payload contains only:

- `approvalRequestId`
- `sessionId`
- `messageId`

Package does not infer, hardcode, or assemble Host App navigation URL. Host App owns routing and navigation. Callback exceptions are isolated and must not crash assistant runtime.

## 20. Styling and Theming Design

Public stylesheet entry:

- `@internal-ai-assistant/assistant-sdk/styles.css`

Supported v1 controls:

- Limited CSS variables / tokens.
- Light / dark / system mode.
- Panel position.
- Panel size boundary.
- Launcher enabled.
- z-index.
- Basic accessibility, keyboard navigation, focus management, and understandable state announcements.

Avoid:

- Arbitrary CSS injection.
- Global reset.
- Host root token mutation except documented variables.
- Shadow DOM.
- iframe mode.
- Complete theme builder.

Missing stylesheet import should produce diagnosable degraded appearance or documented integration gap, not opaque runtime failure.

## 21. SSR / Nuxt 4 Integration Design

Nuxt integration supports:

- SSR import-safe package entry.
- Client-only widget mount.
- Component usage through `AssistantWidget`.
- Optional plugin or imperative usage through `mountAssistantWidget`.
- Current Nuxt app as reference consumer / preview harness.
- Consumer uses its own Vue runtime.
- No second Vue app for normal Nuxt component usage.
- Isolated Vue app and isolated Pinia/runtime state for imperative SDK mount usage.
- Nuxt is optional for general SDK consumers and must not be required to render the basic widget.
- Diagnosable install / build warning or error for incompatible peers.

SDK imperative mount must never depend on Frontend 001 active Nuxt app, Frontend 001 active Pinia instance, Nuxt plugins, Nuxt route instance, or auto-registered Frontend 001 components.

## 22. Declaration Generation and Build Boundary

Frontend 001 build:

- 使用 Frontend 001 Nuxt Adapter 與 shared runtime。
- 只可在 shared runtime boundary 外依賴 Nuxt app context。
- 保留既有 Frontend 001 regression suite 作為 release gate。

Shared runtime typecheck:

- 在 library-safe tsconfig 下執行。
- 只使用 explicit imports。
- 不需要 Nuxt-generated types。
- 阻擋 Nuxt globals、`app/**` services 或 active app state 被重新引入。

Frontend 002 SDK declaration build:

- 從 SDK facade types 產生 public declarations。
- 不得 reference `app/**`。
- 不得 expose `packages/assistant-runtime/**`。
- 不得 expose SDK internal `runtime`、`transport`、`session`、`context`、`request` 或 `events` modules。
- 允許 compiled shared runtime code 進入 `dist/index.mjs`。
- npm tarball 排除 raw shared source，除非後續 packaging strategy 明確允許且不破壞 public boundary。
- Vue 保持 external。
- 不讓 Nuxt 成為 required runtime dependency。
- 不產生 sourcemaps。

Any SDK declaration containing `app/features`, `app/services`, `app/stores`, `app/utils`, `tests`, `fixtures`, or `specs` is a build blocker.

## 23. Backend 002 Integration-dependent Design

When Backend 002 is not ready:

- Independent Package Readiness remains possible.
- Backend 001 Compatibility Mode validates package install, mount, provider, config, callbacks, session, lifecycle, request shape omission, and existing chat flow.

When Backend 002 is ready:

- Frontend 002 sends sanitized context that matches backend contract.
- Backend performs host-aware capability governance, PageContext policy, permission boundary, source consistency, connector / tool eligibility, EvidenceRef handling, and safe outcome decisions.
- Frontend consumes safe backend outcomes only.
- Frontend does not validate, select, or control backend internal connector / tool selection.

## 24. Migration Strategy

Stage 1: Dependency inventory

- Inventory current `ChatWidget` transitive dependencies.
- Classify dependencies as shared-safe, Nuxt-specific, or Frontend 001 app-specific.
- Identify all auto-import globals, Nuxt UI primitives, app services, app stores, app types, and generated Nuxt types.

Stage 2: Shared runtime boundary establishment

- 建立 `packages/assistant-runtime/**`。
- 加入 library-safe typecheck / build guard。
- 不先 copy complete runtime 形成 long-lived fork。

Stage 3: Transport and state ports

- 移除 shared runtime 對 Nuxt HTTP、`useRuntimeConfig` 與 active Pinia 的依賴。
- 定義 Frontend 001 Nuxt Adapter 與 Frontend 002 SDK Adapter 需要 consume 的 ports。

Stage 4: Canonical implementation extraction

- 將 canonical state、SSE、session/history、safe outcome mapping 與 library-safe UI 移入 shared runtime。
- 讓 Frontend 001 使用 shared runtime。
- 刪除、停止使用或薄化舊 app implementation，確保只有一個 active owner。

Canonical Runtime Library-Safe Extraction 是 behavior-preserving internal migration。內部程式碼與依賴邊界會重構，但 Frontend 001 public assistant API consumption、Backend 001 request/SSE contract、Frontend 001 `ChatWidget` 對使用者呈現的 canonical behavior、session/history/safe outcome 功能、Feedback、ActionDraft、ApprovalRequest 與 EvidenceRef semantics 必須保持相容。Frontend 001 現有 component、integration 與 e2e regressions 是每個 migration stage 的 required gate；在對應 regressions 通過前，不得移除舊 owner 或切換 single owner。

Stage 5: Frontend 001 regression closure

- 維持 session、history、SSE、no_answer、clarification、permission_denied、tool_failure、feedback、action、approval、retry、cancel、timeout 與 interrupted behavior 全部通過。

Stage 6: SDK productization

- Extraction 完成後再恢復 T097-T099 目標。
- 將 `AssistantWidget` 與 `mountAssistantWidget` 接到同一個 shared runtime。
- Build 與 pack SDK 時不得留下 unresolved monorepo paths。

Stage 7: Publish readiness

- Productized runtime 完成後再完成 metadata、README 與 release closeout。

## 25. Migration Guardrails

- 不得將 Frontend 001 ChatWidget copy 到 shared runtime 後保留兩套 active implementations。
- 不得加入 simplified SDK runtime 作為 temporary productization shortcut。
- 不得讓 Frontend 001 old store 與 shared runtime store 同時作為 canonical owner。
- 每個 extraction step 必須定義 single-owner migration condition。
- Transitional wrappers 只能 delegate，且不得包含 parallel business logic。
- Extraction 完成後，舊 canonical app implementation 必須被刪除、停用或降為 wrapper。
- Architecture guards 必須持續拒絕 duplicate ChatWidget、API client、SSE parser、session/history runtime、AnswerDecision mapper、EvidenceRef renderer、feedback flow、action runtime 與 approval runtime。

## 26. T094 Method/Path-Aware Test Fixture Design

Packaged Compatibility Mode tests 可以覆蓋與 real runtime 相同的 canonical call graph:

```text
POST /assistant/sessions
GET /assistant/sessions/:sessionId/messages
POST /assistant/sessions/:sessionId/messages
```

Test fetch fixture 必須 method/path-aware:

- session creation 回 JSON。
- history loading 回 JSON。
- message send 回 `text/event-stream`。

這是 test adapter correction，不是 production transport contract。測試不得讓所有 fetch call 都收到同一個 SSE response。

## 27. Failure Modes and Fail-Closed Behavior

- 缺少 shared runtime transport adapter 時 fail closed，且不發 request。
- 缺少 SDK provider 或 required configuration 時回傳 safe configuration error。
- Nuxt adapter 未初始化時回傳可診斷的 Frontend 001 startup error。
- Duplicate active runtime owner 會使 architecture guard 失敗。
- SDK declaration output 若包含 `app/**`，即為 build blocker。
- Shared runtime 若 import Nuxt globals，即為 typecheck blocker。
- SDK bundle 若保留 unresolved monorepo source paths，即為 package blocker。
- Frontend provider/config/callback input 若帶 backend authority fields，必須在 request send 前 fail closed。

## 28. Testing Strategy

### Shared Runtime Tests

- unit tests
- component tests
- SSE parser tests
- stream lifecycle tests
- session / history orchestration tests
- safe outcome tests
- state isolation tests

### Frontend 001 Adapter Tests

- Nuxt transport adapter tests
- Pinia / Nuxt integration tests
- existing ChatWidget regression tests
- route / app integration tests

### Frontend 002 Adapter Tests

- provider / configuration / callback wiring tests
- request security tests
- imperative lifecycle tests
- package consumer tests
- public export tests

### Cross-boundary Tests

- no-second-runtime guard
- shared runtime source ownership guard
- no Nuxt globals in shared runtime
- no `app/**` declarations
- Frontend 001 regression gate
- packed SDK Compatibility Mode tests
- package artifact smoke
- dist internal path scan

既有 T092-T096 Tests First 仍然有效，不因 extraction 而回滾；shared runtime 變成 library-safe 之後，它們會成為 productized SDK readiness gates。

## 29. Security / Privacy / Isolation Design

Security boundaries:

- No raw business payload in request, storage, logs, telemetry, or events.
- No token / credential / secret storage.
- No raw PageContext in storage/log/event.
- No cross-host session contamination.
- No cross-organization fallback session contamination.
- No stale context after route/entity/organization change.
- No dangling SSE/listeners/timers after unmount or destroy.
- No frontend-derived permission/source/connector authority.
- No approval navigation metadata in outgoing request.
- No package-specific backend proxy.

## 30. Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| 直接 package Nuxt-bound app source | T097-T099 productization 前必須先完成 Canonical Runtime Library-Safe Extraction |
| 意外建立第二套 API client | Transport adapter 保持 low-level，canonical runtime 放在 shared boundary |
| Provider / config / callbacks boundary 混淆 | Public types 與 request-builder gate 分離 provider、local-only config 與 callbacks |
| Stale context | 每次 send / retry 前 resolve provider，失敗時 fail closed |
| Unsafe fallback session | Namespace by package、host、organization、scope、page/entity；缺 organization 時拒絕 persistent fallback |
| selectedRows raw payload leakage | Validate raw count，拒絕 >20，只接受 ID / safe summary |
| Injected transport bypass | Executor 前必須完成 sanitization / mode validation，且禁止 request envelope mutation |
| Backend 001 vs Backend 002 mode confusion | 將 modes 記錄為 frontend integration modes，而不是 backend request modes |
| CSS leakage | Styles scope 到 package root；禁止 global reset；測試 reference consumer computed styles |
| Frontend 001 runtime contract drift | Same-version track 與 Frontend 001 regression gate |
| Backend 002 availability not ready | 保留 Backend 001 Compatibility Mode independent package readiness path |
| `private` flag removed too early | Productized runtime completeness 通過前，publish readiness 必須保持 blocked |

## 31. T097-T102 Design Dependencies

T097-T099 runtime productization 依賴 Canonical Runtime Library-Safe Extraction。`AssistantWidget` 與 `mountAssistantWidget` 必須在 extraction 後接到 shared runtime，不得直接接 Nuxt-bound `app/**` source，也不得接簡化版 SDK runtime。

T100-T102 publish readiness 依賴 T097-T099 runtime productization。當 installed SDK 仍缺少完整 runtime behavior 時，不得推進 metadata、README、GitHub Packages readiness 或 private flag changes。

## 32. Open Questions / Non-blocking Follow-ups

No blocking design questions remain.

Non-blocking follow-ups for implementation planning:

- Exact `packages/assistant-runtime` workspace manifest shape.
- Exact library-safe replacement strategy for each current Nuxt UI primitive.
- Exact split between shared runtime transport port and SDK request builder implementation files.
