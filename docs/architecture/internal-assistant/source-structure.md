# Internal Assistant Source Structure

## Purpose

本文件定義 `001-internal-assistant-embedded-chat-panel` 的暫定 Nuxt 4 production
source structure，並提供 source-root reconciliation 規則，讓後續 Batch B 可以在不誤用
reference UI、不中斷既有 feature documents 的前提下安全初始化專案。

## Target Production Structure

目前 assistant frontend 的 production target 固定以 Nuxt 4 `app/` 慣例為準：

```txt
app/
├── features/
│   └── assistant/
│       ├── components/
│       └── composables/
├── services/
│   ├── index.ts
│   └── api/
│       └── assistant.ts
├── stores/
│   └── assistant/
├── utils/
│   └── assistant/
├── types/
│   └── assistant/
├── pages/
├── layouts/
└── error.vue

tests/
├── unit/
│   └── assistant/
├── component/
│   └── assistant/
├── contract/
│   └── assistant/
└── fixtures/
    ├── assistant-api/
    └── assistant-sse/
```

## Source-Root Reconciliation Rules

### Rule 1: `app/` 是預設 production root

- 後續 implementation MUST 以 `app/` 作為 Nuxt 4 production source root。
- 若 repo 尚未初始化 Nuxt 4，Batch B 才處理 initialization、`app/` 建立與相關
  config baseline。

### Rule 2: 若 repo 已有 source root，先確認是否與 `app/` 對齊

實作前 SHOULD 先檢查是否已存在以下任一結構：

- `app/`
- `src/`
- `client/`
- 其他自定義 frontend root

若已存在既有 source root，必須先回答：

1. 它是否已是 Nuxt 4 可接受的 root？
2. 它是否能承載 `features/assistant/`、`services/`、`stores/`、`utils/`、`types/`
   的分層？
3. 它是否會與 `spec.md` / `design.md` / `plan.md` 的 assistant feature-local 架構
   衝突？

若答案不明確，implementation 前 MUST 先完成 source-root reconciliation，再進入
Batch B 的專案初始化。

### Rule 3: 不做隱性搬移

- 本批文件只定義 target structure，不進行大規模目錄搬移。
- 若未來發現 repo 既有 structure 與 `app/` 不一致，MUST 在實作批次中顯式處理，
  不能一邊寫功能一邊默默搬動 source root。

## Placement Rules

### Assistant feature-local placement

- `app/features/assistant/components/` 是 assistant 專屬 UI 的唯一落點。
- `app/features/assistant/composables/` 是 assistant feature-local orchestration 與
  host adapter composables 的唯一落點。

### Service placement

- `app/services/index.ts` MUST 是唯一 shared HTTP client。
- `app/services/api/assistant.ts` MUST 是唯一 assistant domain service。

### Forbidden placement

以下路徑或做法 MUST NOT 出現在 production source：

- `docs/reference/`
- `app/lib/assistant/`
- `app/components/assistant/cards/`

補充：

- `docs/reference/legacy-chatbot-widget/raw/` 是 UI reference implementation，不是
  production code location。
- `app/components/assistant/cards/` 不符合目前 message renderer / message state
  component 架構。
- `app/lib/assistant/` 不符合目前 `services/` + `utils/` + `stores/` + `features/`
  分層。

## Batch A / Batch B Boundary

### Batch A handles

- source structure target 定義
- source-root reconciliation rules
- module boundary alignment prerequisites
- reference UI boundary prerequisites

### Batch B handles

- Nuxt 4 initialization
- `package.json` baseline
- `nuxt.config.ts`
- `app.config.ts`
- `layouts/default.vue`
- `error.vue`
- `app/` 與 `tests/` 實體目錄建立

## Decision Summary

- production source MUST NOT 放在 `docs/reference/`
- `app/features/assistant/` 是 assistant 專屬 UI / composables 的落點
- `app/services/index.ts` 是唯一 shared HTTP client
- `app/services/api/assistant.ts` 是唯一 assistant domain service
- implementation 前若 source root 不等於 `app/`，MUST 先完成 source-root
  reconciliation
