# Design: Internal Assistant Embedded SDK Package

**Feature**: `002-internal-assistant-embedded-sdk-package`  
**Spec**: `specs/002-internal-assistant-embedded-sdk-package/spec.md`  
**Status**: Draft design, ready for `plan.md`

## 1. Overview

Frontend 002 將 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 與 chat runtime 封裝成 Vue 3 / Nuxt 4 Host App 可安裝、初始化、掛載、卸載與整合的 npm-compatible SDK package。

```text
Frontend 001
= AI 助理聊天面板本體與 chat runtime

Frontend 002
= npm package / SDK、Host App integration contract、
  package lifecycle、context provider、session isolation、
  consumer integration 與 package compatibility
```

Frontend 002 不是新的聊天產品，也不是 Frontend 001 的重寫。它不得建立第二套 ChatWidget、assistant API client、SSE parser、session / history pipeline、AnswerDecision mapper、EvidenceRef renderer、feedback flow、ActionDraft confirmation、ApprovalRequest display behavior、retry / cancel / interrupted behavior。

Frontend 002 不改 Backend 001 / Backend 002 public API。Backend 002 是 full host-aware integration dependency，但不阻塞 Independent Package Readiness；Backend 002 未完成或未接入時，package 仍可透過 Backend 001 Compatibility Mode 完成 build、install、mount、provider、session、lifecycle 與一般聊天 smoke 驗證。

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

The current Nuxt app root (`.`) is the v1 reference consumer / preview harness. `nuxt.config.ts` auto-registers `app/features/assistant/components` and imports `app/features/assistant/composables`.

### Repository Gaps

- `packages/assistant-sdk/` does not currently exist and must be created by a later implementation plan.
- No workspace package configuration for `@internal-ai-assistant/assistant-sdk` currently exists.
- Library build config for the SDK package has not been selected and must be decided in `plan.md`.

## 4. Target Package Architecture

Target package ownership is a repo-internal workspace package:

```text
packages/assistant-sdk/
├── src/
│   ├── index.ts
│   ├── components/
│   ├── runtime/
│   ├── context/
│   ├── transport/
│   ├── session/
│   ├── events/
│   ├── styles/
│   └── types/
├── styles.css
├── package.json
└── library build config
```

The exact build tool is a non-blocking follow-up for `plan.md`. The design intent is:

- Public entry is only `packages/assistant-sdk/src/index.ts`.
- Stylesheet public entry is `@internal-ai-assistant/assistant-sdk/styles.css`.
- Internal modules may wrap Frontend 001 runtime but must not become stable deep-import contracts.
- Frontend 001 reusable runtime should be imported through repo-internal module boundaries established by implementation, not copied into the package.
- Reference consumer must import only public package entries.

Copied code is forbidden when it would create a second runtime. If implementation needs to move or extract reusable units from `app/features/assistant`, that refactor must keep one canonical runtime owner and make Frontend 001 regression tests part of Frontend 002 release gating.

## 5. Public Package Surface

Public exports:

- `AssistantWidget`
- `mountAssistantWidget`
- Public types for `AssistantHostContextProvider`, `WidgetConfiguration`, `HostCallbacks`, `HostEvents`, integration mode, mount options, mount handle, page context input, sanitized context result, and safe errors.
- Public style entry: `@internal-ai-assistant/assistant-sdk/styles.css`

`mountAssistantWidget` returns a handle that supports at minimum `open`, `close`, `unmount` / `destroy`, and safe idempotent cleanup. It must not create a second Vue app for Nuxt component usage; the helper is only for limited imperative mount scenarios.

Forbidden public exports:

- Internal stores.
- Private composables.
- Private transport implementation.
- SSE parser internals.
- Private Vue components.
- Frontend 001 internal paths.
- Undocumented deep imports.

## 6. Runtime Reuse Boundary

Frontend 001 owns:

- Chat UI and message rendering.
- Assistant API service behavior.
- SSE parser and stream handling.
- Session / history state.
- AnswerDecision state mapping.
- Evidence rendering and normalization.
- Feedback flow.
- ActionDraft and ApprovalRequest display behavior.
- Retry / cancel / timeout / interrupted behavior.

Frontend 002 owns:

- Package public API.
- Host App integration contract.
- Provider / configuration / callbacks boundaries.
- Request builder mode policy.
- Package lifecycle and mount helpers.
- Session isolation and fallback namespace policy.
- Reference consumer package integration.

Frontend 002 must not fork or copy a second implementation of Frontend 001 runtime. Same-version track means Frontend 001 and Frontend 002 release together; a Frontend 001 regression in session, SSE, history, evidence, feedback, risk-state rendering, or approval display blocks Frontend 002 release.

## 7. AssistantHostContextProvider Design

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

`sessionScope` is local-only. It is not serialized into backend request body, headers, PageContext, hidden prompt, message text, transport metadata, or HostCallbacks payload.

## 8. Mode-tiered Request Builder Design

These are frontend integration / request-builder / provider validation modes. They are not backend request modes.

Both modes share the same assistant session / message / SSE transport ownership. Neither mode changes backend route, request envelope, SSE event contract, AnswerDecision contract, or public assistant API.

### Backend 001 Compatibility Mode

- Use Backend 001 public request shape.
- Omit Frontend 002-only Host Context fields.
- Do not write unknown fields into request body.
- Do not append context into message text.
- Do not create hidden prompt content.
- If final outgoing request lacks Backend 001 required identity, stop or follow existing identity / integration error flow.

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
| sanitized PageContext | Optional by Backend 001 body where allowed | Sent only in contract-allowed shape | No raw entity payload |
| selectedRows | IDs / safe summary only, max 20 | IDs / safe summary only, max 20 | Frontend validation does not replace backend authorization |
| host-managed sessionId | Existing session ownership / resume hint | Existing session ownership / resume hint | Not identity proof |
| `sessionScope` | Local-only, not transported | Local-only, not transported | Namespace / fallback only |
| `WidgetConfiguration` | Local-only | Local-only | Never serialized |
| `HostCallbacks` | Local-only | Local-only | Never serialized |
| `sourceSystem` | Forbidden | Forbidden | Backend-owned metadata |
| connector / adapter | Forbidden | Forbidden | Backend-owned selection |
| `permissionResult` | Forbidden | Forbidden | Backend-owned decision |
| token / credential | Forbidden | Forbidden | Never provider/config/callback/storage/log |

## 9. PageContext Sanitization Design

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

## 10. Forbidden Outgoing Request Fields

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

## 11. Transport Ownership Design

The package owns:

- Endpoint selection.
- Request shape construction.
- SSE parser.
- Retry / cancel / timeout / error flow.
- Sanitization and mode validation before transport.

Default transport uses Frontend 001-compatible assistant service behavior. Injected authenticated transport executor is low-level only and may provide authenticated request / stream execution.

Injected executor must not:

- Rewrite assistant API route.
- Create a second API client contract.
- Create a second SSE parser.
- Change request envelope.
- Bypass sanitization.
- Bypass mode validation.
- Serialize local-only state.

Transport exceptions return to existing Frontend 001 error / retry flow.

## 12. Session Ownership and Fallback Design

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

## 13. Widget Lifecycle Design

Lifecycle operations:

- `initialize`: validate public configuration and prepare provider/config/callback boundaries.
- `mount`: client-only attach to target container.
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

## 14. HostCallbacks / HostEvents Design

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

## 15. Styling and Theming Design

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

## 16. SSR / Nuxt 4 Integration Design

Nuxt integration supports:

- SSR import-safe package entry.
- Client-only widget mount.
- Component usage through `AssistantWidget`.
- Optional plugin or imperative usage through `mountAssistantWidget`.
- Current Nuxt app as reference consumer / preview harness.
- Consumer uses its own Vue runtime.
- No second Vue app for normal Nuxt integration.
- Peer dependency boundary for Vue / Nuxt, exact range deferred to `plan.md`.
- Diagnosable install / build warning or error for missing incompatible peers.

## 17. Backend 002 Integration-dependent Design

When Backend 002 is not ready:

- Independent Package Readiness remains possible.
- Backend 001 Compatibility Mode validates package install, mount, provider, config, callbacks, session, lifecycle, request shape omission, and existing chat flow.

When Backend 002 is ready:

- Frontend 002 sends sanitized context that matches backend contract.
- Backend performs host-aware capability governance, PageContext policy, permission boundary, source consistency, connector / tool eligibility, EvidenceRef handling, and safe outcome decisions.
- Frontend consumes safe backend outcomes only.
- Frontend does not validate, select, or control backend internal connector / tool selection.

## 18. Testing Strategy

### Independent Package Readiness Tests

- Package public export tests.
- SSR import safety tests.
- Component mount tests.
- Context provider resolution tests.
- Request builder mode tests.
- PageContext sanitization tests.
- Forbidden outgoing fields tests.
- selectedRows max 20 tests.
- Session isolation tests.
- Lifecycle cleanup tests.
- Transport ownership tests.
- Host events / callbacks tests.
- Style isolation tests.
- Reference consumer smoke tests.
- Backend 001 Compatibility Mode integration tests.
- Frontend 001 regression gates.

### Backend 002 Integration-dependent Tests

- Backend 002 mode fail-closed context tests.
- Sanitized context submission smoke.
- Host-aware clarification consumption.
- permission_denied / tool_failure rendering.
- Permission-safe evidence consumption.
- Backend-derived source metadata display / preservation.
- SSE final safe outcome consumption.

Test doubles may use fake provider, stub low-level executor, deterministic SSE fixture, and backend response fixture, but they must align with formal contracts and must not become a third integration mode.

## 19. Security / Privacy / Isolation Design

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

## 20. Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Accidentally creating second API client | Reuse `AssistantService` contract and keep transport executor low-level only |
| Provider / config / callbacks boundary confusion | Public types and request-builder gate separate provider, local-only config, and callbacks |
| Stale context | Resolve provider before each send / retry; fail closed on failure |
| Unsafe fallback session | Namespace by package, host, organization, scope, page/entity; refuse persistent fallback without organization |
| selectedRows raw payload leakage | Validate raw count, reject >20, accept ID / safe summary only |
| Injected transport bypass | Require sanitization / mode validation before executor and disallow request envelope mutation |
| Backend 001 vs Backend 002 mode confusion | Document modes as frontend integration modes, not backend request modes |
| CSS leakage | Scope styles to package root; no global reset; test reference consumer computed styles |
| Frontend 001 runtime contract drift | Same-version track and Frontend 001 regression gate |
| Backend 002 availability not ready | Keep Backend 001 Compatibility Mode independent package readiness path |

## 21. Open Questions / Non-blocking Follow-ups

No blocking open questions for design.md.

Non-blocking follow-ups for `plan.md`:

- Exact library build tool and config.
- Exact peer dependency ranges.
- Concrete workspace package setup.
- Exact public type filenames and internal module aliases.
- Reference consumer integration route / preview harness placement.
