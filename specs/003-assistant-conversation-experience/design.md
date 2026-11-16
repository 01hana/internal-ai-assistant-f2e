# Design: Assistant Conversation Experience（前端）

## 1. 資料流

```text
開啟助理 ─ sessionBootstrap ─ transport.createSession ─→ session.opening
                                                     └→ runtime 加入 greeting 本地訊息 + Quick Reply
點擊選項 ─ AssistantWidget.sendChoice ─ startMessageStream({ choiceId, pageContext, sessionId })
                                     └→ SSE final.suggestions → 最新回答的建議
對話紀錄 ─ 面板 view = "history" ─ transport.listSessions / archiveSession
          └→ 點擊 → sessionBootstrap.restore(sessionId) → getSession + loadHistory
```

## 2. 各層變更

### 2.1 Runtime 型別與 SSE（`packages/assistant-runtime/src/types`, `sse`）

| 項目 | 變更 |
| --- | --- |
| `AssistantChoice`、`AssistantOpening` | 新增；`AssistantSession.opening?: AssistantOpening` |
| `AssistantMessageFinalData.suggestions?` | 新增 |
| SSE `final` 驗證 | 不因 `suggestions` 失敗；正規化時只保留合法項目（`normalizeChoices`），全部不合法則省略欄位 |
| 送訊息輸入 | `AssistantRuntimeSendMessageInput` 改為 `{ sessionId?; pageContext? } & ({ message: string; choiceId?: never } \| { choiceId: string; message?: never })` |
| Transport port | 新增 `AssistantRuntimeSessionHistoryCapability { listSessions; archiveSession }` 與 `supportsAssistantRuntimeSessionHistory()`，作法比照 `RemoteRestorationCapability` |

### 2.2 Runtime 狀態與 controller（`stores`, `runtime`, `session`）

- session 狀態新增 `opening`（只在 `createSession` 成功時設定；`setSession` 於還原時清除）與 `pendingChoiceIds`（點擊中，避免重複點）。
- 新的本地訊息 kind `assistant_greeting`：`{ key: "local-greeting:<sessionId>", kind, role: "assistant", content: greeting }`。`createSession` 成功且有 `greeting` 時放在訊息列表最前面。
- 「最新的建議」為推導值：最後一則助理訊息（greeting 或已完成的回答）的 choices；Quick Reply 掛在 greeting，`suggestions` 掛在 finalize 後的回答。最後一則訊息不是助理訊息、或串流進行中時，不顯示任何選項。這讓「送出下一則就隱藏」不需要額外狀態。
- `finalizeActiveStreamingMessage` 把 `final.suggestions` 存進該訊息。
- choice 失效：`markChoiceUnavailable(choiceId, userMessageKey)` 從所有訊息的 choices 移除該 ID，並在該使用者訊息加上 `notice`。

### 2.3 聊天面板 UI（`components/product-ui`）

- `AssistantProductPanelShell`：標題列新增「對話紀錄」按鈕（`historyAvailable` prop 控制；`history` emit），列表畫面時改為「返回」。
- `AssistantProductRuntimePanel`：
  - greeting 以助理訊息樣式顯示，不顯示回饋按鈕與資料來源。
  - 選項列：`role="group" aria-label="建議問題"`，按鈕為 chip 樣式，可換行；`choose` emit `{ choiceId, label }`。
  - 使用者訊息的 `notice` 顯示為次要提示文字。
- 新增 `AssistantProductSessionList.vue`：列表、載入更多、空白／錯誤／載入狀態、每列封存的兩段式確認；emit `open(sessionId)`、`archive(sessionId)`、`load-more`、`retry`、`back`。純顯示元件，資料由 SDK widget 提供。
- 樣式沿用 `--assistant-sdk-*` tokens，不新增必要 token。

### 2.4 SDK（`packages/assistant-sdk/src`）

| 檔案 | 變更 |
| --- | --- |
| `transport/defaultTransport.ts` | `createSession` 回傳保留 `opening`（驗證形狀，不合法則省略）；`streamMessage` body 支援 `choiceId`；新增 `listSessions`（GET `/assistant/sessions?limit&cursor`）與 `archiveSession`（POST `/assistant/sessions/:id/archive`，無 body）；gateway-v1 路由白名單加入兩者；404 → `session_not_found`（沿用） |
| `request/requestBuilder.ts`, `requestSafety.ts`, `outgoingRequestBoundary.ts` | 允許 `choiceId`（格式 `^[a-z0-9][a-z0-9._-]{0,63}$`），拒絕同時帶 `message` 與 `choiceId` |
| `runtime/sdkRuntimeAdapter.ts` | `startMessageStream` 接受 choice 輸入；choice 請求得到 `session_not_found` 時回報 `choice_unavailable` 給 widget，而非 session 錯誤 |
| `session/sessionBootstrap.ts` | 新增 `restoreSession(sessionId, { beforeApply })` 供列表點擊：先 `getSession` 驗證，成功才呼叫 `beforeApply`（由 widget 清空目前對話）、載入歷史、更新本機指標並發出 `session-changed`；失敗時目前對話不變。新增 `forgetStoredSession()` 供封存目前對話後使用。還原行為其餘不變（spec Decision 4） |
| `components/AssistantWidget.vue` | `sendChoice({ choiceId, label })`；`view: "chat" \| "history"`；列表資料（分頁、載入、錯誤、封存中）只存在 widget 本地狀態；封存目前對話時清除指標並在返回時重新 bootstrap |

## 3. 錯誤處理

| 情境 | 處理 |
| --- | --- |
| `opening` / `suggestions` 格式錯誤 | 忽略欄位，不報錯 |
| 點擊選項回 404 | 移除選項 + 提示，不重置對話 |
| 列表失敗 | 列表內錯誤狀態 + 重試；對話畫面不受影響 |
| 列表 400（cursor 失效） | 重新從第一頁載入一次；再失敗顯示錯誤 |
| 封存 404 | 視為已封存，移除該列 |
| 還原列表中的對話失敗 | 留在列表、顯示錯誤，目前對話不變 |

## 4. 相容性

- 舊後端：沒有 `opening`、`suggestions` 時畫面與現在相同；列表端點不存在時（404／503）在列表畫面顯示錯誤，不影響對話。
- 自訂 transport 沒有 `listSessions` 時不顯示「對話紀錄」按鈕。
- Frontend 001 Nuxt adapter 只受型別新增選用欄位影響，不改其畫面。

## 5. 測試

- unit：SSE `final` suggestions 正規化、choice request 安全檢查、transport 新路由（兩種模式）、bootstrap 空 session 改建、最新建議推導。
- component：greeting + Quick Reply、點擊後隱藏、404 提示、列表四種狀態、兩段式封存、標題列按鈕顯示條件。
- contract：請求 body／路徑符合後端 013 規格；舊回應相容。
- integration：widget 走完開場 → 點擊 → 建議 → 列表 → 還原 → 封存目前對話。
- e2e（選用）：手機寬度下列表與返回。
