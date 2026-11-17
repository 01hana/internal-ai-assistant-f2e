# Feature Specification: Assistant Conversation Experience（前端）

**Feature Branch**: `003-assistant-conversation-experience`
**Created**: 2026-11-16
**Status**: Draft
**Backend**: `internal-ai-assistant.com` Feature 013（已完成，Gate 7 PASS）；API 規格見該 repo `docs/frontend-integration/assistant-conversation-experience.md`

## 背景

後端 Feature 013 已提供：開場問候與 Quick Reply、點擊選項（`choiceId`）、回答後的建議（`final.suggestions`）、對話紀錄列表（`GET /sessions`）與封存（`POST /sessions/:id/archive`）。目前 SDK 與共用 runtime 會丟掉這些欄位，也沒有對應畫面：

- `AssistantSession` 型別沒有 `opening`，建立 session 的回應中問候與選項被忽略。
- SSE `final` 的型別與驗證不含 `suggestions`。
- 送訊息的輸入必須有 `message`，無法送 `choiceId`。
- 傳輸層只有建立、讀取、歷史訊息、送訊息等路由，沒有列表與封存。

## 範圍

- **包含**：`packages/assistant-runtime`（型別、SSE、狀態、聊天面板 UI）與 `packages/assistant-sdk`（傳輸層、session bootstrap、`AssistantWidget`）。`gateway-v1` 與 `backend001-compatibility` 兩種模式都支援。
- **不包含**：Frontend 001 Nuxt adapter（`app/`）的新畫面（型別新增欄位皆為選用，既有測試須維持通過）；後台；回饋功能變更；重新命名對話；Shinmone 前端 repo 的替換（Phase 4 另行進行，需要時再連接該 repo）。
- **不新增 SDK 公開 API**：`AssistantWidget`、`mountAssistantWidget`、provider、configuration、callbacks 的介面不變；新功能在 transport 支援時自動啟用。

## User Stories

### US1 開場問候與 Quick Reply（P1）

開啟助理建立新對話時，面板顯示客戶設定的問候語與可點的 Quick Reply。

1. **Given** 建立 session 的回應含 `opening`，**then** 以 `greeting` 顯示第一則助理訊息，下方顯示 `quickReplies` 按鈕；`quickReplies` 為空時不顯示按鈕區。
2. **Given** 回應沒有 `opening`（舊後端），**then** 行為與現在相同。
3. 還原既有 session（host 指定或 `sessionScope` 為 `entity`／`page` 時的本機指標）不顯示開場，行為與現在相同（見 Decision 4）。
4. 問候不是後端訊息，重新整理或還原既有對話時不會出現。
5. 按「重新開始」建立的新對話同樣顯示開場。

### US2 點擊選項與回答後建議（P1）

1. **Given** 使用者點擊 Quick Reply 或建議，**then** 面板先以按鈕 `label` 顯示使用者訊息，送出 `{ choiceId, pageContext }`（不送 `message`），之後的串流處理與手打問題相同。
2. **Given** `final.suggestions` 有值，**then** 顯示在該則回答下方；使用者送出下一則訊息（手打或點擊）後，所有舊的建議與 Quick Reply 隱藏。
3. **Given** `suggestions` 格式不正確，**then** 忽略該欄位，回答照常顯示，不視為串流錯誤。
4. **Given** 點擊後回 404，**then** 移除該選項，在該則使用者訊息位置顯示「這個選項目前無法使用，請直接輸入問題。」，不重置對話。
5. 串流進行中，選項按鈕停用。
6. 還原的歷史訊息不帶建議。

### US3 對話紀錄（P2）

1. **Given** transport 支援列表，**then** 面板標題列顯示「對話紀錄」按鈕；點擊後面板內切換為列表畫面，再點「返回」回到對話。
2. 列表顯示每筆的 `title`（`null` 時顯示「未命名對話」）與 `lastMessageAt`（相對或簡短日期），依後端順序；目前對話標示為「目前對話」。
3. 有 `nextCursor` 時顯示「載入更多」，cursor 原樣帶回。
4. **Given** 點擊某筆，**then** 切回對話畫面並還原該 session（`getSession` + `loadHistory`），更新本機 session 指標，發出既有 `session-changed` 事件。
5. 列表載入中、空白（「還沒有對話紀錄」）、失敗（可重試）都有狀態。
6. 每次進入列表都重新載入，不快取。

### US4 封存對話（P2）

1. 列表每筆有「封存」，點擊後同一列改為「確定封存？」與「取消」（不使用瀏覽器 confirm）。
2. 確定後呼叫封存；成功則從列表移除。
3. **Given** 封存的是目前對話，**then** 同時清除本機 session 指標，回到對話畫面時建立新對話（顯示開場）。
4. 封存回 404（已封存或不存在）視為成功並移除該筆；其他錯誤在該列顯示失敗訊息，可重試。

## Functional Requirements

- **FR-001**：runtime 型別新增 `AssistantOpening { configVersion: string | null; greeting: string; quickReplies: AssistantChoice[] }`、`AssistantChoice { id; label }`；`AssistantSession.opening?`、`AssistantMessageFinalData.suggestions?`。
- **FR-002**：SSE `final` 驗證接受選用 `suggestions`；只保留 `id`、`label` 皆為非空字串的項目，整個欄位不合法時捨棄。
- **FR-003**：送訊息輸入為 `message` 與 `choiceId` 二選一；request builder 與 request safety 檢查不得同時帶兩者。
- **FR-004**：transport port 新增選用 capability `listSessions(input: { limit?; cursor? })`、`archiveSession(input: { sessionId })`，以及（後端 Feature 013 Phase 8）`listSessions` 的 `status?: "archived"`、選用 `unarchiveSession(input: { sessionId })`（POST `/sessions/:id/unarchive`）與 `deleteSession(input: { sessionId })`（DELETE `/sessions/:id`）；`defaultTransport` 兩種模式皆實作，gateway-v1 路由白名單一併加入。
- **FR-005**：列表與封存不得把 provider context、page context 或 credential 以外的資料放入請求；gateway-v1 照舊只用 `Authorization` header。
- **FR-006**：文字一律為繁體中文，按鈕有 `aria-label`，列表可用鍵盤操作；手機全螢幕面板可用。
- **FR-007**：SDK 版本 `0.2.0`；`docs/contracts/backend-assistant-core` 與 `docs/integration-status.md` 更新。

## Success Criteria

- **SC-001**：新對話顯示問候與 Quick Reply；點擊送出的請求只有 `choiceId` 與 `pageContext`（契約測試驗證）。
- **SC-002**：舊後端回應（無 `opening`、無 `suggestions`）下所有既有測試通過，行為不變。
- **SC-003**：建議只出現在最新一則回答，送出下一則後隱藏（元件測試）。
- **SC-004**：列表分頁、還原、封存目前／非目前對話皆有元件或整合測試。
- **SC-005**：`npm test`、`npm run typecheck`、`npm run lint`、SDK build 與 package 驗證通過。

## Decisions

1. 問候為前端本地訊息（新 kind），不寫入後端歷史。
2. 點擊選項的使用者訊息顯示 `label`；後端存的是設定中的完整問句，之後讀歷史時文字可能不同，屬預期。
3. 點擊回 404 時視為選項失效，而非 session 遺失（session 剛建立或剛使用過）；真的遺失時，下一次手打訊息會照既有流程處理。
4. ~~沒有訊息的還原 session 改建新 session~~（2026-11-16 實作時撤回）：SDK 只在 `sessionScope` 為 `entity`／`page` 時保存 session 指標，nuxt-gateway 範本（Shinmone）用自訂字串，不會從儲存還原，每次載入頁面都建立新 session 並顯示開場；只為 entity／page 的少數情境改變還原行為，還會打破既有 bootstrap 測試，不值得。
5. 對話紀錄按鈕只在 transport 提供 `listSessions` 時顯示；不新增設定開關。
