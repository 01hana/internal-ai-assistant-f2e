# Assistant Integration Status

**Last audited**: 2026-07-27  
**Scope**: Frontend 001 chat panel, Frontend 002 SDK, Backend 001 public handoff, and the customer-host integration boundary.  
**Status legend**: `Ready` = verified in this repository; `Conditional` = implementation exists but needs an external system/configuration; `Blocked` = no contract or target project is available to verify.

## Executive status

| Area | Status | Evidence / decision |
|---|---|---|
| Frontend 001 embedded chat panel | Ready | Spec Kit `001-internal-assistant-embedded-chat-panel` implementation tasks T001–T096 are marked complete; the Nuxt adapter remains the product regression baseline. |
| Shared canonical assistant runtime | Ready | `packages/assistant-runtime/` is the reusable owner for state, SSE, session/history, outcomes, evidence, feedback, action and approval display. |
| Frontend 002 public SDK | Ready for package-level integration | Spec Kit `002-internal-assistant-embedded-sdk-package` implementation tasks T001–T149 are marked complete. The public API is `AssistantWidget`, `mountAssistantWidget`, and `styles.css`. |
| Backend 001 compatibility flow | Conditional | The public REST/SSE contract exists and SDK tests pass. A real host must provide authenticated identity propagation and route `/api/v1/assistant/**` to the backend. |
| Backend 002 / full host-aware integration | Blocked | The Frontend 002 spec references `specs/002-host-integration-gateway-and-data-adapter-contract/`, but that directory and its contract are absent from this workspace. |
| Customer project integration | Blocked | No customer project source, deployment configuration, gateway configuration, or API environment is present in this workspace. |

## Source-of-truth map

| Concern | Canonical source | Consumer / owner |
|---|---|---|
| UI behaviour and Nuxt integration | `specs/001-internal-assistant-embedded-chat-panel/{spec,design,plan,tasks}.md` | Frontend 001 Nuxt adapter under `app/` |
| Reusable SDK lifecycle, public API and host boundary | `specs/002-internal-assistant-embedded-sdk-package/{spec,design,plan,tasks}.md`, `packages/assistant-sdk/README.md` | `packages/assistant-sdk/` |
| Existing backend public API and SSE | `docs/contracts/backend-assistant-core/` | Backend 001 and both frontend adapters |
| Reusable runtime | `packages/assistant-runtime/` | Frontend 001 and SDK; it is not a public package API |
| Backend 002 host-aware contract | **Missing from this workspace** | Must be supplied by the backend Spec Kit / backend repository before host-aware acceptance can be claimed |

## Confirmed integration contract: Backend 001 Compatibility Mode

### Routes and response mode

| Operation | Route | Expected response |
|---|---|---|
| Create session | `POST /api/v1/assistant/sessions` | JSON envelope |
| Restore session | `GET /api/v1/assistant/sessions/:sessionId` | JSON envelope |
| Load history | `GET /api/v1/assistant/sessions/:sessionId/messages?limit=&cursor=&order=asc` | JSON envelope; use `nextCursor`, not `hasMore` |
| Send message | `POST /api/v1/assistant/sessions/:sessionId/messages` | `text/event-stream` |
| Feedback | `POST /api/v1/assistant/messages/:messageId/feedback` | JSON envelope |
| Action draft | `GET/POST /api/v1/assistant/action-drafts/:id/...` | JSON envelope |
| Approval display | `GET /api/v1/assistant/approval-requests/:id` | Display-only in this feature |

The final SSE event is authoritative: use `final.data.answerDecision`. `tool_failure` is a `noAnswerReason` under `answerDecision = no_answer`, not an independent final decision.

### Identity and trust boundary

Backend 001 requires these request headers: `x-actor-id`, `x-organization-id`, `x-host-app`, and `x-role`; `x-request-id` and `x-permission-scopes` are also part of the handoff. The SDK's default Compatibility Mode deliberately omits Frontend 002 Host Context from the body and only performs browser fetches to the configured/same-origin API base.

Therefore the customer host's server-side API gateway or injected authenticated executor must add/validate identity, organization, role, permissions, correlation and stream authorization. Do not put tokens, credentials, raw permission objects, connector metadata, or authorization decisions in the browser-side provider.

## Confirmed frontend handoff surface

```ts
import { AssistantWidget, mountAssistantWidget } from "@ideaxpress/assistant-sdk";
import "@ideaxpress/assistant-sdk/styles.css";
```

- Default mode is `backend001-compatibility`; it must not serialize page/host context into the backend request body.
- `backend002` is fail-closed when required host context is missing, but is not currently verifiable because its backend contract/environment is missing.
- The provider supplies safe host context; `WidgetConfiguration` controls local UI/lifecycle only; callbacks receive minimal safe events.
- Approval callbacks expose IDs only; the host owns navigation and must re-authorize server-side.
- Each widget instance owns isolated local runtime/Pinia state. A shared backend `sessionId` does not authorize or imply shared browser state.

## Gaps and conflicts requiring resolution

| ID | Severity | Finding | Required resolution / owner |
|---|---|---|---|
| INT-001 | Critical | Frontend 002 `spec.md` states that Backend 002 contract files already exist at `specs/002-host-integration-gateway-and-data-adapter-contract/`; they do not exist in this workspace. No public route, exact header/body mapping, SSE additions, or backend capability policy can be checked. | Bring the four Backend 002 Spec Kit artifacts and its public API/SSE contract into this repository, or link their immutable version from the backend repository. Backend owner. |
| INT-002 | High | No customer project or its server/gateway configuration exists here. The SDK cannot prove that `/api/v1/assistant/**` reaches the assistant backend, that CORS/cookies work, or that identity headers are injected. | Provide the customer project path/repository and its development/staging API base or proxy configuration. Customer integration owner. |
| INT-003 | High | Backend 001 mandates identity headers, while default SDK browser fetch does not derive them from the provider (by design). A direct browser-to-backend setup without a trusted gateway will fail or be insecure. | Decide and document one supported deployment: same-origin reverse proxy that injects identity, or injected authenticated executor with a server-owned auth contract. Add an end-to-end smoke test in the customer project. |
| INT-004 | Medium | Backend 002 request construction currently has only frontend assumptions: it prepares a sanitized body with `actorId`, `organizationId`, `hostApp`, `message`, optional session/request ID, and `pageContext`. Without INT-001, that shape may conflict with the real Backend 002 public contract. | Treat this path as gated only; do not deploy/claim host-aware integration until the backend contract locks the exact wire shape and required permission-context handoff. |
| INT-005 | Low | Both task files contain unchecked checklist prose, but no unchecked implementation task IDs remain. | Do not treat those checklist lines as unfinished feature work; use this document for cross-repository acceptance tracking. |

## Customer-host acceptance checklist

Before marking a customer integration ready, record the answer/evidence for each item here.

- [ ] Host imports only the three public SDK entries and supplies the package stylesheet.
- [ ] Host mounts and destroys the widget on route/component teardown.
- [ ] Host gateway routes `/api/v1/assistant/**` to the assistant backend.
- [ ] Gateway authenticates the user and injects/validates actor, organization, host app, role, permission scopes, and request correlation.
- [ ] Session create, history, and SSE stream work with real cookies/headers and no CORS credential leak.
- [ ] The host can show `answered`, clarification, no-answer/tool failure, permission denied, confirmation, approval display, escalation, timeout and interrupted states.
- [ ] Page context/selected rows are sanitized; no raw records, hidden fields, tokens, authority decisions, connector metadata, or hidden prompt content are passed from the browser.
- [ ] Approval-detail callback navigates in the host only after the host/backend re-authorizes access.
- [ ] Backend 002-only: contract version is recorded and a host-aware smoke covers missing-context fail-closed, sanitized context, permission-safe evidence, and final safe outcomes.

## Verification baseline

- `npm run test:contract` passed on 2026-07-27: **25 files, 112 tests**.
- This audit did not change product implementation. The working tree already contained unrelated modified and untracked implementation files before this document was added.

## Update protocol for future chats

1. A frontend or backend chat changes a public behaviour: update its own Spec Kit artifact and this file's source-of-truth map/gap row in the same change.
2. A customer integration chat must read this file first, then add the customer repository/configuration, gateway decision, contract version and smoke-test evidence here.
3. Close an `INT-*` item only with a file link, endpoint/configuration reference, and a repeatable test command or environment evidence.
