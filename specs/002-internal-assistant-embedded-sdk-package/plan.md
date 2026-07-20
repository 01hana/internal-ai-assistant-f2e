# Implementation Plan: Internal Assistant Embedded SDK Package

**Feature**: `002-internal-assistant-embedded-sdk-package`  
**Date**: 2026-07-15  
**Spec**: `specs/002-internal-assistant-embedded-sdk-package/spec.md`  
**Design**: `specs/002-internal-assistant-embedded-sdk-package/design.md`  
**Status**: Phase 11 planning added; ready for task execution after review

## 1. Overview

Frontend 002 的 implementation 目標是把 Frontend 001 已存在的 Internal Assistant Embedded Chat Panel 與 chat runtime 封裝成 Vue 3 / Nuxt 4 Host App 可安裝、初始化、掛載、卸載、提供最新 Host Context、管理 session 邊界、接收 host events 的 npm-compatible SDK package。

```text
Frontend 001
= AI 助理聊天面板本體與 chat runtime

Frontend 002
= npm package / SDK、Host App integration contract、
  package lifecycle、context provider、session isolation、
  consumer integration 與 package compatibility
```

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
- Frontend 002 may send only request-scoped Host Context, sanitized PageContext, selectedRows ID / safe summary, host-managed sessionId, authenticated actor handoff metadata, authenticated permission-context handoff metadata, and request correlation metadata as backend-revalidated input.
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
- `@internal-ai-assistant/assistant-sdk` workspace package does not exist.
- Library build config for the SDK package has not been selected or created.
- Public package export boundary does not exist yet.
- Reference consumer does not yet consume the assistant through package public entry.

### Post-Phase-10 Baseline

- `packages/assistant-sdk/` exists.
- `@internal-ai-assistant/assistant-sdk` workspace package exists.
- Vite library build support exists.
- Public package exports exist and remain limited to root entry plus `./styles.css`.
- Phase 10 validates real build / pack / dist / package artifact boundary.
- Remaining Phase 11 gap is productized runtime completeness and publish readiness, not basic package skeleton or artifact existence.

## 4. Implementation Strategy

Implementation order:

```text
contract / architecture guardrails
-> workspace package skeleton
-> public package surface
-> runtime reuse boundary
-> provider / config / callbacks separation
-> request builder modes
-> PageContext sanitization / forbidden fields
-> transport ownership
-> session fallback / lifecycle
-> host events / callbacks
-> styling / Nuxt reference consumer
-> Backend 001 Compatibility Mode smoke
-> Backend 002 integration-dependent smoke gates
-> release / regression gates
-> productized runtime completeness
-> packaged runtime install / mount / chat flow validation
-> publish metadata / README / final publish readiness gates
```

Each phase must define purpose, dependencies, primary areas, test-first entry criteria, implementation work, acceptance criteria, and non-goals. The later `tasks.md` will split these phases into executable tasks.

## 5. Package / Workspace Plan

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
- Monorepo source-time adapters may reuse Frontend 001 canonical source, but built SDK artifacts must not require consuming apps to resolve Frontend 001 `app/features`, `app/services`, `app/stores`, or `app/utils` paths.
- Vue remains a peer dependency; Nuxt becomes an optional peer dependency for the productized SDK.
- Package must not bundle a second Vue runtime.
- Nuxt integration must not create a second Vue app.
- Same-version track with Frontend 001 runtime is required.
- Productized package contents include `dist`, `styles.css`, and `README.md`; sourcemaps are not included initially.
- GitHub Packages is the selected publish-readiness target with registry `https://npm.pkg.github.com` and `publishConfig.access` set to `restricted`.
- Package name remains `@internal-ai-assistant/assistant-sdk` for now; before actual publish, confirm `@internal-ai-assistant` maps to the correct GitHub Packages owner / org scope and authentication setup.
- `private: true` remains until runtime completeness passes, then Phase 11 may remove it for publish readiness.
- Version remains `0.1.0`; license is `UNLICENSED`.

## 6. Public API / Export Plan

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
- Public style entry: `@internal-ai-assistant/assistant-sdk/styles.css`

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

## 7. Runtime Reuse Plan

Frontend 001 continues to own:

- ChatWidget / panel UI behavior
- Assistant API service behavior
- SSE parser and streaming runtime
- Session / history runtime
- AnswerDecision mapping
- EvidenceRef rendering / normalization
- Feedback flow
- ActionDraft confirmation behavior
- ApprovalRequest display behavior
- Retry / cancel / timeout / interrupted behavior

Frontend 002 wraps:

- Package install / export boundary
- Host App provider / config / callback integration
- Request builder mode policy
- Lifecycle and mount helpers
- Session isolation and fallback namespace policy
- Reference consumer package integration

Implementation may extract reusable runtime entry points from current app paths, but must not copy or fork them. If extraction is needed, keep one canonical runtime owner and update Frontend 001 imports to use the shared boundary. Frontend 001 regression tests become a Frontend 002 release gate.

Productized runtime packaging strategy:

- Short-term: bundle required compiled canonical runtime into SDK dist.
- Long-term: consider extracting a shared runtime package.
- Built package may contain compiled runtime code, but must not expose internal exports or retain unresolved `app/**` imports.
- `AssistantWidget` must not remain a shell placeholder.
- `mountAssistantWidget` must mount the complete productized widget.
- Guardrails remain: no second ChatWidget, assistant API client, SSE parser, session/history runtime, AnswerDecision mapper, or EvidenceRef renderer.

## 8. Provider / Configuration / Callbacks Plan

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

## 9. Mode-tiered Request Builder Plan

Request builder modes are frontend integration / request-builder / provider validation modes. They are not backend request modes.

### Backend 001 Compatibility Mode

- Use Backend 001 public request shape.
- Omit Frontend 002-only Host Context fields.
- Do not send unknown request fields.
- Do not append context into message text.
- Do not build hidden prompt content.
- If final outgoing request lacks Backend 001 required identity, stop or use existing integration / identity error flow.

### Backend 002 Mode

- Fail closed when required organization / identity / permission context is missing.
- Send only contract-compatible sanitized context.
- Do not send `sourceSystem`, connector, adapter, permissionResult, finalEvidenceSource, or other backend-owned decision fields.
- Consume backend safe outcomes only.
- Do not control backend connector / tool selection.

Mode matrix ownership will be implemented in request builder tests and public type tests, but must not introduce a backend request mode, backend endpoint, or mode-specific SSE parser.

## 10. PageContext Sanitization / Forbidden Fields Plan

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

## 11. Transport Ownership Plan

Package owns:

- Endpoint selection
- Request shape construction
- SSE parser
- Retry / cancel / timeout / error flow
- Sanitization / mode validation before transport

Default transport reuses Frontend 001 assistant service behavior. Injected authenticated executor is low-level only and cannot:

- Rewrite route
- Create second API client contract
- Create second SSE parser
- Change request envelope
- Bypass sanitization
- Bypass mode validation
- Serialize local-only state

Transport errors return to existing Frontend 001 error / retry flow.

## 12. Session Ownership / Fallback / Lifecycle Plan

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

## 13. Host Events / Callbacks Plan

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

## 14. Styling / Theme / Accessibility Plan

Stylesheet entry:

- `@internal-ai-assistant/assistant-sdk/styles.css`

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

## 15. Nuxt 4 Reference Consumer Plan

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

## 16. Testing Plan

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

Packaging validation must verify that the built SDK package can be consumed through `@internal-ai-assistant/assistant-sdk` public entries without unresolved Frontend 001 app path imports.

Required later validation:

- Run `npm pack` or an equivalent package artifact smoke after SDK build support exists.
- Install or consume the local tarball / workspace dist in the reference consumer.
- Reference consumer may import only `@internal-ai-assistant/assistant-sdk` and `@internal-ai-assistant/assistant-sdk/styles.css`.
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

### Productized SDK Publish Readiness Tests

- Productized widget runtime completeness.
- Productized mount smoke.
- Packaged Compatibility Mode chat flow.
- Packaged runtime source boundary.
- Publish metadata validation.
- README / usage documentation validation.
- Final productized SDK release readiness gate.

Phase 11 tests must not call external backend services. They use mock transport / mock SSE, create temporary consuming apps only under `/private/tmp`, and never execute real npm publish.

## 17. Phase Plan

### Phase 0 - Contract and Architecture Guardrails

- Purpose: lock architecture boundaries before code movement.
- Dependencies: accepted Frontend 002 spec/design, Frontend 001 baseline, Backend 001 contract docs.
- Primary areas: package boundary guardrails, test fixtures, lint/type guard decisions.
- Test-first entry criteria: failing tests or assertions for forbidden deep imports, forbidden fields, and no second runtime.
- Implementation work: define guardrail helpers and expected validation seams.
- Acceptance criteria: all later phases can reference a shared set of non-negotiable boundaries.
- Boundaries / non-goals: no implementation of package runtime yet.

### Phase 1 - Workspace Package Skeleton and Public Exports

- Purpose: create `@internal-ai-assistant/assistant-sdk` package skeleton.
- Dependencies: Phase 0 guardrails.
- Primary areas: `packages/assistant-sdk/`, workspace config, exports, styles entry.
- Test-first entry criteria: public export tests fail until exports exist.
- Implementation work: package metadata, Vite library config, `src/index.ts`, `styles.css`.
- Acceptance criteria: package can be resolved by reference consumer using public entry only.
- Boundaries / non-goals: no second Vue runtime, no deep import contract.

### Phase 2 - Runtime Reuse Boundary and Frontend 001 Extraction Points

- Purpose: expose reusable runtime boundaries without fork.
- Dependencies: package skeleton.
- Primary areas: `app/features/assistant/`, `app/services/api/assistant.ts`, `app/stores/assistant/`, `app/utils/assistant/`, package runtime wrappers.
- Test-first entry criteria: Frontend 001 regression tests remain green.
- Implementation work: extract or wrap canonical runtime entry points as needed.
- Acceptance criteria: Frontend 002 consumes the same runtime behavior as Frontend 001.
- Boundaries / non-goals: no copied ChatWidget, API client, SSE parser, store, mapper, or renderer.

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
- Acceptance criteria: transport errors return to Frontend 001 error / retry flow.
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

- Purpose: turn the buildable package artifact into a productized SDK ready for formal publish readiness review.
- Dependencies: Phase 10 real build / pack / install artifact closeout, Phase 8 Compatibility Mode smoke, and Phase 0 architecture guardrails.
- Primary areas: `packages/assistant-sdk/src/components/AssistantWidget.vue`, `packages/assistant-sdk/src/mountAssistantWidget.ts`, `packages/assistant-sdk/vite.config.ts`, `packages/assistant-sdk/tsconfig.build.json`, `packages/assistant-sdk/package.json`, `packages/assistant-sdk/README.md`, and Phase 11 productized SDK tests.
- Test-first entry criteria: tests fail when `AssistantWidget` is still a shell placeholder, `mountAssistantWidget` only returns a shell handle, dist contains unresolved `app/**` imports, README / publish metadata are missing, or a consuming app cannot resolve packed SDK public entries.
- Implementation work: connect `AssistantWidget` to complete canonical runtime, implement productized mount helper, stabilize packaging strategy, add GitHub Packages publish metadata, add README, and harden final release readiness gates.
- Acceptance criteria: external consuming app can install / resolve packed SDK, import root public entry and `styles.css` only, render complete chat UI, run Compatibility Mode with mock transport / mock SSE, and pass publish readiness validation without real publish.
- Boundaries / non-goals: no real npm publish, no external backend call, no new `./nuxt` export, no Shadow DOM, no second runtime, no Backend 002 production dependency, no DataAdapter / connector implementation.

## 18. Planned File / Directory Changes

### New Package Files

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

### Existing Frontend 001 Files That May Need Extraction / Stable Reusable Boundary

- `app/features/assistant/components/ChatWidget.vue`
- `app/features/assistant/composables/useChat.ts`
- `app/features/assistant/composables/useAssistantSession.ts`
- `app/features/assistant/composables/useAssistantSseStream.ts`
- `app/services/api/assistant.ts`
- `app/stores/assistant/`
- `app/types/assistant/`
- `app/utils/assistant/`

These files may need stable reusable boundaries, but must not be rewritten or forked into a second runtime.

### Reference Consumer Files

- Current Nuxt app root preview harness.
- `nuxt.config.ts` only if workspace dependency / alias / package consumption requires registration.
- Potential Nuxt plugin or preview route for package smoke, to be chosen in `tasks.md`.

### Test Areas

- `tests/unit/assistant/`
- `tests/component/assistant/`
- `tests/contract/assistant/`
- Reference consumer smoke tests.
- Optional Backend 002 integration-dependent smoke area.

### Phase 11 Productized SDK Files

- `packages/assistant-sdk/README.md`
- `tests/component/assistant-sdk/productized-widget-runtime.spec.ts`
- `tests/integration/assistant-sdk/productized-mount-smoke.spec.ts`
- `tests/integration/assistant-sdk/packaged-compatibility-chat-flow.spec.ts`
- `tests/contract/assistant-sdk/packaged-runtime-source-boundary.spec.ts`
- `tests/contract/assistant-sdk/publish-readiness.spec.ts`

Implementation may update package build config and SDK source only in Phase 11 execution, not during this planning update.

## 19. Architecture Guardrails

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

## 20. Risks and Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| Accidentally creating second API client | Keep `AssistantService` behavior canonical and expose only low-level executor injection |
| Accidentally forking Frontend 001 runtime | Extract reusable boundaries rather than copying files; run Frontend 001 regression gates |
| Provider / config / callbacks boundary confusion | Type and test separate provider, WidgetConfiguration, and HostCallbacks |
| Stale context | Re-resolve provider before send/retry and fail closed on provider error |
| Unsafe fallback session | Namespace by package, host, organization, scope, and page/entity; refuse persistent fallback without organization |
| selectedRows raw payload leakage | Count raw rows before sanitization, reject >20, accept ID / safe summary only |
| Forbidden field bypass | Central forbidden fields gate before transport |
| Injected transport bypass | Run request builder and validation before executor; executor cannot modify envelope |
| Backend 001 vs Backend 002 mode confusion | Document and test both as frontend modes only |
| CSS leakage | Scope package styles and add style isolation tests |
| Peer dependency / duplicate Vue runtime risk | Vue/Nuxt peer dependency strategy and install/build diagnostics |
| Workspace package build complexity | Use Vite library mode aligned with current Nuxt/Vite stack |
| Backend 002 not available | Keep Backend 001 Compatibility Mode package readiness path |
| AssistantWidget remains shell after packaging | Productized widget runtime completeness tests fail on shell placeholder output |
| Compiled runtime bundling leaks `app/**` source imports | Dist scan and packaged runtime source boundary tests block unresolved app-path imports |
| `private` flag removed before runtime completeness | Publish-readiness tests require runtime completeness gates before metadata changes |
| GitHub Packages scope / auth mismatch | Treat owner/org scope and authentication confirmation as a blocker before actual publish |
| README insufficient for external product engineers | README readiness tests require installation, usage, security, troubleshooting, compatibility, and release notes placeholder |
| Nuxt treated as required peer instead of optional peer | Publish metadata tests require Nuxt to be optional peer for Phase 11 |

## 21. Open Questions / Decisions for plan.md

No blocking open questions for Phase 11 planning after productized SDK decisions below.

Plan decisions made:

- Library build tool: Vite library mode.
- Package structure: `packages/assistant-sdk/`.
- Public export strategy: root public entry plus stylesheet entry only.
- GitHub Packages publish-readiness target.
- Package name remains `@internal-ai-assistant/assistant-sdk` for now.
- Runtime completeness before private flag removal.
- Short-term bundle compiled canonical runtime into SDK dist.
- Shared runtime package is a long-term consideration.
- `AssistantWidget` must become a complete widget.
- `mountAssistantWidget` must mount the complete widget.
- Exports remain root and styles only; no `./nuxt` in Phase 11.
- Peer dependency strategy: Vue as peer dependency, Nuxt as optional peer dependency.
- README is included in package artifact.
- License is `UNLICENSED`.
- Version remains `0.1.0`.
- No sourcemaps initially.
- No external backend calls in publish gates.
- No real npm publish in Phase 11.
- Reference consumer strategy: current Nuxt app as preview harness.
- Backend 001 Compatibility Mode readiness gate: independent package readiness smoke.
- Backend 002 integration-dependent gate: later gated smoke; not readiness blocker.
