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

`WidgetConfiguration` 是 local-only 設定，包含 integration mode、launcher、theme、locale、panel placement、sessionScope 等 UI/lifecycle 選項。`sessionScope` 只用於 local namespace，不會序列化成 Backend 001 Compatibility Mode request body。

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

## Troubleshooting

若 widget 無法送出訊息，先確認 host backend 是否提供 Backend 001-compatible same-origin endpoints，且 response content type 是否符合 JSON session/history 與 `text/event-stream` message stream。

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
