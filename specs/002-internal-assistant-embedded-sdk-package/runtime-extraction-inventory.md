# Frontend 002 Phase 11 Runtime Extraction Inventory

**Feature**: `002-internal-assistant-embedded-sdk-package`  
**Batch**: Phase 11 Batch 1 / T097-T106  
**Status**: Baseline and dependency inventory for Canonical Runtime Library-Safe Extraction  
**Scope**: Inventory only. This file records the baseline, dependency graph, historical SDK bridges, legacy tests, and owner migration matrix. It does not create runtime capabilities, migrate Frontend 001, remove bridges, or productize the SDK widget.

## Baseline Matrix

| Command / Check | Scope | Result | Failure Summary | Status | Blocking for T097-T106 | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `git status --short` | Pre-edit workspace status | pass | Existing Batch 1 worktree changes were present before this targeted cleanup | pre-existing baseline | no | Pre-existing dirty/untracked files included package/workspace metadata, T097-T106 tasks state, `packages/assistant-runtime/**`, this inventory, and Batch 1 guard tests. |
| `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` | Spec Kit prerequisites | pass | None | pre-existing baseline | no | Returned Frontend 002 feature dir and `tasks.md`. |
| `.specify/extensions.yml` hook inspection | Implement hook availability | pass | No `before_implement` / `after_implement` hooks | pre-existing baseline | no | Hooks skipped. |
| `find specs/002-internal-assistant-embedded-sdk-package/checklists ...` | Feature checklists | pass | No checklist files present | pre-existing baseline | no | No checklist gate exists for this feature. |
| `npx vitest run tests/unit/assistant/sse-parser.spec.ts --reporter=dot` | Focused Frontend 001 SSE parser baseline | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed: 1 file, 16 tests. |
| `npx vitest run tests/component/assistant/send-message-streaming.spec.ts --reporter=dot` | Focused Frontend 001 streaming component baseline | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed: 1 file, 33 tests. |
| `npx vitest run tests/contract/assistant/assistant-service.spec.ts --reporter=dot` | Focused Frontend 001 assistant service contract baseline | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed: 1 file, 2 tests. |
| `npx vitest run tests/component/assistant-sdk/runtime-reuse.spec.ts --reporter=dot` | Focused Frontend 002 historical runtime reuse component baseline | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed: 1 file, 5 tests. |
| `npm run test:unit -- no-second-runtime` | Frontend 002 runtime duplication guard | pass | None | pre-existing baseline | no | Vitest unit sweep passed. |
| `npm run test:component -- send-message-streaming` | Frontend 001 streaming component baseline via existing component script | fail | Broad component command also ran Phase 11 productized SDK guard and failed on current SDK shell copy: `Assistant SDK shell is ready` | pre-existing Phase 11 productization gap | no, use direct file-level regression routing where needed | Failure belongs to T144/T145 productized runtime, not T097-T106. |
| `npm run test:contract -- assistant-service` | Frontend 001 service contract baseline via existing contract script | fail | Broad contract command also ran Phase 11 publish readiness and failed on missing license, Nuxt optional peer metadata, README file inclusion, and SDK README | pre-existing Phase 11 publish readiness gap | no, use focused contract routing where needed | Failure belongs to T147/T148, not T097-T106. |
| `npm run build:assistant-sdk` | Phase 10 SDK build baseline | pass | None | Batch 1 targeted cleanup validation | no | Vite emitted `dist/index.mjs`; `vue-tsc` completed declaration output. |
| `npm run typecheck --workspace @internal-ai-assistant/assistant-runtime` | Shared runtime library-safe typecheck entry | pass | None | Batch 1 validation | no | New private runtime workspace typechecked with `vue-tsc`. |
| `npm run typecheck` | Repo typecheck baseline | pass | None | Batch 1 validation | no | Nuxt typecheck completed after workspace/package metadata changes. |
| `npm_config_cache=/private/tmp/npm-cache npm pack --dry-run` from `packages/assistant-sdk` | SDK local pack inspection | pass | None | Batch 1 targeted cleanup validation | no | Tarball contents stayed limited to `dist`, `styles.css`, and `package.json`; total files: 10. |
| `npx vitest run tests/component/assistant-sdk/productized-widget-runtime.spec.ts --reporter=dot` | T092 productized widget runtime guard | expected fail | Current `AssistantWidget.vue` still contains exact shell text `Assistant SDK shell is ready` | expected T144 productized widget gap | no | Test file is valid and fails at the intended shell/runtime completeness boundary. |
| `npx vitest run --config /private/tmp/frontend002-phase11-integration.vitest.config.mjs tests/integration/assistant-sdk/productized-mount-smoke.spec.ts --reporter=dot` | T093 packaged mount smoke guard | expected fail | Installed package resolves public entries, then `mountAssistantWidget` does not mount DOM and duplicate mount diagnostics are absent | expected T145 productized mount gap | no | Temp consumer uses `/private/tmp`, local `npm pack`, unpacked package tarball, and local Vue/Pinia symlinks; no network install/publish. |
| `npx vitest run --config /private/tmp/frontend002-phase11-integration.vitest.config.mjs tests/integration/assistant-sdk/packaged-compatibility-chat-flow.spec.ts --reporter=dot` | T094 packaged Compatibility Mode chat flow guard | expected fail | Package public entries resolve and request fixture is safe; all seven outcome tests fail because installed mount helper does not mount widget DOM | expected T143/T144/T145/T146 productized runtime gap | no | Completed-answer, no-answer, clarification, permission-denied, tool-failure, timeout, and interrupted outcomes remain individually asserted. |
| `npx vitest run tests/contract/assistant-sdk/packaged-runtime-source-boundary.spec.ts --reporter=dot` | T095 packaged runtime source boundary guard | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed: 1 file, 4 tests. |
| `npx vitest run tests/contract/assistant-sdk/publish-readiness.spec.ts --reporter=dot` | T096 publish readiness guard | expected fail | Runtime/private sequencing evidence passes; metadata/README checks fail on missing `license`, missing `publishConfig`, missing README in `files`, and missing README file | expected T147/T148 publish-readiness gap | no | Direct spec now completes without helper timeout: 3 tests pass, 3 fail for future metadata/docs tasks. |
| `npx vitest run tests/contract/assistant-sdk/canonical-runtime-owner.spec.ts --reporter=dot` | Focused T099 direct guard | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed with shared-runtime boundary and SDK no-duplicate-runtime checks. |
| `npm run test:contract -- canonical-runtime-owner` | New T099 npm-script validation route | expected fail by broad sweep | Existing `publish-readiness.spec.ts` T147/T148 metadata/README/private sequencing failures are swept by the contract script | pre-existing Phase 11 publish gap | no, direct file-level route used | New `canonical-runtime-owner.spec.ts` passed with direct Vitest. |
| `npx vitest run tests/contract/assistant-sdk/sdk-declaration-boundary.spec.ts --reporter=dot` | Focused T100 direct guard | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed with version-tolerant Pinia ownership semantics. |
| `npm run test:contract -- sdk-declaration-boundary` | New T100 npm-script validation route | expected fail by broad sweep | Existing `publish-readiness.spec.ts` T147/T148 metadata/README failures are swept by the contract script | pre-existing Phase 11 publish gap | no, direct file-level route used | New `sdk-declaration-boundary.spec.ts` passed with direct Vitest. |
| `npx vitest run tests/unit/assistant-sdk/runtime-state-isolation.spec.ts --reporter=dot` | Focused T101 direct source-graph guard | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed with repository source scan plus shared-backend-session conceptual check. |
| `npm run test:unit -- runtime-state-isolation` | New T101 validation route | pass | None | Batch 1 validation | no | Broad unit sweep passed with the new isolation spec included. |
| `npx vitest run tests/contract/assistant-sdk/legacy-bridge-source-graph.spec.ts --reporter=dot` | Focused T102 direct guard | pass | None | Batch 1 targeted cleanup validation | no | Direct spec passed for transitional and target graph states. |
| `npm run test:contract -- legacy-bridge-source-graph` | New T102 npm-script validation route | expected fail by broad sweep | Existing `publish-readiness.spec.ts` T147/T148 metadata/README failures are swept by the contract script | pre-existing Phase 11 publish gap | no, direct file-level route used | New `legacy-bridge-source-graph.spec.ts` passed with direct Vitest. |
| `npx vitest run tests/unit/assistant-runtime/transport-port.spec.ts --reporter=dot` | New T103/T106 transport port guard | pass | None | Batch 1 validation | no | Port operation and ownership contract passed. |
| Direct public/package boundary Vitest files | Public exports, public boundary, package release exports, artifact smoke, dist scan, packaged runtime source boundary | pass | None | Batch 1 regression | no | Six focused contract specs passed after SDK build. |
| Direct `peer-dependency-boundary.spec.ts` | Peer/dependency boundary | pass | None | Batch 1 regression | no | Vue peer and no bundled Vue checks passed. |
| `git diff --check` | Whitespace/conflict marker validation | pass | None | targeted cleanup validation | no | Non-mutating diff check completed after inventory refresh. |

## ChatWidget Dependency Graph

Current canonical behavior is still rooted in `app/features/assistant/components/ChatWidget.vue`, but that file is not yet a library-safe reusable runtime boundary.

| Area | Current Files | Classification | Extraction Target |
| --- | --- | --- | --- |
| Chat widget shell and panel composition | `app/features/assistant/components/ChatWidget.vue`, `app/features/assistant/components/ChatPanel.vue` | Canonical behavior owner, Nuxt/app-bound source | Move reusable component tree to `packages/assistant-runtime/**`; keep Frontend 001 wrapper thin. |
| Chat orchestration | `app/features/assistant/composables/useChat.ts` | Canonical runtime behavior with app-specific service/config dependencies | Extract session/history/message orchestration to shared runtime controller and ports. |
| Session lifecycle | `app/features/assistant/composables/useAssistantSession.ts`, `app/stores/assistant/useSessionStore.ts` | Canonical behavior plus app Pinia context | Extract library-safe stores/controller; Frontend 001 and SDK provide independent Pinia instances. |
| SSE parsing and streaming | `app/utils/assistant/assistantSseParser.ts`, `app/features/assistant/composables/useAssistantSseStream.ts` | Canonical SSE behavior, currently app-owned | Extract parser/stream model/lifecycle to shared runtime; adapters only provide transport capability. |
| Assistant service / HTTP | `app/services/api/assistant.ts` | Frontend 001 Nuxt transport adapter behavior | Keep in Frontend 001 adapter space; shared runtime consumes a transport port. |
| Assistant domain types | `app/types/assistant/**` | Canonical domain type owner, app path leaks into declaration graph if imported directly | Extract public-safe runtime domain types or facade through SDK public types. |
| UI primitive dependencies | Nuxt UI components, auto imports, app store composables | Nuxt-specific integration | Replace shared runtime internals with explicit library-safe imports/primitives or adapter slots. |

## Repository-Derived Dependency Scan

The targeted source scan covered `app/features/assistant`, `app/services/api/assistant.ts`, `app/stores/assistant`, `app/utils/assistant`, `app/types/assistant`, `packages/assistant-runtime`, and `packages/assistant-sdk/src`.

| Source File / Area | Direct Dependency Evidence | Current Owner | Nuxt/App-Specific Status | Shared-Safe Status | Extraction Target | Migration / Cleanup Task |
| --- | --- | --- | --- | --- | --- | --- |
| `app/features/assistant/components/ChatWidget.vue` | Imports assistant types; renders `UButton` and `UIcon`; composes widget launcher/panel behavior | Frontend 001 product behavior baseline | Nuxt UI auto-registered primitives | Not shared-safe until UI primitive replacement and explicit imports | Shared canonical widget wrapper/component tree | T126-T129, then T119-T121/T139 cleanup |
| `app/features/assistant/components/ChatPanel.vue` | Imports assistant types and session recovery reason; renders `UIcon` and `UButton` controls | Frontend 001 product behavior baseline | Nuxt UI primitives and app session recovery types | Not shared-safe until component/type dependencies move | Shared panel/conversation shell | T126-T129 |
| `app/features/assistant/components/ChatInputBar.vue` | Imports `AssistantSendDisabledReason`; renders `UTextarea` and `UButton` | Frontend 001 composer owner | Nuxt UI primitives | Composer behavior is shared-safe after primitive replacement | Shared composer/send action | T126-T129 |
| `app/features/assistant/components/ChatMessageArea.vue` | Imports resolver and message components; renders `UAlert`, `UEmpty`, `UButton` | Frontend 001 message area owner | Nuxt UI primitives and app message component graph | Safe outcome composition is shared-safe after type/UI extraction | Shared conversation/message list and safe outcome rendering | T116-T121 and T126-T129 |
| `app/features/assistant/components/AiMessageItem.vue` | Imports answer decision mapper and evidence normalization adapter; renders `UBadge` | Frontend 001 answer rendering owner | App utility paths and Nuxt UI primitive | Shared-safe after mapper/evidence helpers move | Shared answer/evidence rendering | T113-T118 |
| `app/features/assistant/components/*Outcome*.vue`, `*Message.vue` | Uses `UBadge`, `UAlert`, `UButton`, `UIcon` across no-answer, clarification, permission-denied, tool-failure, interrupted, degraded, approval, and action draft messages | Frontend 001 safe outcome UI owner | Nuxt UI primitives and app assistant types | Shared-safe after domain/outcome/UI primitive extraction | Shared safe outcome, approval, feedback, and action UI | T113-T121 and T126-T129 |
| `app/features/assistant/composables/useChat.ts` | Imports `createHttpClient`, `AssistantService`, app assistant types, request/session helpers; calls `useRuntimeConfig()` | Frontend 001 orchestration owner | Direct Nuxt runtime config and app HTTP service dependency | Not shared-safe until transport port extraction | Shared runtime controller plus Frontend 001 Nuxt transport adapter | T110-T115 and T130-T132 |
| `app/features/assistant/composables/useAssistantSession.ts` | Imports `AssistantService`, `useAssistantSessionStore`, session recovery and storage helpers | Frontend 001 session/history owner | App service/store dependency | Shared-safe after store and transport ports | Shared session/history controller | T110-T112 and T122-T125 |
| `app/features/assistant/composables/useAssistantSseStream.ts` | Imports Vue APIs, `AssistantService`, assistant types, and `assistantSseParser` | Frontend 001 SSE stream owner | App service dependency | SSE model is shared-safe after transport port split | Shared SSE parser/stream lifecycle | T107-T112 |
| `app/features/assistant/composables/useAssistantHostContext.ts` | Imports Vue APIs, app host context types, default session scope resolver, and page context sanitizer | Frontend 001 host context integration owner | App page/session context integration | Only pure helpers are shared-safe; host wiring remains adapter-specific | Shared-safe helper subset plus Frontend 001/SDK adapters | T107-T110 and T134-T136 |
| `app/stores/assistant/useSessionStore.ts` | Imports `computed`, `ref`, `defineStore`, assistant types, answer/evidence mappers, and session recovery types | Frontend 001 app Pinia store owner | Active app Pinia registration | Store logic can move after controller/state isolation guards | Shared library-safe Pinia stores/controller | T122-T125 |
| `app/stores/assistant/useChatWidgetStore.ts` | Uses `defineStore` for assistant widget panel availability | Frontend 001 app widget state owner | Active app Pinia registration | Needs widget-local SDK runtime scope later | Shared or adapter-local panel state | T122-T125 and T134-T136 |
| `app/services/api/assistant.ts` | Imports assistant envelope/type contracts and HTTP/service behavior | Frontend 001 Nuxt transport adapter | App HTTP/auth/header/correlation owner | Not shared runtime; adapter only | Nuxt transport adapter implementing shared port | T130-T132 |
| `app/types/assistant/**` | Domain contracts, envelopes, host context, evidence, actions, UI types | Frontend 001 type owner | App path leaks into declaration graph if reused directly | Shared-safe after package-safe facade split | `packages/assistant-runtime/src/types/**` plus SDK public facade | T107-T109 and T122 |
| `app/utils/assistant/**` | SSE parser, renderer resolver, answer decision mapper, evidence normalization, page/session helpers | Frontend 001 utility owner | Mixed pure helpers and app-specific session/page helpers | Pure helpers shared-safe; app/page context helpers need adapter split | Shared helpers/SSE/outcome modules where appropriate | T107-T118 |
| `packages/assistant-sdk/src/runtime/*Adapter.ts` | Historical imports from `app/features`, `app/services`, `app/stores`, `app/utils`, `app/types` | Frontend 002 historical bridge seams | Allowed only as documented transitional bridges | Not final SDK source | Replace with shared-runtime SDK adapters | T133-T137 |
| `packages/assistant-runtime/src/transport/ports.ts` | No imports; type-only port definitions | Future shared runtime port owner | No app/Nuxt dependency | Shared-safe Batch 1 foundation | Shared transport port foundation | T103-T106 |

## Nuxt / App-Specific Dependencies To Remove From Shared Runtime

- Nuxt auto-imported Vue APIs and components must become explicit imports.
- `useRuntimeConfig`, `useNuxtApp`, `#imports`, `#app`, route/layout/theme integration, and app HTTP/auth helpers stay in the Frontend 001 Nuxt Adapter.
- Active Frontend 001 Pinia assumptions such as global app store access stay out of `packages/assistant-runtime/**`.
- Nuxt UI primitives require a library-safe alternative, thin adapter, native semantic Vue component, or renderless adapter slot before entering shared runtime.
- Frontend 002 SDK code may not import `app/features/**`, `app/services/**`, `app/stores/**`, `app/utils/**`, or `app/types/**` during Phase 11.

## Shared-Safe Capability Classification

These capabilities are eligible for `packages/assistant-runtime/**` after tests-first extraction because they describe canonical assistant behavior without requiring Nuxt ownership:

- Assistant domain types, discriminated unions, and pure render/output helpers.
- SSE frame parsing, canonical stream event modeling, delta accumulation, EOF-before-final interrupted handling, and inactivity timeout state.
- Session/history orchestration, retry/cancel lifecycle, pending stream cleanup, and safe runtime state transitions.
- AnswerDecision, EvidenceRef, safe final outcome handling, no-answer, clarification, permission-denied, tool-failure, timeout, and interrupted rendering state.
- Feedback, ActionDraft, confirmation, ApprovalRequest display, and approval IDs-only event input modeling.
- Library-safe Pinia stores, runtime controller factories, and explicit Vue component imports.
- Canonical conversation/message list, composer, streaming/status surfaces, evidence/feedback/action/approval UI primitives.

## Frontend 001 App-Specific Classification

These responsibilities remain in the Frontend 001 Nuxt Adapter and must not enter the shared runtime as direct dependencies:

- `useRuntimeConfig`, Nuxt `$fetch`, app auth/header integration, route/layout/theme wiring, and Nuxt app lifecycle.
- Nuxt UI plugin assumptions, auto-registered component names, app-level provide/inject conventions, and active Nuxt app context.
- Current app Pinia registration and app store bootstrap. Shared runtime may use Pinia, but Frontend 001 supplies the app-owned Pinia context through its adapter.
- Frontend 001 page wrappers, layout placement, route/entity/page context derivation, and product regression ownership.

## Frontend 002 SDK-Specific Classification

These responsibilities stay in `packages/assistant-sdk/**` and must not become shared runtime business logic:

- Public SDK root entry, stylesheet entry, package export map, declaration facade, and install artifact boundaries.
- Host provider/configuration/callback validation, local-only field enforcement, request builder/security gate, Compatibility Mode request omission rules, and Host Integration fail-closed gates.
- Default/injected transport adapter wiring, safe transport error surfaces, host event callback projection, mount lifecycle, duplicate diagnostics, and per-widget isolated Vue app creation.
- SDK package build, pack, dist scans, temporary consumer smoke, README/publish metadata readiness, and GitHub Packages boundary.

## Nuxt UI / Auto-Import Inventory

- Current Frontend 001 assistant UI depends on Nuxt auto-import conventions and Nuxt UI primitives. Extraction must replace those dependencies with explicit imports, library-safe Vue primitives, or adapter slots before code enters `packages/assistant-runtime/**`.
- Shared runtime source must not import `#imports`, `#app`, `nuxt`, Nuxt UI runtime modules, app aliases, or files under `app/**`.
- Frontend 001 transitional wrappers may delegate to old app owners during a slice migration, but Frontend 002 SDK source must not import or alias those app owners at any stage.

| Primitive / Pattern | Current Evidence | Shared Runtime Strategy | Later Task |
| --- | --- | --- | --- |
| `UButton` | `ChatWidget.vue`, `ChatInputBar.vue`, `ChatPanel.vue`, `ChatMessageArea.vue`, `FeedbackControls.vue`, `InterruptedMessage.vue`, `DegradedMessage.vue`, `SessionRecoveryMessage.vue`, `ApprovalRequestDisplayMessage.vue`, `ActionDraftConfirmationMessage.vue` | Replace with library-safe button primitive, semantic HTML, or adapter slot | T126-T129 |
| `UTextarea` | `ChatInputBar.vue` | Replace with shared composer textarea primitive | T126-T129 |
| `UBadge` | Evidence, answer, clarification, permission-denied, tool-failure, no-answer, escalation, approval, and action-draft components | Replace with shared badge/status primitive | T116-T121 and T126-T129 |
| `UAlert` | `ChatMessageArea.vue`, `SessionRecoveryMessage.vue`, `ActionDraftConfirmationMessage.vue` | Replace with shared alert/status primitive | T116-T121 and T126-T129 |
| `UEmpty` | `ChatMessageArea.vue` | Replace with shared empty-state primitive | T126-T129 |
| `UIcon` | `ChatWidget.vue`, `ChatPanel.vue`, `AssistantAvatar.vue`, `AiStreamingItem.vue`, approval/action components | Replace with icon adapter slot or library-safe primitive; Frontend 001 may keep Nuxt icon adapter | T126-T129 |

| Dependency | Current Evidence | Classification | Required Handling |
| --- | --- | --- | --- |
| Vue APIs (`ref`, `computed`, `watch`, `shallowRef`) | Explicit imports already exist in stores and composables scanned | Shared-safe when explicit | Preserve explicit imports in shared runtime slices. |
| Pinia `defineStore` | `app/stores/assistant/useSessionStore.ts`, `app/stores/assistant/useChatWidgetStore.ts` | Shared-safe only with widget-local/app-provided Pinia instances | Extract after state-isolation guards; SDK consumer must not initialize Pinia. |
| `useRuntimeConfig()` | `app/features/assistant/composables/useChat.ts` | Nuxt/app-specific | Move behind Frontend 001 Nuxt transport adapter; never enter shared runtime or SDK source. |
| Nuxt UI auto-registered component names | `UButton`, `UTextarea`, `UBadge`, `UAlert`, `UEmpty`, `UIcon` template usage | Nuxt/app-specific | Replace before shared UI extraction. |
| App relative service imports | `../../../services`, `../../../services/api/assistant` in `useChat.ts` and `useAssistantSession.ts` | Frontend 001 adapter-specific | Keep in Nuxt adapter; shared runtime consumes transport port. |
| App relative type imports | `../../../types/assistant`, `../../types/assistant`, `./contracts`, `./evidence` | Mixed domain/app type owner | Extract public-safe shared domain types and SDK public type facade. |
| App relative utility imports | `../../../utils/assistant/*`, `../../utils/assistant/*` | Mixed pure/app helper owner | Move pure helpers by capability slice; keep app page/session wiring in adapter. |
| App store imports | `../../../stores/assistant/useSessionStore` | Active Frontend 001 Pinia owner | Replace with shared store/controller plus adapter Pinia contexts. |
| `#imports`, `#app`, `useNuxtApp`, `useRoute`, `useRouter` | No direct matches in scanned assistant roots beyond implicit Nuxt component behavior and `useRuntimeConfig()` | Needs confirmation during slice inventory | Guards forbid these in shared runtime and SDK source. |

## Legacy SDK Bridge Inventory

These files are historical reuse seams from Phase 2 / Phase 5. They remain active during Batch 1 and are not removed until the later legacy bridge replacement task.

| Legacy Bridge | Current Role | Final Target |
| --- | --- | --- |
| `packages/assistant-sdk/src/runtime/frontend001Runtime.ts` | Aggregates historical Frontend 001 runtime bridge entries | Delete in T137 and redirect active SDK runtime imports to `packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts`. |
| `packages/assistant-sdk/src/runtime/chatWidgetAdapter.ts` | References Frontend 001 ChatWidget source | Replace with shared-runtime SDK adapter after UI extraction. |
| `packages/assistant-sdk/src/runtime/composableAdapter.ts` | References Frontend 001 chat/session/SSE composables | Replace with shared-runtime controller/port adapters. |
| `packages/assistant-sdk/src/runtime/sessionAdapter.ts` | References Frontend 001 session lifecycle owner | Replace with shared-runtime session adapter after session/history extraction. |
| `packages/assistant-sdk/src/runtime/sseStreamAdapter.ts` | References Frontend 001 SSE stream owner | Replace with shared-runtime stream adapter after SSE extraction; final bridge cleanup remains T137. |
| `packages/assistant-sdk/src/runtime/serviceAdapter.ts` | References Frontend 001 assistant service owner | Replace with SDK transport port adapter. |
| `packages/assistant-sdk/src/runtime/assistantTypeAdapter.ts` | Type-only Frontend 001 assistant type bridge | Replace with shared runtime or SDK facade type references. |
| `packages/assistant-sdk/src/transport/defaultTransport.ts` | Historical default transport service seam | Rewire to shared runtime transport port adapter after transport foundation. |
| `packages/assistant-sdk/src/transport/sseStreamBridge.ts` | Historical SSE delegation seam | Rewire to shared runtime stream port; must not parse SSE in SDK. |

## Legacy Test Inventory

| Test Area | Current Files | Historical Meaning | Phase 11 Migration |
| --- | --- | --- | --- |
| Runtime reuse | `tests/component/assistant-sdk/runtime-reuse.spec.ts`, `tests/unit/assistant-sdk/runtime-composables-reuse.spec.ts`, `tests/unit/assistant-sdk/runtime-services-reuse.spec.ts` | Guards against copying Frontend 001 runtime during early SDK shell work | Migrate assertions from app-source bridge reuse to shared-runtime owner reuse after extraction. |
| SSE ownership | `tests/unit/assistant-sdk/sse-ownership.spec.ts` | Guards against second SDK SSE parser | Update canonical owner from app paths to shared runtime paths after SSE extraction. |
| Transport seams | `tests/contract/assistant-sdk/default-transport.spec.ts`, `tests/contract/assistant-sdk/injected-executor.spec.ts` | Guards request ownership and low-level executor boundaries | Rewire to shared runtime transport port while preserving no-bypass guarantees. |
| Productized readiness | `tests/component/assistant-sdk/productized-widget-runtime.spec.ts`, `tests/integration/assistant-sdk/productized-mount-smoke.spec.ts`, `tests/integration/assistant-sdk/packaged-compatibility-chat-flow.spec.ts` | Final productized SDK readiness guards | Remain checked tests-first guardrails; they do not replace extraction-specific guards. |
| Package artifact | `tests/contract/assistant-sdk/package-artifact-smoke.spec.ts`, `tests/contract/assistant-sdk/dist-internal-path-scan.spec.ts`, `tests/contract/assistant-sdk/package-release-exports.spec.ts` | Phase 10 artifact boundary guards | Continue to validate package skeleton and dist/public export boundary. |

## Owner To Shared Runtime Migration Matrix

| Current Owner | Capability | Shared Runtime Target | Adapter Responsibility After Migration | Old Owner Action |
| --- | --- | --- | --- | --- |
| `app/types/assistant/**` | Domain types and pure helpers | `packages/assistant-runtime/src/types/**` and helper modules | SDK public facade re-exports only public-safe types | Thin or redirect app owners after regressions. |
| `app/utils/assistant/assistantSseParser.ts` | Canonical SSE parser | Shared runtime SSE parser/event model | Frontend 001 and SDK provide stream transport only | Remove app parser as business owner after switch. |
| `app/features/assistant/composables/useAssistantSseStream.ts` | Stream lifecycle | Shared runtime stream controller | Adapters return safe transport results | Thin app composable after regression closure. |
| `app/features/assistant/composables/useAssistantSession.ts` | Session/history orchestration | Shared runtime session/history controller | Frontend 001 supplies app state adapter; SDK supplies namespace/lifecycle adapter | Thin app composable and remove duplicate ownership. |
| `app/stores/assistant/**` | Runtime state | Shared runtime Pinia stores/controller | Frontend 001 uses app Pinia; SDK creates widget-local Pinia | Retain only adapter/wrapper stores if needed. |
| `app/features/assistant/components/**` | Canonical UI behavior | Shared runtime library-safe Vue component tree | Frontend 001 wraps Nuxt integration; SDK wraps theme/config/lifecycle | Delete or thin old component owners. |
| `app/services/api/assistant.ts` | Nuxt HTTP/auth service | Frontend 001 Nuxt transport adapter | Shared runtime receives transport port result | Keep as adapter, not canonical runtime owner. |
| `packages/assistant-sdk/src/runtime/frontend001Runtime.ts` | Historical SDK bridge aggregate | `packages/assistant-sdk/src/runtime/sdkRuntimeAdapter.ts` | SDK adapter wires provider/request/transport/events/session into shared runtime | Delete in T137. |

## T103-T106 File-Level Audit

| Task Area | Files Audited | Result | Evidence |
| --- | --- | --- | --- |
| T103 / T106 transport port foundation | `packages/assistant-runtime/src/transport/ports.ts` | pass | Type-only module with no imports, no endpoint/route/request envelope ownership, no SSE parser/session state machine/renderer, and explicit adapter-vs-runtime ownership lists. Port operations cover create session, load history, send/stream, cancel/abort, feedback, action confirmation/rejection, and approval load. |
| T104 private shared runtime workspace | `packages/assistant-runtime/package.json`, `packages/assistant-runtime/tsconfig.json`, root `package.json`, `package-lock.json` | pass | Workspace is registered, package is private/internal, has no `publishConfig`, no public exports contract, no publish script, and has an independent `typecheck` script. Lockfile includes `packages/assistant-runtime`. |
| T105 dependency ownership | `packages/assistant-sdk/package.json`, `packages/assistant-runtime/package.json`, `package-lock.json` | pass | SDK keeps Vue as peer, Nuxt as optional peer, and Pinia as regular dependency with a non-empty range. Runtime package has Pinia dependency and Vue peer for internal library-safe typecheck/build ownership. |
| Shared runtime source safety | `packages/assistant-runtime/**` | pass | Current source contains no `app/**`, Nuxt imports, SDK public facade dependency, renderer implementation, SSE parser, session state machine, endpoint/route ownership, request envelope ownership, or frontend-owned authority. |
| SDK source transitional bridge boundary | `packages/assistant-sdk/src/runtime/**` | pass for Batch 1 transitional state | Historical bridge files still own the only documented SDK `app/**` imports. New `sdkRuntimeAdapter.ts` is intentionally absent in this batch; no T107+ adapter migration or bridge deletion was started. |

## Batch 1 Completion Boundary

T097-T106 are complete only when this inventory exists, guard tests are present and focused, the private `packages/assistant-runtime/**` workspace shell exists, dependency ownership reflects Vue peer / Pinia runtime dependency / Nuxt optional status, transport port foundation exists, and focused validation can distinguish pre-existing Phase 11 productization gaps from Batch 1 failures.

This batch intentionally does not extract types/helpers, SSE, session/history, outcomes, feedback/action/approval, Pinia stores, runtime controller, canonical UI, Frontend 001 migration, SDK adapter migration, bridge removal, productized widget/mount behavior, README, publish metadata, or final release readiness.

## Extraction Risks

- A shared runtime slice can accidentally retain `app/**` or Nuxt globals through type-only imports. Guard with shared-runtime source scans and SDK declaration boundary checks before switching owners.
- Runtime state can become process-wide if Pinia instances, AbortControllers, streams, timers, listeners, or pending callbacks are created at module scope. Guard with repository source scanning and per-widget state isolation tests.
- Historical SDK bridge tests can keep proving app-source delegation after the shared runtime exists. T133/T137 must migrate or replace those tests/bridges instead of preserving legacy bridge imports indefinitely.
- Frontend 001 behavior may regress during owner switches. Each capability slice must run tests first, switch Frontend 001 to the shared owner, run regressions, then thin or remove the old owner.
- Broad npm contract wrappers currently sweep T147/T148 publish-readiness expected-red tests. Batch 1 uses direct focused specs as completion evidence and records broad-wrapper failures as non-blocking until metadata/README tasks close.
