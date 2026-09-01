# @ideaxpress/assistant-sdk

`@ideaxpress/assistant-sdk` 是給公司管理的客戶後台／管理系統使用的 productized SDK。它的主要使用者是內部工程團隊，用來把內部 AI Assistant 嵌入客戶管理型產品；它不是公開第三方 SDK，也不是單一內部 app demo。

## Installation

透過 GitHub Packages 安裝套件。請由專案的 npm 設定或 CI secret 提供 registry 存取權限，不要把 token、secret 或 credential 傳進 SDK provider、configuration 或 callbacks。

```bash
npm install @ideaxpress/assistant-sdk
```

## Stylesheet import

只使用公開 root package 與 stylesheet entry：

```ts
import { AssistantWidget, mountAssistantWidget } from "@ideaxpress/assistant-sdk";
import "@ideaxpress/assistant-sdk/styles.css";
```

請不要 deep import runtime、transport、session、context、events、source files，或任何 monorepo 內部路徑。

## Theme token contract

SDK 樣式是 self-contained package stylesheet，不依賴 host Tailwind content scan、`@nuxt/ui`、`@nuxt/icon`、Quasar component CSS 或 deep CSS import。Host app 只要覆寫 `--assistant-sdk-*` CSS variables，就能把自己的 design system token 映射到 SDK。

SDK 會提供 `--assistant-sdk-default-*` fallback；host 請設定 public tokens，不要依賴或覆寫 default tokens。Public tokens 可以放在 mount target、任一 ancestor、`[data-assistant-sdk-root]` 或 `:root`。

```css
#assistant-root {
  --assistant-sdk-accent: var(--color-primary-600);
  --assistant-sdk-accent-foreground: var(--color-primary-contrast);
  --assistant-sdk-background: var(--surface-overlay);
  --assistant-sdk-surface: var(--surface-muted);
  --assistant-sdk-surface-elevated: var(--surface-card);
  --assistant-sdk-foreground: var(--text-primary);
  --assistant-sdk-muted: var(--text-secondary);
  --assistant-sdk-border: var(--border-subtle);
  --assistant-sdk-radius: var(--radius-xl);
  --assistant-sdk-radius-md: var(--radius-lg);
  --assistant-sdk-shadow: var(--shadow-xl);
  --assistant-sdk-button-primary-background: var(--color-primary-600);
  --assistant-sdk-button-primary-foreground: var(--color-primary-contrast);
  --assistant-sdk-input-background: var(--surface-input);
}
```

Nuxt UI host 可映射 Nuxt app token；Quasar host 可映射 Quasar CSS variables。SDK 不 import 這些 framework，也不要求 framework 在 SDK source 上產生 utility classes。

```css
:root {
  /* Nuxt UI-style token mapping */
  --assistant-sdk-accent: var(--ui-primary);
  --assistant-sdk-surface-elevated: var(--ui-bg-elevated);
  --assistant-sdk-border: var(--ui-border);

  /* Quasar-style token mapping */
  --assistant-sdk-danger: var(--q-negative);
  --assistant-sdk-warning: var(--q-warning);
  --assistant-sdk-success: var(--q-positive);
}
```

常用 public tokens 包含 layout (`--assistant-sdk-panel-width`, `--assistant-sdk-panel-height`, `--assistant-sdk-launcher-size`, `--assistant-sdk-gap`)、typography (`--assistant-sdk-font-family`, `--assistant-sdk-font-size`, `--assistant-sdk-line-height`)、radius/spacing/shadow (`--assistant-sdk-radius-*`, `--assistant-sdk-space-*`, `--assistant-sdk-shadow`, `--assistant-sdk-bubble-shadow`)、semantic colors，以及 component-level tokens such as `--assistant-sdk-message-area-background`, `--assistant-sdk-message-bubble-background`, `--assistant-sdk-input-background`, `--assistant-sdk-button-primary-background`, `--assistant-sdk-button-secondary-background`, `--assistant-sdk-button-danger-background`, `--assistant-sdk-safe-outcome-background`, `--assistant-sdk-evidence-background`, `--assistant-sdk-feedback-background`, `--assistant-sdk-action-draft-background`, `--assistant-sdk-approval-request-background`, and `--assistant-sdk-focus-ring`.

## mountAssistantWidget usage

`mountAssistantWidget` 會為每次 mount 建立隔離的 Vue app 與 Pinia runtime scope。呼叫 `destroy()` 或 `unmount()` 會釋放 SDK 建立的 DOM、事件與 runtime 資源。

```ts
import { mountAssistantWidget } from "@ideaxpress/assistant-sdk";
import "@ideaxpress/assistant-sdk/styles.css";

const handle = mountAssistantWidget({
  target: document.querySelector("#assistant-root")!,
  provider: async () => ({
    hostApp: "customer-admin",
    sessionId: "optional-host-session-id",
  }),
  configuration: {
    integrationMode: "backend001-compatibility",
    launcher: { enabled: true },
    sessionScope: "orders-admin",
  },
  callbacks: {
    onAnswerCompleted(event) {
      console.info("Assistant answer completed", event.messageId);
    },
    onError(error) {
      console.warn("Assistant SDK error", error.code, error.userMessage ?? error.message);
    },
    onApprovalDetailRequested(event) {
      console.info("Open approval detail", event.approvalRequestId);
    },
  },
});

handle.open();
handle.close();
handle.destroy();
```

如果同一個 target 已有 active SDK mount，新的 mount 會 fail closed 並回報 duplicate mount diagnostic；請先 `destroy()` 舊 handle 後再重新 mount。

## AssistantWidget usage

Vue host 可以直接使用 component。Consumer 仍只需要安裝 Vue peer dependency；Pinia 是 SDK runtime dependency，不需要由 consumer 初始化。

```vue
<script setup lang="ts">
import { AssistantWidget } from "@ideaxpress/assistant-sdk";
import "@ideaxpress/assistant-sdk/styles.css";

const provider = async () => ({
  hostApp: "customer-admin",
  sessionId: "optional-host-session-id",
});

const configuration = {
  integrationMode: "backend001-compatibility" as const,
  launcher: { enabled: true },
  locale: "zh-TW",
};

const callbacks = {
  onOpened: () => undefined,
  onClosed: () => undefined,
  onError: (error: { code: string; message: string }) => console.warn(error.code),
};
</script>

<template>
  <AssistantWidget
    :provider="provider"
    :configuration="configuration"
    :callbacks="callbacks"
  />
</template>
```

## Provider contract

`provider` 是 request-scoped 的 local integration input。它可以提供 `hostApp`、host-managed `sessionId`、local route/context hints 等 UI/runtime 整合資訊，但這些資訊不是 backend authority，也不代表會進入 Backend 001 request body。

Provider 不應回傳 token、secret、credential、raw permission object、connector credential、raw backend payload、完整客戶資料 dump，或 tenant authorization decision。

## WidgetConfiguration

`WidgetConfiguration` 是 local-only 設定，包含 integration mode、launcher、theme、locale、panel placement、sessionScope 與 `apiBaseUrl` 等 UI/lifecycle 選項。`sessionScope` 只用於 local namespace，不會序列化成 Backend 001 Compatibility Mode request body。

## HostCallbacks / HostEvents

Callbacks 只接收安全、最小化事件 payload，例如 opened、closed、answer-completed、error、approval-detail-requested。Approval detail callback 使用 IDs-only payload；SDK 不產生 approval navigation URL，也不暴露 raw approval payload。

Callback throw 會被隔離，不會中斷 assistant runtime。需要使用 host app navigation 或 audit log 時，請在 host app callback 內自行處理，並遵守後端授權邊界。

## Compatibility Mode

預設 `integrationMode` 是 `backend001-compatibility`。若未提供 injected executor，SDK 會使用 same-origin `globalThis.fetch` 呼叫 Backend 001-compatible endpoints：

```text
POST /api/v1/assistant/sessions
GET /api/v1/assistant/sessions/:sessionId/messages
POST /api/v1/assistant/sessions/:sessionId/messages
```

Compatibility Mode request body 不會序列化 Frontend 002 Host Context。不得送出 `pageContext`、`selectedRows`、`entityType`、`entityId`、`visibleColumns`、`screenId`、`route`、`sessionScope`、`sourceSystem`、connector、permission、authority、token、credential、secret 或 hidden prompt fields。

Authenticated identity headers、organization / actor handoff、request correlation 與 Backend 001 required fields 必須由 host backend、API gateway 或 authenticated transport contract 提供。

## Host Integration Mode

`backend002` / Host Integration Mode 是 gated acceptance path。若缺少正式 contract-backed integration capability，SDK 會 fail closed，不會把 Compatibility Mode 改成模糊的 host-aware request body，也不會自行推論 tenant、permission、connector 或 backend authority。

## Gateway-v1 integration

`gateway-v1` 是 opt-in 的 Gateway integration mode。它使用同一個 `apiBaseUrl` 設定，並由 host 提供 request-scoped 的 upstream access token；全域預設仍是 `backend001-compatibility`。

```ts
import { mountAssistantWidget } from "@ideaxpress/assistant-sdk";
import "@ideaxpress/assistant-sdk/styles.css";

const assistant = mountAssistantWidget({
  target: "#assistant-root",
  provider: async () => ({
    hostApp: "customer-host",
    pageContext: {
      route: window.location.pathname,
      entityType: "order",
      entityId: currentOrderId,
    },
  }),
  getAccessToken: async () => hostAuthStore.accessToken,
  configuration: {
    integrationMode: "gateway-v1",
    apiBaseUrl: "/api/v1",
    sessionScope: "entity",
  },
});
```

`getAccessToken` 提供的是 Host upstream access token。SDK 會在每一個 Gateway request 前重新呼叫 provider，並且只將結果放進 `Authorization: Bearer <token>` header。SDK 不 decode JWT、不讀 claims、不推導 Customer、不建立 Backend internal JWT，也不保存或快取 token。

Gateway 負責驗證 upstream Host identity，依 IntegrationBinding 決定 Customer，並另行為 Backend 建立 internal JWT。Browser 永遠不應取得 Gateway → Backend 的 internal JWT。此 SDK capability ready 不代表任何特定 Customer Host token 已相容；token signing algorithm、issuer、audience、JWKS、Gateway required claims 與 IntegrationBinding provisioning 仍須由實際 Host/Gateway integration 驗證。

### Gateway-v1 HTTP surface

Gateway-v1 正式支援以下四個 Host-facing operations；所有 request 都使用 request-scoped upstream `Authorization`：

| Operation | Method | Route |
| --- | --- | --- |
| createSession | POST | `/api/v1/assistant/sessions` |
| getSession / restore | GET | `/api/v1/assistant/sessions/:sessionId` |
| loadHistory | GET | `/api/v1/assistant/sessions/:sessionId/messages` |
| streamMessage / conversation SSE | POST | `/api/v1/assistant/sessions/:sessionId/messages` |

Gateway-v1 沒有 SDK-owned Gateway ingress for feedback, approval, action confirmation, cancel endpoint，或其他 Shared Runtime operations。SDK 不會 invent route，也不會 fallback 直接呼叫 Backend。

### Gateway-v1 session restore

- 沒有 session candidate 時，widget 建立新 session。
- stored session candidate 會先 remote validate，再載入 history 並 render 既有對話。
- stored candidate 明確得到 404 時，SDK 清除 stale pointer 後建立 fresh session。
- temporary auth、network 或 Gateway/downstream failure 時，SDK 保留 stored pointer 並 fail closed；不會 silent replace conversation。
- Host-provided session candidate 必須 remote validate；任何 validation failure 都不會自動替換 session。
- valid session 的 history 暫時無法載入時，session 仍保持可用，pointer 也會保留。

### Gateway-v1 pageContext and identity boundary

`provider()` 可以供應 `pageContext`、local session namespace context 與 Host UI context。Gateway-v1 的 wire contract 只送出 sanitized page context：

```json
// create
{ "pageContext": {} }

// send
{ "message": "...", "pageContext": {} }
```

Browser context 的 `actorId`、`organizationId`、`hostApp`、`roles`、`permissionScopes`、`customerId` 與 `integrationId` 都不是 trusted Backend authority，且不會被 SDK serialise 到 Gateway-v1 create/send body。Customer authority 只屬於 Gateway IntegrationBinding。

## Session lifecycle

每個 widget instance 維持隔離的 local runtime state。多個 widget 可以顯式指向同一個 backend `sessionId`，但共享 backend session 不等於共享 Pinia/runtime instance。

請在 host component unmount、route teardown、micro-frontend unload 或 target replacement 時呼叫 `destroy()` / `unmount()`，確保 pending request、stream、timer、listener 與 callbacks 被釋放。

## Security boundary

SDK context 不是授權來源。公司、客戶、使用者、role、permission、資料列可見性、connector eligibility、evidence sufficiency 與 action approval authority 都必須由 backend/API gateway 強制執行。

Frontend SDK 只做 local UI/runtime projection、request sanitation、safe callback projection 與 fail-closed guard。它不做 tenant/customer authorization decision，也不應接收可被濫用的 raw authority metadata。

## Forbidden frontend-owned fields

不要把以下資料傳給 SDK provider、configuration 或 callbacks 當作 backend authority：

```text
token
secret
credential
raw permission object
connector credential
sourceSystem authority field
raw backend response payload
full customer database dump
tenant authorization decision
```

如果 host app 需要使用這些資料，請留在 server-side 或 authenticated API gateway，不要放進 browser-side SDK context。

## Backend responsibilities

Host backend/API gateway 必須負責 authentication、organization/customer boundary、actor handoff、permission filtering、audit/correlation、endpoint routing、rate limiting、stream authorization，以及 Backend 001 / Backend 002 contract compatibility。

SDK 不會推論 baseURL、tenant routing 或 backend auth。Same-origin fallback 假設 host app 已經把 `/api/v1/assistant/**` 路由接到正確 backend。

### API endpoint configuration

未設定 `configuration.apiBaseUrl` 時，SDK 會呼叫相對的 `/api/v1/assistant/**`。Frontend app 與一般 host 應將這個 same-origin route 交給自己的 reverse proxy / API gateway 轉送；browser 不需要知道 upstream origin。

```ts
mountAssistantWidget({
  target: "#assistant-root",
  provider,
  configuration: {
    // Same-origin default
    apiBaseUrl: "/api/v1",
  },
});
```

若獨立 package consumer 已有自己的 Gateway endpoint，可由 host/deployment configuration 顯式提供 HTTP(S) `apiBaseUrl`，例如 `http://localhost:4000/api/v1` 用於 local direct Gateway integration。此值只能是 endpoint；不要放入 token、credential、tenant 或 permission data。不要新增 `gatewayUrl`、`backendUrl` 或 `gatewayBaseUrl`；也不要把 Backend `localhost:3000` 當作 Gateway-v1 browser target。

## Troubleshooting

若 widget 無法送出訊息，先確認 host/deployment 已將 same-origin `/api/v1/assistant/**` 端點路由到正確服務，且 response content type 是否符合 JSON session/history 與 `text/event-stream` message stream。

若 duplicate mount error 發生，表示同一個 target 已有 active widget。請呼叫舊 handle 的 `destroy()`，或使用不同 target。

若 callback 未觸發，確認 callback payload 是否是 SDK 支援的 minimal event。SDK 不會傳 raw approval payload、permission snapshot、connector metadata 或 navigation URL。

## Version compatibility

目前 package version 是 `0.1.0`。Vue 是 peer dependency；Pinia 是 SDK regular runtime dependency；Nuxt 是 optional peer for Nuxt host compatibility，不是必要 runtime dependency。

## GitHub Packages install notes

此 package 預期透過 GitHub Packages restricted registry 發佈：

```text
@internal-ai-assistant:registry=https://npm.pkg.github.com
```

請由 npm、CI 或 GitHub Packages 設定管理 registry authentication。不要把 registry token 傳進 SDK runtime。

## Release notes

`0.1.0`：完成 productized AssistantWidget、isolated `mountAssistantWidget`、Backend 001 Compatibility Mode packaged chat flow、root + stylesheet public package boundary、Shared Canonical Assistant Runtime bundling，以及 final release readiness guardrails。
