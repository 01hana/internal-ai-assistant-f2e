# Implementation Plan: Internal Assistant Embedded SDK Package

**Feature**: `002-internal-assistant-embedded-sdk-package`  
**Date**: 2026-07-15  
**Spec**: `specs/002-internal-assistant-embedded-sdk-package/spec.md`  
**Design**: `specs/002-internal-assistant-embedded-sdk-package/design.md`  
**Status**: Canonical Runtime Library-Safe Extraction plan finalized; ready for tasks.md cleanup after human validation

## 1. Overview

Frontend 002 的 implementation 目標是把 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 與 chat runtime 封裝成 Vue 3 / Nuxt 4 Host App 可安裝、初始化、掛載、卸載、提供最新 Host Context、管理 session 邊界、接收 host events 的 npm-compatible SDK package。

```text
Frontend 001 Nuxt Adapter
- Nuxt runtime config
- Nuxt HTTP/auth
- app integration
              │
              ▼
Shared Canonical Assistant Runtime
- canonical state
- session/history
- SSE
- outcomes
- feedback/action/approval
- library-safe UI
              ▲
              │
Frontend 002 SDK Adapter
- public SDK API
- provider/config/callbacks
- request security
- mount lifecycle
- packaging
```

Ownership is intentionally split: Frontend 001 owns Nuxt/app integration and remains the product behavior baseline, `packages/assistant-runtime/**` owns the reusable canonical runtime implementation, and Frontend 002 owns the SDK public package surface, lifecycle, request/security adapter, and artifact boundary.

Frontend 002 不是新的聊天產品，也不是 Frontend 001 的重寫。Implementation 必須重用 Frontend 001 runtime，不建立第二套 assistant runtime，不修改 Backend 001 / Backend 002 public API，也不把 Backend 002 integration-dependent acceptance 當成 package readiness 的阻塞條件。

Frontend 002 的完成狀態分成三層：

- Independent Package Readiness：build / install / mount / provider / configuration / callbacks / session / lifecycle / Backend 001 Compatibility Mode smoke。
- Backend 002 Integration-dependent Acceptance：需要 backend host-aware capability governance、PageContext policy、permission boundary、source consistency 與 safe outcomes 可用後才能驗證。
- Productized SDK Publish Readiness：built package contains complete AssistantWidget runtime, `mountAssistantWidget` mounts the complete widget, README and publish metadata are present, package can be prepared for GitHub Packages publish readiness, and external consuming apps can install through public entries only.

Phase 10 closes the artifact release boundary. Phase 11 closes productized SDK runtime and publish readiness.

## 2. Source Documents and Constraints

### Source Documents

- Frontend 002 spec: `specs/002-internal-assistant-embedded-sdk-package/spec.md`
- Frontend 002 design: `specs/002-internal-assistant-embedded-sdk-package/design.md`
- Frontend 001 Spec Kit inputs:
  - `specs/001-internal-assistant-embedded-chat-panel/spec.md`
  - `specs/001-internal-assistant-embedded-chat-panel/design.md`
  - `specs/001-internal-assistant-embedded-chat-panel/plan.md`
  - `specs/001-internal-assistant-embedded-chat-panel/tasks.md`
- Backend 001 public contract handoff:
  - `docs/contracts/backend-assistant-core/`
  - existing Frontend 001 assistant service / types / SSE parser / runtime behavior
  - existing request / SSE / AnswerDecision / EvidenceRef / feedback / approval display behavior consumed by Frontend 001
- Repository baseline recorded in Frontend 002 `design.md`

### Backend 002 Alignment Boundary

This plan does not require direct implementation dependency on Backend 002 spec / design / plan / tasks files. Backend 002 alignment is consumed through the accepted Frontend 002 spec/design boundary:

- Backend 001 Compatibility Mode and Backend 002 Mode are frontend integration / request-builder / provider validation modes, not backend request modes.
- No new backend route, backend request envelope, backend SSE event contract, backend AnswerDecision contract, backend EvidenceRef contract, backend approval / feedback / action draft contract.
- No nested `hostContext`, backend `sessionScope`, mode-specific backend endpoint, mode-specific SSE parser, mode-specific request envelope, or frontend-specific backend proxy.
- Backend 001 Compatibility Mode does not serialize Frontend 002 Host Context into the request body. Backend 002 / Host Integration paths may send only contract-backed request-scoped Host Context, sanitized PageContext, selectedRows ID / safe summary, host-managed sessionId, authenticated actor handoff metadata, authenticated permission-context handoff metadata, and request correlation metadata as backend-revalidated input.
- Frontend 002 must not send or derive `sourceSystem`, connector, connectorId, adapter, adapterId, dataSource, candidateTool, candidateTools, toolName, permissionResult, fieldPermissionResult, rowPermissionResult, finalEvidenceSource, rawEvidence, rawConnectorPayload, routing hints, or approval navigation metadata.
- Backend remains the sole authority for identity validation, organization boundary, role / permission interpretation, connector / tool eligibility, backend-owned source metadata, EvidenceRef normalization / persistence / safe evidence, AnswerDecision, no-answer, permission-denied, tool-failure, and safe outcome.

## 3. Current Repository Baseline

Existing Frontend 001 runtime:

- Widget shell / panel: `app/features/assistant/components/ChatWidget.vue`, `app/features/assistant/components/ChatPanel.vue`
- Message and state UI: `app/features/assistant/components/`
- Main chat runtime: `app/features/assistant/composables/useChat.ts`
- Host context runtime: `app/features/assistant/composables/useAssistantHostContext.ts`, `app/features/assistant/composables/useAssistantHostContextAdapter.ts`
- Session / history runtime: `app/features/assistant/composables/useAssistantSession.ts`
- SSE stream runtime: `app/features/assistant/composables/useAssistantSseStream.ts`
- Assistant API service: `app/services/api/assistant.ts`
- HTTP client entry: `app/services/index.ts`
- Stores: `app/stores/assistant/useChatWidgetStore.ts`, `app/stores/assistant/useSessionStore.ts`
- Types: `app/types/assistant/`
- SSE parser: `app/utils/assistant/assistantSseParser.ts`
- Answer / evidence helpers: `app/utils/assistant/answerDecisionStateMapper.ts`, `app/utils/assistant/assistantMessageRendererResolver.ts`, `app/utils/assistant/evidenceNormalizationAdapter.ts`
- PageContext and session helpers: `app/utils/assistant/pageContextSanitizer.ts`, `app/utils/assistant/sessionScopeKeyGenerator.ts`, `app/utils/assistant/sessionStorageSessionMap.ts`, `app/utils/assistant/sessionRecovery.ts`, `app/utils/assistant/defaultSessionScopeResolver.ts`, `app/utils/assistant/requestIdGenerator.ts`
- Current Nuxt reference consumer / preview harness: repository root app with `nuxt.config.ts`

### Initial Repository Gaps Before Phase 0

These gaps describe the initial state before Phase 0 execution and are retained only as historical planning context.

- `packages/assistant-sdk/` does not exist.
- `@ideaxpress/assistant-sdk` workspace package does not exist.
- Library build config for the SDK package has not been selected or created.
- Public package export boundary does not exist yet.
- Reference consumer does not yet consume the assistant through package public entry.

### Post-Phase-10 Baseline

- `packages/assistant-sdk/` exists.
- `@ideaxpress/assistant-sdk` workspace package exists.
- Vite library build support exists.
- Public package exports exist and remain limited to root entry plus `./styles.css`.
- Phase 10 validates real build / pack / dist / package artifact boundary.
- Remaining Phase 11 gap is productized runtime completeness and publish readiness, not basic package skeleton or artifact existence.

## 4. Implementation Discovery and Plan Correction

T097-T099 preflight proved that the original "minimal adapter treats `app/features/assistant/components/ChatWidget.vue` as final package runtime source" implementation strategy is no longer valid:

- Frontend 001 `ChatWidget` is the canonical behavior owner.
- Current runtime still depends on Nuxt auto-imports.
- Current runtime still depends on `useRuntimeConfig`.
- Current runtime still depends on Frontend 001 app-level Pinia stores.
- Current runtime still depends on app services, app types, and Nuxt UI.
- Vite can transitively bundle `app/**`.
- `vue-tsc` / declaration generation cannot safely process the `app/**` source graph for an SDK package.
- Isolated SDK consumers do not have the Frontend 001 Nuxt app, active Pinia, plugins, or auto-registered components.

This does not invalidate the product goals. Frontend 001 remains the canonical product behavior owner, Frontend 002 still must not create a second runtime, and original T097-T102 remain valid. The corrected strategy adds **Canonical Runtime Library-Safe Extraction** before resuming productized SDK runtime work.

## 5. Technical Context and Project Structure

Technical context:

- Frontend 001: Nuxt 4, Vue 3, Pinia, existing assistant `ChatWidget` and runtime behavior.
- Shared Runtime: `packages/assistant-runtime/**`, internal-only private workspace boundary, library-safe Vue + Pinia runtime, explicit imports, no Nuxt app dependency, no direct public publish.
- Frontend 002: `packages/assistant-sdk/**`, Vue peer dependency and Vite external, Pinia regular runtime dependency, Nuxt optional / non-required runtime, Vite library build, `vue-tsc` declaration build.

Pinia strategy:

- Vue is the SDK peer dependency and remains external.
- Pinia is an `assistant-sdk` regular runtime dependency.
- Pinia is not a public peer and does not require consumer initialization.
- Pinia is provided by package dependency resolution.
- Pinia is not treated as consumer-provided external.
- The plan defaults to avoiding duplicate Pinia bundling into SDK dist.

Target structure:

```text
packages/
├── assistant-runtime/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── components/
│       ├── composables/
│       ├── stores/
│       ├── runtime/
│       ├── session/
│       ├── transport/
│       ├── sse/
│       ├── outcomes/
│       ├── feedback/
│       ├── actions/
│       ├── approvals/
│       ├── evidence/
│       └── types/
├── assistant-sdk/
│   └── existing SDK adapter and package surface
app/
└── Frontend 001 Nuxt adapters / thin wrappers
```

`packages/assistant-runtime` is the canonical reusable implementation. `app/**` is Nuxt-specific adapter and wrapper space. `packages/assistant-sdk/**` is public SDK adapter and package surface. `packages/assistant-sdk/src/runtime` must not become a second canonical runtime owner.

## 6. Canonical Runtime Library-Safe Extraction Strategy

Dependency order:

```text
Existing Phase 0-Phase 10
        ↓
Existing T092-T096 Tests First
        ↓
Canonical Runtime Extraction Tests First / Architecture Guards
        ↓
Shared Runtime Boundary
        ↓
Transport Port Foundation
        ↓
Types / SSE / Session / Outcomes / Feedback / Action / Approval Extraction
        ↓
Pinia Stores and Runtime Controller Extraction
        ↓
Canonical UI Extraction
        ↓
Frontend 001 Adapter Migration
        ↓
Frontend 001 Regression Closure
        ↓
Shared Runtime / SDK Declaration Closure
        ↓
T094 Method/Path-Aware Fixture Correction
        ↓
Original T097-T099 Productized Runtime
        ↓
Original T100-T102 Publish Readiness
```

Pinia stores and the runtime controller switch only after the canonical type/helper, SSE, session/history, safe outcome, feedback/action, and approval capabilities exist in the shared boundary. This avoids moving app-bound stores first while they still depend on `app/**`.

### Stage 1: Baseline Preservation and Preflight

- Record current passing Frontend 001 unit / component / integration / e2e tests.
- Record Frontend 002 Phase 0-Phase 10 regression baseline.
- Record T092-T096 Tests First status.
- Record SDK build, typecheck, pack, exports, and artifact baseline.
- Confirm T097-T099 remain blocked by missing library-safe runtime.
- Do not move canonical implementation until baseline is confirmed.

### Stage 2: Dependency Inventory and Classification

- Inventory `ChatWidget` transitive dependency graph.
- Classify shared-safe canonical logic: assistant state, SSE parser, stream lifecycle, session/history orchestration, safe outcome mapping, EvidenceRef, feedback, action, approval, library-safe Vue UI.
- Classify Nuxt-specific integration: `useRuntimeConfig`, Nuxt `$fetch`, Nuxt plugins, route/page integration, Nuxt UI, app theme, auto-registration.
- Classify Frontend 001 app-specific integration: app service adapters, app auth, page/layout concerns, app Pinia setup, reference consumer wiring.
- Classify SDK-specific integration: provider, configuration, callbacks, request builder, Compatibility Mode, mount lifecycle, packaging.

### Stage 3: Extraction Tests First and Architecture Guards

- Add guards for approved shared runtime owner and no duplicate canonical runtime.
- Assert shared runtime does not import `app/**`, Nuxt globals, `useRuntimeConfig`, or Frontend 001 active Pinia.
- Assert shared runtime has library typecheck.
- Assert SDK declarations do not reference `app/**`.
- Assert Frontend 002 never imports `app/**`.
- Assert public exports do not expose shared internals.
- Assert Pinia is not a public peer/API and consumer can mount without initializing Pinia.
- Existing T092-T096 remain valid final productized readiness tests, not extraction-specific replacements.

### Stage 4: Establish `packages/assistant-runtime` Boundary

- Create private internal workspace package/source boundary.
- Add library-safe typecheck.
- Use package identity only for workspace resolution.
- Keep `private: true`.
- Follow design dependency ownership: Vue peer/external through SDK, Pinia regular runtime dependency resolution through SDK package.
- Do not add a direct publish workflow or public runtime product.

### Stage 5: Transport Port Foundation

- Shared runtime owns session/history orchestration, canonical SSE consumption, retry/cancel/timeout/interrupted state.
- Frontend 001 Nuxt Adapter owns `useRuntimeConfig`, Nuxt `$fetch` or current app HTTP client, auth/headers, and app-specific session persistence.
- Frontend 002 SDK Adapter owns request builder, provider resolution, forbidden fields gate, Compatibility Mode request omission, default transport, and injected authenticated executor.
- Do not create separate SSE parsers in Frontend 001, shared runtime, and SDK transport.
- Transport errors return as safe transport results into Shared Canonical Assistant Runtime error/retry/timeout/interrupted flow.

### Stage 6: Types and Pure Helpers Extraction

- Move assistant domain types and pure helper logic into `packages/assistant-runtime` only when they can typecheck without `app/**`.
- Keep SDK public types behind the SDK facade; SDK declarations must not expose shared internal paths.
- Frontend 001 switches to shared type/helper owner only after regression coverage confirms behavior parity.
- Old app type/helper owners are removed, re-exported, or thinned after the shared owner is active.

### Stage 7: SSE Parser and Stream Event Model Extraction

- Move canonical SSE parser and stream event model into shared runtime.
- Keep timeout as inactivity lifecycle and interrupted as EOF-before-final.
- Frontend 001 and SDK adapters provide transport capability only; neither owns a separate parser/schema.
- Run Frontend 001 SSE regressions before thinning old app parser ownership.

### Stage 8: Session and History Orchestration Extraction

- Move session create/resume, history cursor, delta accumulation, retry/cancel lifecycle, and cleanup orchestration into shared runtime.
- Frontend 001 adapter supplies app auth/config/session persistence ports.
- Frontend 002 adapter supplies SDK namespace/lifecycle/request/transport ports.
- Host `sessionId` may point widgets at the same backend session, but it is not identity proof and does not imply shared local state.

### Stage 9: AnswerDecision, EvidenceRef and Safe Outcomes Extraction

- Move final answer, no_answer, clarification, permission_denied, tool_failure, safe metadata, AnswerDecision, and EvidenceRef handling into shared runtime.
- Backend remains the authority for identity, permission, source metadata, evidence, and final safe outcome.
- Frontend adapters only project safe rendered surfaces and callbacks.

### Stage 10: Feedback, Action and Approval Extraction

- Move feedback, ActionDraft, approval request display, approval IDs-only event inputs, and action confirmation runtime into shared runtime.
- Frontend 001 adapter keeps app-specific navigation and Nuxt wrapper concerns outside shared runtime.
- Frontend 002 SDK Adapter must not create approval navigation URLs or expose approval internals.

### Stage 11: Pinia Stores and Runtime Controller Extraction

- Move canonical stores into `packages/assistant-runtime`.
- Convert stores to explicit imports with no Nuxt auto-registration dependency.
- Frontend 001 Nuxt Adapter provides existing app Pinia context and does not create a second app-level Pinia.
- SDK component usage creates widget-local runtime scope.
- `mountAssistantWidget` creates isolated Vue app plus `createPinia()` per mount.
- Multiple widgets never share active Pinia, stream, timer, listener, abort controller, or pending callback state.
- Multiple widgets may point to one backend `sessionId`, while local runtime state remains isolated.
- Single-owner sequence: shared store tests, Frontend 001 wrapper uses shared store, regressions pass, old app store becomes re-export/thin adapter or is removed.

### Stage 12: Canonical UI Extraction

- Shared runtime owns conversation/message list, composer, loading/streaming, safe outcomes, evidence, feedback, action confirmation, and approval display.
- Frontend 001 owns Nuxt page wrapper, layout integration, route integration, app theme integration, and Nuxt-only wrappers.
- Frontend 002 owns SDK launcher/shell, configuration/theme adapter, and imperative lifecycle wrapper.
- Produce Nuxt UI dependency inventory before implementation.
- Replace Nuxt UI primitives with library-safe Vue components, native semantic HTML, or renderless+adapter slots.
- SDK basic widget must not require Nuxt UI plugin.

### Stage 13: Frontend 001 Nuxt Adapter Migration

- Frontend 001 transitional adapter may temporarily delegate to not-yet-migrated app implementation.
- Delegation must not add parallel business logic.
- Each capability has a single-owner switch condition.
- After shared owner switch, old app implementation is removed, disabled, re-exported, or reduced to a thin wrapper.
- Frontend 002 SDK must not import `app/**` at any stage.

### Stage 14: Frontend 001 Regression Closure

- Required gates cover ChatWidget closed/open behavior, session create/resume, history loading/cursor, SSE parser, streaming, completed answer, no_answer, clarification, permission_denied, tool_failure, timeout, interrupted, retry, cancel, EvidenceRef, feedback, ActionDraft, ApprovalRequest, route/entity/org/session changes, and destroy/unmount cleanup.
- Do not remove old owner before matching regressions pass.
- Extraction is behavior-preserving internal migration, not a feature redesign.

### Stage 15: Shared Runtime / SDK Declaration and Build Closure

- Shared runtime requires explicit imports, no Nuxt-generated type dependency, no `app/**` import, no SDK public type dependency, no frontend authority logic, no global active app state, and passing library tsconfig.
- SDK declaration/build must prove `dist/index.d.ts` does not reference `app/**` or expose `packages/assistant-runtime/**`.
- Public types come only from SDK facade.
- Compiled shared runtime may enter `dist/index.mjs`.
- Vue remains external, Pinia resolves as regular dependency, Nuxt is not required, and sourcemaps are absent.

### Stage 16: T094 Method/Path-Aware Fixture Correction

- T094 fixture must route `POST /assistant/sessions` to JSON session creation, `GET /assistant/sessions/:sessionId/messages` to JSON history, and `POST /assistant/sessions/:sessionId/messages` to SSE.
- Timeout remains inactivity-based; interrupted remains EOF-before-final.
- This is test adapter correction, not production transport contract change.
- Do not rewrite the seven T094 outcome contracts.

### Stage 17: Resume Original T097-T099 Productized Runtime

- Resume only after shared runtime boundary exists, Frontend 001 uses shared runtime, no-second-runtime guards pass, shared runtime typecheck passes, Frontend 001 regressions pass, SDK declarations no longer cross `app/**`, Frontend 002 does not import `app/**`, and T094 fixture supports canonical call graph.
- Original goals remain Productized `AssistantWidget`, productized `mountAssistantWidget`, and packaged runtime bundling stabilization.

### Stage 18: Original T100-T102 Publish Readiness

- Original T100-T102 remain package metadata, version/license, GitHub Packages publishConfig, README, private flag sequencing, and final release readiness.
- Publish readiness is last and depends on productized runtime completion.

## 7. Package / Workspace Plan

Package root:

```text
packages/assistant-sdk/
├── package.json
├── src/
│   ├── index.ts
│   ├── components/
│   ├── context/
│   ├── events/
│   ├── runtime/
│   ├── session/
│   ├── transport/
│   └── types/
├── styles.css
└── vite.config.ts
```

Build tool decision: use Vite library mode. The repo already uses Nuxt/Vite, so Vite library mode minimizes new toolchain surface while supporting Vue SFC package builds, typed source organization, CSS entry handling, and future package exports. Alternatives like `tsup` or `rollup` are deferred unless Vite library mode cannot satisfy Vue SFC / CSS output requirements.

Package strategy:

- `packages/assistant-sdk/src/index.ts` is the public root entry.
- `packages/assistant-sdk/styles.css` is the public stylesheet entry.
- `package.json` exports only root public API and `./styles.css`.
- Phase 11 must not add `./nuxt`.
- Internal modules are not deep-import contracts.
- Frontend 002 SDK Adapter must not import `app/features`, `app/services`, `app/stores`, or `app/utils` at any migration stage.
- Frontend 002 consumes only `packages/assistant-runtime/**` or approved internal workspace entries after Canonical Runtime Library-Safe Extraction is complete.
- Vue remains a peer dependency and Vite external.
- Pinia is an `assistant-sdk` regular runtime dependency, not a public peer, and not a consumer-provided external.
- Nuxt becomes an optional peer dependency for the productized SDK.
- Package must not bundle a second Vue runtime.
- Nuxt integration must not create a second Vue app.
- Same-version track with Frontend 001 runtime is required.
- Productized package contents include `dist`, `styles.css`, and `README.md`; sourcemaps are not included initially.
- GitHub Packages is the selected publish-readiness target with registry `https://npm.pkg.github.com` and `publishConfig.access` set to `restricted`.
- Package name remains `@ideaxpress/assistant-sdk` for now; before actual publish, confirm `@internal-ai-assistant` maps to the correct GitHub Packages owner / org scope and authentication setup.
- `private: true` remains until runtime completeness passes, then Phase 11 may remove it for publish readiness.
- Version remains `0.1.0`; license is `UNLICENSED`.

## 8. Public API / Export Plan

Public exports:

- `AssistantWidget`
- `mountAssistantWidget`
- `AssistantHostContextProvider`
- `WidgetConfiguration`
- `HostCallbacks`
- `HostEvents`
- Integration mode type
- Mount options
- Mount handle
- Safe error types
- Sanitized context types
- Public style entry: `@ideaxpress/assistant-sdk/styles.css`

Forbidden exports:

- Internal stores
- Private composables
- Private transport implementation
- SSE parser internals
- Frontend 001 internal paths
- Private Vue components
- Undocumented deep imports
- `./nuxt`
- `./runtime`, `./transport`, `./session`, `./context`, `./request`
- `./fixtures` or `./tests`

Acceptance criteria:

- Reference consumer can integrate with public entries only.
- Public types are reachable from the documented root entry.
- Deep imports are not required for consumer integration.

## 9. Runtime Reuse Plan

Canonical runtime ownership after extraction:

- Shared Canonical Assistant Runtime owns reusable chat state, session/history orchestration, SSE parser and stream lifecycle, safe outcome mapping, AnswerDecision, EvidenceRef, feedback, ActionDraft, ApprovalRequest, retry, cancel, timeout, and interrupted behavior.
- Frontend 001 owns product behavior expectations, Nuxt host integration, and regression gates through Frontend 001 Nuxt Adapter.
- Frontend 002 owns package public API, provider/config/callback boundaries, request builder/security, lifecycle, packaging, and consumer integration through Frontend 002 SDK Adapter.

Frontend 002 wraps:

- Package install / export boundary
- Host App provider / config / callback integration
- Request builder mode policy
- Lifecycle and mount helpers
- Session isolation and fallback namespace policy
- Reference consumer package integration

Productized runtime packaging strategy:

- Short-term: bundle required compiled canonical runtime from `packages/assistant-runtime/**` into SDK dist.
- Long-term: shared runtime may gain stronger internal package boundaries, but it is not a new public product.
- Built package may contain compiled runtime code, but must not expose internal exports or retain unresolved `app/**` imports.
- `AssistantWidget` must not remain a shell placeholder.
- `mountAssistantWidget` must mount the complete productized widget.
- Guardrails remain: no second ChatWidget, assistant API client, SSE parser, session/history runtime, AnswerDecision mapper, or EvidenceRef renderer.

## 10. Provider / Configuration / Callbacks Plan

Three boundaries:

- `AssistantHostContextProvider`: request-scoped, async, resolved before send/retry, fails closed on unavailable context, never reuses stale context.
- `WidgetConfiguration`: local-only package/widget configuration.
- `HostCallbacks` / `HostEvents`: local-only event and callback surface.

Provider rules:

- Provider is not the only source of identity / permission metadata.
- Trusted authenticated transport may provide backend contract required metadata.
- Provider may provide sanitized Host Context / PageContext / handoff metadata.
- Provider must not include WidgetConfiguration, HostCallbacks, token, credential, secret, callback objects, sourceSystem, connector, adapter, permission result, evidence source, or local-only UI state.

Acceptance criteria:

- Provider resolution failure stops request and surfaces `context unavailable` / `integration error`.
- WidgetConfiguration and HostCallbacks are never serialized into backend request.
- Retry resolves fresh context before sending.

## 11. Mode-tiered Request Builder Plan

Request builder modes are frontend integration / request-builder / provider validation modes. They are not backend request modes.

### Backend 001 Compatibility Mode

- Use Backend 001 public request shape.
- Omit Frontend 002 Host Context from the request body.
- Do not send `pageContext`, `selectedRows`, `entityType`, `entityId`, `visibleColumns`, `screenId`, `route`, host-aware context fields, or Backend 002-only context/capability fields.
- Do not send unknown request fields.
- Do not append context into message text.
- Do not build hidden prompt content.
- Keep `sessionScope` local-only.
- Continue forbidding `sourceSystem`, connector, adapter, permissionResult, evidence authority, routing hints, approval navigation metadata, and secret-like fields.
- Authenticated identity headers, organization / actor handoff, request correlation, and Backend 001 required public request fields come from the authenticated transport integration contract, not from Frontend 002 Host Context body.
- If final outgoing request lacks Backend 001 required identity, stop or use existing integration / identity error flow.

### Backend 002 Mode

- Fail closed when required organization / identity / permission context is missing.
- Send only contract-compatible sanitized context.
- Do not send `sourceSystem`, connector, adapter, permissionResult, finalEvidenceSource, or other backend-owned decision fields.
- Consume backend safe outcomes only.
- Do not control backend connector / tool selection.

Mode matrix ownership will be implemented in request builder tests and public type tests, but must not introduce a backend request mode, backend endpoint, or mode-specific SSE parser.

## 12. PageContext Sanitization / Forbidden Fields Plan

Sanitization plan:

- Generic shape validation.
- Primitive / plain-object only.
- Defensive size limits.
- Secret-like field rejection.
- Raw row object rejection.
- DOM node / function / class instance / circular object rejection.
- selectedRows raw input count before sanitization.
- selectedRows max 20.
- More than 20 selectedRows rejects entire context.
- No silent truncation.
- Route query / hash is untrusted.
- visibleColumns is hint-only.
- Frontend validation does not replace backend authorization.

Forbidden fields gate blocks:

- `sourceSystem`
- connector / connectorId
- adapter / adapterId
- dataSource
- candidateTool / candidateTools
- toolName
- permissionResult
- fieldPermissionResult
- rowPermissionResult
- finalEvidenceSource
- rawEvidence
- rawConnectorPayload
- routing hints
- approval navigation metadata
- token / credential / secret / connection detail
- WidgetConfiguration
- HostCallbacks
- callback functions
- raw business payload

Failure behavior must stop before transport, provide developer-facing diagnostics, and show user-safe errors.

## 13. Transport Ownership Plan

Transport ownership after extraction:

- Shared runtime owns canonical SSE consumption, session/history orchestration, retry/cancel/timeout/interrupted state, and safe outcome state.
- Frontend 001 Nuxt Adapter owns Nuxt HTTP, auth/header handoff, and app-specific session persistence.
- Frontend 002 SDK Adapter owns request shape construction, sanitization/mode validation, Compatibility Mode omission, default transport, and injected executor adapters.

Default transport and injected authenticated executor are low-level only and cannot:

- Rewrite route
- Create second API client contract
- Create second SSE parser
- Change request envelope
- Bypass sanitization
- Bypass mode validation
- Serialize local-only state

Transport errors return as safe transport results into the canonical assistant error / retry / timeout / interrupted flow migrated to Shared Canonical Assistant Runtime during Phase 11 extraction.

## 14. Session Ownership / Fallback / Lifecycle Plan

Session ownership:

- Host-managed sessionId has priority.
- If safe and no host-managed sessionId exists, use `sessionStorage` fallback.
- Fallback namespace includes package namespace / version compatibility, hostApp, organization, sessionScope, and page/entity identity.
- Missing organization prevents persistent organization-scoped fallback.
- If `sessionStorage` is unavailable, use same-runtime memory-only fallback.
- No `localStorage` or cookie fallback.

Lifecycle cleanup:

- Organization change terminates old session context, SSE, history loading, listeners, timers, observers, and fallback namespace.
- Entity / scope change prevents stale session history and stale PageContext.
- Duplicate mount is guarded and diagnosable.
- Unmount / destroy is idempotent.

Host-managed sessionId is not identity proof. Memory-only session is not identity proof. `sessionScope` is local-only and does not enter backend request.

## 15. Host Events / Callbacks Plan

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

Approval detail callback payload:

- `approvalRequestId`
- `sessionId`
- `messageId`

Event rules:

- No raw business data.
- No raw SSE payload.
- No token / credential / secret.
- No callback payload serialized to backend request.
- No Host App navigation URL inference.
- Callback exceptions are isolated from assistant runtime.

## 16. Styling / Theme / Accessibility Plan

Stylesheet entry:

- `@ideaxpress/assistant-sdk/styles.css`

Supported styling:

- Limited CSS variables / tokens.
- light / dark / system.
- Panel position / size boundary.
- Launcher enabled.
- z-index.
- Basic accessibility.
- Keyboard / focus behavior.

Non-goals:

- Arbitrary CSS injection.
- Global reset.
- Shadow DOM.
- iframe.
- Full theme builder.

Style isolation tests must verify no unintended Host App global style mutation.

## 17. Nuxt 4 Reference Consumer Plan

Use the current Nuxt app as reference consumer / preview harness:

- Install package through workspace dependency.
- Import only public package entry.
- Import stylesheet entry.
- Register provider.
- Pass WidgetConfiguration.
- Pass HostCallbacks.
- Render `AssistantWidget`.
- Exercise optional `mountAssistantWidget` smoke.
- Run Backend 001 Compatibility Mode smoke.
- Verify SSR import safety and client-only mount behavior.
- Verify no direct deep import from Frontend 001 internal path in consumer integration.

## 18. Testing Plan

### Independent Package Readiness Tests

- Package public export tests.
- Package artifact / installability tests.
- SSR import safety tests.
- Component mount tests.
- Provider resolution tests.
- Provider failure tests.
- Request builder mode tests.
- PageContext sanitization tests.
- Forbidden fields tests.
- selectedRows max 20 tests.
- Session fallback / isolation tests.
- Lifecycle cleanup tests.
- Transport ownership tests.
- Host events / callbacks tests.
- Style isolation tests.
- Reference consumer smoke tests.
- Backend 001 Compatibility Mode integration tests.
- Frontend 001 regression gates.

### Package Artifact Validation

Packaging validation must verify that the built SDK package can be consumed through `@ideaxpress/assistant-sdk` public entries without unresolved Frontend 001 app path imports.

Required later validation:

- Run `npm pack` or an equivalent package artifact smoke after SDK build support exists.
- Install or consume the local tarball / workspace dist in the reference consumer.
- Reference consumer may import only `@ideaxpress/assistant-sdk` and `@ideaxpress/assistant-sdk/styles.css`.
- Reference consumer must not import `app/features`, `app/services`, `app/stores`, `app/utils`, or `packages/assistant-sdk/src/runtime`.
- Scan SDK dist for unresolved `../../../../app/features`, `../../../../app/services`, `../../../../app/stores`, `../../../../app/utils`, and equivalent `app/**` internal imports.
- Verify package exports still omit `./runtime` and `./runtime/*`.

### Backend 002 Integration-dependent Tests

These tests are later / gated / optional integration-dependent validation and do not block package readiness.

- Backend 002 Mode fail-closed context tests.
- Sanitized context submission smoke.
- Host-aware clarification consumption.
- permission_denied rendering.
- tool_failure rendering.
- Permission-safe evidence consumption.
- Backend-derived source metadata display / preservation.
- SSE final safe outcome consumption.

Test doubles must not form a third formal provider contract. Fake provider, stub executor, and SSE fixtures must align with public contracts.

### Canonical Runtime Extraction Tests First and Execution Order

Tests First / Protection Setup:

- Extraction architecture guards.
- Shared runtime unit/component contract tests.
- Frontend 001 adapter and behavior-preserving regression protection.
- SDK declaration/build guards.
- No-second-runtime, no `app/**`, no Nuxt globals, and state-isolation guards.

Execution and Closure Order:

- Canonical Runtime Library-Safe Extraction implementation.
- Frontend 001 regression closure.
- Shared Runtime / SDK declaration and build closure.
- T094 method/path-aware fixture correction.
- Original T097-T099 productized runtime implementation.
- Original T100-T102 publish readiness.

T094 fixture correction happens after declaration/build closure and before original T097-T099. It does not modify the production transport contract, does not replace extraction-specific guards, and preserves the seven Compatibility Mode outcome contracts.

T092-T096 remain final SDK productized readiness tests. They are not substitutes for extraction-specific tests.

### Productized SDK Publish Readiness Tests

- Productized widget runtime completeness.
- Productized mount smoke.
- Packaged Compatibility Mode chat flow.
- Packaged runtime source boundary.
- Publish metadata validation.
- README / usage documentation validation.
- Final productized SDK release readiness gate.

Phase 11 tests must not call external backend services. They use mock transport / mock SSE, create temporary consuming apps only under `/private/tmp`, and never execute real npm publish.

## 19. Phase Plan

Phase 0-Phase 10 are retained as completed historical implementation and validation context. Canonical Runtime Library-Safe Extraction does not reopen or invalidate their completed tasks; it adds the missing library-safe runtime prerequisite discovered during Phase 11 preflight. Existing Phase 0-10 architecture, contract, request-security, lifecycle, transport, package-artifact, and regression guardrails remain the baseline and should be rerun only as targeted regressions during extraction.

### Phase 0 - Contract and Architecture Guardrails

- Purpose: lock architecture boundaries before code movement.
- Dependencies: accepted Frontend 002 spec/design, Frontend 001 baseline, Backend 001 contract docs.
- Primary areas: package boundary guardrails, test fixtures, lint/type guard decisions.
- Test-first entry criteria: failing tests or assertions for forbidden deep imports, forbidden fields, and no second runtime.
- Implementation work: define guardrail helpers and expected validation seams.
- Acceptance criteria: all later phases can reference a shared set of non-negotiable boundaries.
- Boundaries / non-goals: no implementation of package runtime yet.

### Phase 1 - Workspace Package Skeleton and Public Exports

- Purpose: create `@ideaxpress/assistant-sdk` package skeleton.
- Dependencies: Phase 0 guardrails.
- Primary areas: `packages/assistant-sdk/`, workspace config, exports, styles entry.
- Test-first entry criteria: public export tests fail until exports exist.
- Implementation work: package metadata, Vite library config, `src/index.ts`, `styles.css`.
- Acceptance criteria: package can be resolved by reference consumer using public entry only.
- Boundaries / non-goals: no second Vue runtime, no deep import contract.

### Phase 2 - Runtime Reuse Boundary and Frontend 001 Extraction Points

- Purpose: preserve runtime reuse intent and no-fork/no-second-runtime guardrails through SDK internal adapter seams.
- Dependencies: package skeleton.
- Primary areas: SDK runtime reuse contracts, no-fork scans, internal adapter seams, and initial integration points.
- Test-first entry criteria: Frontend 001 regression tests remain green.
- Implementation work: prove and register reuse seams without copying ChatWidget, API client, SSE parser, store, mapper, or renderer.
- Acceptance criteria: Frontend 002 remains constrained to the same canonical runtime behavior as Frontend 001.
- Boundaries / non-goals: Phase 2 did not complete `packages/assistant-runtime` library-safe extraction, Nuxt dependency removal, vue-tsc-safe declaration closure, or complete canonical source migration. Phase 11 extraction is a new prerequisite discovered later, not a Phase 2 rerun.

### Phase 3 - Provider / Configuration / Callbacks Boundary

- Purpose: implement public integration contracts.
- Dependencies: runtime boundary.
- Primary areas: package context, events, types, mount options.
- Test-first entry criteria: provider/config/callback serialization boundary tests.
- Implementation work: public types and runtime adapters for provider, WidgetConfiguration, HostCallbacks.
- Acceptance criteria: invalid boundary mixing is rejected before request builder.
- Boundaries / non-goals: no token/credential/callback object in provider.

### Phase 4 - Request Builder Modes and Sanitization

- Purpose: implement frontend mode-tiered request building.
- Dependencies: provider boundary and sanitization helpers.
- Primary areas: request builder, PageContext sanitizer, forbidden fields gate.
- Test-first entry criteria: Backend 001 omission, Backend 002 fail-closed, selectedRows >20 rejection.
- Implementation work: request builder modes, forbidden fields diagnostics, sanitized context wiring.
- Acceptance criteria: no unknown fields, hidden prompt, sourceSystem, connector, permission result, or raw payload leaves frontend.
- Boundaries / non-goals: no backend request mode.

### Phase 5 - Transport Ownership and SSE Integration

- Purpose: support default transport and injected low-level executor.
- Dependencies: request builder.
- Primary areas: package transport wrappers, existing AssistantService, existing SSE stream.
- Test-first entry criteria: injected executor cannot bypass request builder or parser ownership.
- Implementation work: executor adapter, default transport wiring, error propagation.
- Acceptance criteria: transport errors return as safe results into the canonical assistant error / retry flow, which Phase 11 migrates to Shared Canonical Assistant Runtime.
- Boundaries / non-goals: no second API client contract or SSE parser.

### Phase 6 - Session Ownership, Fallback and Lifecycle

- Purpose: implement package session ownership and lifecycle safety.
- Dependencies: runtime and request builder.
- Primary areas: session namespace, fallback map, lifecycle handle.
- Test-first entry criteria: cross-host/org isolation, storage unavailable, duplicate mount, destroy cleanup.
- Implementation work: host-managed sessionId priority, fallback namespace, memory-only continuity, cleanup hooks.
- Acceptance criteria: no cross-organization session contamination or dangling streams/listeners.
- Boundaries / non-goals: sessionScope never goes to backend request.

### Phase 7 - Host Events, Styling and Reference Consumer

- Purpose: integrate user-facing package surface into Nuxt reference consumer.
- Dependencies: package runtime and lifecycle.
- Primary areas: HostEvents, callbacks, styles, current Nuxt app integration.
- Test-first entry criteria: callback payload minimization, approval detail payload IDs-only, style isolation.
- Implementation work: event emission, callback isolation, stylesheet entry, reference consumer usage.
- Acceptance criteria: reference consumer uses public package entry and stylesheet only.
- Boundaries / non-goals: no Host App navigation URL generation, no approval management UI.

### Phase 8 - Backend 001 Compatibility Mode Smoke and Regression Gates

- Purpose: prove Independent Package Readiness without Backend 002.
- Dependencies: reference consumer integration.
- Primary areas: contract tests, component tests, reference smoke, Frontend 001 regression suite.
- Test-first entry criteria: Backend 001 session/message/history/SSE/feedback/action/approval flows.
- Implementation work: smoke wiring and package readiness gate validation.
- Acceptance criteria: package readiness can be declared with Backend 001 Compatibility Mode.
- Boundaries / non-goals: no claim that backend understands host-aware semantics.

### Phase 9 - Backend 002 Integration-dependent Smoke Gates

- Purpose: define later gated validation for Backend 002.
- Dependencies: Backend 002 integration environment.
- Primary areas: integration test harness only.
- Test-first entry criteria: fail-closed missing context and safe outcome consumption tests.
- Implementation work: gated smoke tests for sanitized context and safe backend outcomes.
- Acceptance criteria: host-aware integration can be validated only when backend environment is available.
- Boundaries / non-goals: not a package readiness blocker.

### Phase 10 - Release Readiness and Package Artifact Validation

- Purpose: prepare package release boundary and consumer installability validation.
- Dependencies: all readiness gates.
- Primary areas: package artifact smoke, public-entry-only import validation, dist internal-path scan, peer dependency diagnostics.
- Test-first entry criteria: install/build diagnostics, public entry usage, and package artifact scan.
- Implementation work: validate package artifact boundary, release gate checks, and same-version compatibility gates.
- Acceptance criteria: consumer can install, import, mount, style, configure, and verify package through public SDK entries without Frontend 001 internal app paths.
- Boundaries / non-goals: no public npm registry requirement for this feature.

### Phase 11 - Productized SDK Runtime and Publish Readiness

- Purpose: complete Canonical Runtime Library-Safe Extraction first, then turn the buildable package artifact into a productized SDK ready for formal publish readiness review.
- Dependencies: Phase 10 real build / pack / install artifact closeout, Phase 8 Compatibility Mode smoke, and Phase 0 architecture guardrails.
- Primary areas: `packages/assistant-runtime/**`, Frontend 001 Nuxt Adapter wrappers, `packages/assistant-sdk/src/components/AssistantWidget.vue`, `packages/assistant-sdk/src/mountAssistantWidget.ts`, SDK build/declaration config, `packages/assistant-sdk/package.json`, `packages/assistant-sdk/README.md`, and Phase 11 productized SDK tests.
- Test-first entry criteria: extraction guards fail when shared runtime imports `app/**`, Nuxt globals, active Pinia, or SDK public types; productized tests fail when `AssistantWidget` is still a shell placeholder, `mountAssistantWidget` only returns a shell handle, dist contains unresolved `app/**` imports, README / publish metadata are missing, or a consuming app cannot resolve packed SDK public entries.
- Implementation work: inventory dependencies, establish extraction Tests First and architecture guards, establish `packages/assistant-runtime` boundary, build the transport port foundation, then extract types/pure helpers, SSE parser/event model, session/history, AnswerDecision/EvidenceRef/safe outcomes, feedback/action/approval, Pinia stores/runtime controller, and library-safe UI in order. After that, migrate the Frontend 001 Nuxt Adapter, close Frontend 001 regressions, complete shared runtime / SDK declaration build, correct the T094 method/path-aware fixture, then connect productized `AssistantWidget` / `mountAssistantWidget` and finalize publish readiness metadata/README.
- Acceptance criteria: external consuming app can install / resolve packed SDK, import root public entry and `styles.css` only, render complete chat UI, run Compatibility Mode with mock transport / mock SSE, and pass publish readiness validation without real publish.
- Boundaries / non-goals: no real npm publish, no external backend call, no new `./nuxt` export, no Shadow DOM, no second runtime, no Backend 002 production dependency, no DataAdapter / connector implementation.

## 20. Planned File / Directory Changes

### New Shared Runtime Boundary Files

- `packages/assistant-runtime/package.json`
- `packages/assistant-runtime/tsconfig.json`
- `packages/assistant-runtime/src/components/`
- `packages/assistant-runtime/src/composables/`
- `packages/assistant-runtime/src/stores/`
- `packages/assistant-runtime/src/runtime/`
- `packages/assistant-runtime/src/session/`
- `packages/assistant-runtime/src/transport/`
- `packages/assistant-runtime/src/sse/`
- `packages/assistant-runtime/src/outcomes/`
- `packages/assistant-runtime/src/feedback/`
- `packages/assistant-runtime/src/actions/`
- `packages/assistant-runtime/src/approvals/`
- `packages/assistant-runtime/src/evidence/`
- `packages/assistant-runtime/src/types/`

### Existing Frontend 002 SDK Files Potentially Updated During Productization

- `packages/assistant-sdk/package.json`
- `packages/assistant-sdk/vite.config.ts`
- `packages/assistant-sdk/src/index.ts`
- `packages/assistant-sdk/src/components/AssistantWidget.vue`
- `packages/assistant-sdk/src/context/`
- `packages/assistant-sdk/src/events/`
- `packages/assistant-sdk/src/runtime/`
- `packages/assistant-sdk/src/session/`
- `packages/assistant-sdk/src/transport/`
- `packages/assistant-sdk/src/types/`
- `packages/assistant-sdk/styles.css`
- `packages/assistant-sdk/README.md`

Most SDK package files already exist after Phase 0-10. Phase 11 may update them only for targeted productized widget/mount behavior, build/declaration stabilization, package metadata, README, and artifact closure; it must not recreate the package skeleton or add a second runtime.

### Existing Frontend 001 Files Potentially Migrated or Thinned

- `app/features/assistant/components/ChatWidget.vue`
- `app/features/assistant/components/`
- `app/features/assistant/composables/useChat.ts`
- `app/features/assistant/composables/useAssistantSession.ts`
- `app/features/assistant/composables/useAssistantSseStream.ts`
- `app/services/api/assistant.ts`
- `app/stores/assistant/`
- `app/types/assistant/`
- `app/utils/assistant/`

These files may become Frontend 001 Nuxt Adapter wrappers or be reduced to re-exports after shared owner migration. Frontend 002 SDK must not import them directly.

### Reference Consumer Files

- Current Nuxt app root preview harness.
- `nuxt.config.ts` only if workspace dependency / alias / package consumption requires registration.
- Potential Nuxt plugin or preview route for package smoke, to be chosen in `tasks.md`.

### Extraction Prerequisite Tests / Guards

- Approved shared runtime owner guards.
- Shared runtime no `app/**`, no Nuxt globals, no active app dependency, and library-safe typecheck guards.
- Frontend 002 no `app/**` import and SDK declaration no `app/**` reference guards.
- Pinia not public peer/API guards.

### Existing T092-T096 Productized Readiness Tests

- `tests/component/assistant-sdk/productized-widget-runtime.spec.ts`
- `tests/integration/assistant-sdk/productized-mount-smoke.spec.ts`
- `tests/integration/assistant-sdk/packaged-compatibility-chat-flow.spec.ts`
- `tests/contract/assistant-sdk/packaged-runtime-source-boundary.spec.ts`
- `tests/contract/assistant-sdk/publish-readiness.spec.ts`

These tests already exist as Phase 11 productized readiness guardrails. They remain valid final gates and are not substitutes for extraction-specific tests.

### Frontend 001 Regression Tests

- Existing assistant unit, component, contract, integration, and e2e regression tests.
- Additional regression coverage only where a migrated capability lacks behavior-preserving protection.

Implementation may update package build config and SDK source only in Phase 11 execution, not during this planning update.

## 21. Migration Units, Rollback, and Scope

Migration slices:

- Slice 1: baseline preservation and preflight.
- Slice 2: dependency inventory and classification.
- Slice 3: extraction tests first and architecture guards.
- Slice 4: establish `packages/assistant-runtime` boundary.
- Slice 5: transport port foundation.
- Slice 6: types and pure helpers extraction.
- Slice 7: SSE parser and stream event model extraction.
- Slice 8: session and history orchestration extraction.
- Slice 9: AnswerDecision, EvidenceRef, and safe outcomes extraction.
- Slice 10: feedback, action, and approval extraction.
- Slice 11: Pinia stores and runtime controller extraction.
- Slice 12: canonical UI extraction.
- Slice 13: Frontend 001 Nuxt Adapter migration.
- Slice 14: Frontend 001 regression closure.
- Slice 15: shared runtime / SDK declaration and build closure.
- Slice 16: T094 method/path-aware fixture correction.
- Slice 17: resume original T097-T099 productized runtime.
- Slice 18: original T100-T102 publish readiness.

Each slice follows tests first -> shared implementation -> Frontend 001 migration -> regressions -> old owner removal/thinning.

Rollback strategy:

- Keep rollback point before single-owner switch.
- If Frontend 001 regression fails, roll back that slice.
- Do not leave failed states with old owner and shared owner both active.
- Do not change public Backend contract to avoid migration failures.
- Do not create temporary parallel SDK runtime.
- The previous failed T097-T099 bridge was rolled back and is the correct baseline.

In scope:

- shared runtime dependency inventory
- extraction Tests First
- `packages/assistant-runtime` internal boundary
- explicit imports
- transport ports
- library-safe Pinia stores
- state isolation
- canonical runtime capability migration
- library-safe Vue UI
- Frontend 001 Nuxt Adapter
- Frontend 001 behavior-preserving migration
- declaration/build closure
- T094 method/path-aware test fixture correction
- resume productized SDK runtime work

Out of scope:

- Backend 001 contract changes
- Backend 002 production completion
- new public `assistant-runtime` npm product
- second SDK runtime
- second API client
- second SSE parser
- public `./runtime` exports
- public `./nuxt` exports
- framework-agnostic non-Vue SDK
- iframe
- Shadow DOM
- Web Components
- React support
- external backend call during tests
- npm publish
- feature redesign of Frontend 001

## 22. Validation Strategy

Shared Runtime Gates:

- library typecheck
- no Nuxt globals
- no `app/**` imports
- no active app dependency
- SSE/session/outcome tests
- state isolation tests

Frontend 001 Gates:

- component regressions
- integration regressions
- e2e regressions
- API/SSE compatibility
- UI behavior parity

Frontend 002 Gates:

- no-second-runtime
- request security
- lifecycle
- package build
- declarations
- artifact scan
- temporary consumer
- Compatibility Mode

Final Productized Runtime Gates:

- T092-T096 pass
- original T097-T099 completion
- all seven Compatibility Mode outcomes
- no `app/**`
- no sourcemap
- Vue peer/external
- Pinia regular dependency

## 23. Architecture Guardrails

- No second ChatWidget.
- No second assistant API client.
- No second SSE parser.
- No second session / history runtime.
- No second AnswerDecision mapper.
- No second EvidenceRef renderer.
- No frontend-owned permission system.
- No frontend-owned connector / adapter selection.
- No frontend-derived `sourceSystem`.
- No DataAdapter.
- No HostApp Registry copy.
- No backend request mode.
- No nested `hostContext`.
- No backend `sessionScope`.
- No package backend proxy.
- No approval navigation URL generation.
- No raw entity payload.
- No token / credential storage.

## 24. Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Accidentally creating second API client | 將 canonical transport contract 與 runtime behavior 維持於 Shared Canonical Assistant Runtime 單一 owner；Frontend 001 `AssistantService` 僅作為 Nuxt transport adapter，提供 HTTP/auth capability，不得成為第二套 API contract、SSE parser 或 runtime state owner |
| Accidentally forking Frontend 001 runtime | Extract capability slices into `packages/assistant-runtime`; run Frontend 001 regression gates before old owner removal |
| Shared runtime becomes a public product | Keep `packages/assistant-runtime` private/internal and expose only SDK root/styles public entries |
| Long-lived transitional wrapper | Require single-owner switch condition and old owner removal/thinning per slice |
| Two active stores or SSE parsers | Shared runtime owns canonical stores/SSE after migration; guards reject duplicates |
| Provider / config / callbacks boundary confusion | Type and test separate provider, WidgetConfiguration, and HostCallbacks |
| Stale context | Re-resolve provider before send/retry and fail closed on provider error |
| Unsafe fallback session | Namespace by package, host, organization, scope, and page/entity; refuse persistent fallback without organization |
| selectedRows raw payload leakage | Count raw rows before sanitization, reject >20, accept ID / safe summary only |
| Forbidden field bypass | Central forbidden fields gate before transport |
| Injected transport bypass | Run request builder and validation before executor; executor cannot modify envelope |
| Backend 001 vs Backend 002 mode confusion | Document and test both as frontend modes only |
| CSS leakage | Scope package styles and add style isolation tests |
| Peer dependency / duplicate Vue runtime risk | Vue stays peer/external; Pinia is regular runtime dependency and not consumer-provided external |
| Workspace package build complexity | Use Vite library mode aligned with current Nuxt/Vite stack |
| Backend 002 not available | Keep Backend 001 Compatibility Mode package readiness path |
| AssistantWidget remains shell after packaging | Productized widget runtime completeness tests fail on shell placeholder output |
| Compiled runtime bundling leaks `app/**` source imports | SDK may bundle only compiled `packages/assistant-runtime` code; dist scan blocks unresolved app-path imports |
| `private` flag removed before runtime completeness | Publish-readiness tests require runtime completeness gates before metadata changes |
| GitHub Packages scope / auth mismatch | Treat owner/org scope and authentication confirmation as a blocker before actual publish |
| README insufficient for external product engineers | README readiness tests require installation, usage, security, troubleshooting, compatibility, and release notes placeholder |
| Nuxt treated as required peer instead of optional peer | Publish metadata tests require Nuxt to be optional peer for Phase 11 |

## 25. Open Questions / Decisions for plan.md

No blocking open questions for Canonical Runtime Library-Safe Extraction planning.

Plan decisions made:

- Library build tool: Vite library mode.
- Package structure: `packages/assistant-sdk/`.
- Shared runtime boundary: `packages/assistant-runtime/**`, private/internal-only.
- Public export strategy: root public entry plus stylesheet entry only.
- GitHub Packages publish-readiness target.
- Package name remains `@ideaxpress/assistant-sdk` for now.
- T097-T099 are downstream of Canonical Runtime Library-Safe Extraction.
- Runtime completeness before private flag removal.
- Short-term bundle compiled code from `packages/assistant-runtime` into SDK dist.
- `AssistantWidget` must become a complete widget.
- `mountAssistantWidget` must mount the complete widget.
- Exports remain root and styles only; no `./nuxt` in Phase 11.
- Dependency strategy: Vue peer/external, Pinia regular runtime dependency, Nuxt optional/non-required.
- README is included in package artifact.
- License is `UNLICENSED`.
- Version remains `0.1.0`.
- No sourcemaps initially.
- No external backend calls in publish gates.
- No real npm publish in Phase 11.
- Reference consumer strategy: current Nuxt app as preview harness.
- Backend 001 Compatibility Mode readiness gate: independent package readiness smoke.
- Backend 002 integration-dependent gate: later gated smoke; not readiness blocker.
