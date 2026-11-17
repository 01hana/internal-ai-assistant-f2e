# Assistant API Contract Handoff

這份文件是前端整合用的 backend contract handoff，描述目前 `001-internal-assistant-core` 已完成且被測試鎖住的 assistant-facing API surface。它不是 runtime source of truth；若文件與 contract / integration tests 衝突，以測試鎖定的外部行為為準。

## Base path, headers, and envelopes

所有主要 assistant API 目前都在 `/api/v1` 之下。

前端整合時應固定帶：

- `x-request-id`
- `x-actor-id`
- `x-organization-id`
- `x-host-app`
- `x-role`
- `x-permission-scopes`

`x-request-id` 若未提供，backend 仍會補出 request id；但前端若要追 SSE、support trace、feedback linkage 與 review linkage，建議自行產生並全程傳遞。

所有 REST success response 都沿用：

```json
{
  "requestId": "req-001",
  "data": {}
}
```

所有 REST error response 都沿用：

```json
{
  "requestId": "req-001",
  "error": {
    "code": "forbidden",
    "message": "Access denied",
    "statusCode": 403
  }
}
```

SSE event payload 也必須可用 `requestId`、`sessionId`、`messageId` 做 correlation。

## Main assistant flows

目前 assistant message 主流程會在 `POST /api/v1/assistant/sessions/:sessionId/messages` 依 routing 回不同最終決策：

- `answered`
- `clarification_required`
- `no_answer`
- `permission_denied`
- `confirmation_required`
- `approval_required`
- `escalation_required`

前端應把 `final.data.answerDecision` 視為單一可靠 decision source，不要自己從中間 SSE event 猜測最終狀態。

### Live structured data

像 `SO-10001` 訂單狀態、`SKU-ABC-001` 庫存、`WO-20002` 進度這類 live business data 仍走 connector/tool path。正常 answered flow 會附帶 `structured_record` evidence summary。

### Document knowledge

像 SOP、policy、field explanation、manual、error code explanation 這類文件型問題走 retrieval/document path。正常 answered flow 會附帶 `document_chunk` evidence summary，不應期待 `tool_call_*` 事件。

### Safe no-answer / clarification

當 query 模糊、缺 page context、permission denied、tool failure、evidence conflict、或找不到 evidence 時，backend 不應編造答案。前端應直接依 `answerDecision` 與 `noAnswerReason` 呈現安全 fallback UX，而不是再自行補判斷。

`tool_failure` 是 `NoAnswerReason`，不是獨立的 `AnswerDecisionStatus`。若要顯示 tool failure UI，應判斷：

```ts
final.data.answerDecision === 'no_answer' &&
final.data.noAnswerReason === 'tool_failure'
```

`permission_denied` 仍可作為 top-level `AnswerDecisionStatus`；部分 safe failure 文案也可能帶 `noAnswerReason: 'permission_denied'`，前端不應自行發明 `tool_failed` 之類的新 final state。

## Session restore and history

這份 handoff 以以下 surface 為主：

- `POST /api/v1/assistant/sessions`
- `GET /api/v1/assistant/sessions/:sessionId`
- `GET /api/v1/assistant/sessions/:sessionId/messages`
- `POST /api/v1/assistant/sessions/:sessionId/messages`

`GET /api/v1/assistant/sessions/:sessionId/messages` 是目前已被 controller / contract / integration tests 鎖住的 external contract。前端在 session restore 時，應把它視為 session message history retrieval。

### History pagination

目前 public query contract：

- `limit?: number`
- `cursor?: string`
- `order?: 'asc'`

範例：

```http
GET /api/v1/assistant/sessions/session-001/messages?limit=30&cursor=msg-001&order=asc
```

目前 runtime 只公開 `order=asc`。`desc` 不是現行 public contract，若未來 chat panel 需要 reverse loading，應先更新 backend contract 與 handoff。

### History response shape

history retrieval 僅保證回傳 masked summary。前端不要假設 history 會包含 raw tool output、raw evidence payload、full document text 或未授權欄位。

目前 wire shape 可視為：

```ts
type SessionMessagesResponse = {
  sessionId: string;
  messages: HistoryMessageSummary[];
  nextCursor: string | null;
};
```

前端應以 `nextCursor !== null` 視為「仍可載入更多 history」，不要自行期待 `hasMore` response field。

目前 history item 至少可依賴：

- `messageId`
- `role`
- `content`
- `createdAt`

assistant messages 另外可能帶：

- `answerDecision`
- `evidenceRefs`
- `toolSummary`

invalid / unusable cursor、不可見 session、跨 actor / host app / organization boundary 的 history read，都應走共用 error envelope。

## Request context mapping

目前 session create 與 message send request contract 對前端公開的是 `pageContext`。此 DTO 已支援：

- `module`
- `route`
- `screenId`
- `entityType`
- `entityId`
- `selectedRows`
- `activeFilters`
- `visibleColumns`
- `userVisibleState`

frontend host adapters 可以從宿主狀態蒐集更完整的 `activeFilters`，但送往 backend 時只應傳 sanitized、visible、non-secret summary。不要把 raw row payload、hidden columns、secret fields 或完整 table state 直接送出。

若前端內部還有 `screenContext.filtersSummary` 這種概念，應把它視為 host-side abstraction，不是目前 session/message request 的 public wire contract。對目前 backend contract，sanitized filter context 應走 `pageContext.activeFilters`。

## Feedback and review linkage

使用者側可透過：

- `POST /api/v1/assistant/messages/:messageId/feedback`

提交 feedback。positive feedback 只建立 feedback record；negative / actionable feedback 可能建立或連結 review item，但 review 管理 API 不在這份 assistant-facing handoff 主體內。

## ActionDraft and ApprovalRequest

### ActionDraft

medium-risk side-effect request 目前會停在 confirmation gate：

- `GET /api/v1/assistant/action-drafts/:actionDraftId`
- `POST /api/v1/assistant/action-drafts/:actionDraftId/confirm`
- `POST /api/v1/assistant/action-drafts/:actionDraftId/cancel`

`confirm` 的 `recheck` 欄位目前是 MVP semantics。只有 boundary/status/freshness 是已完成檢查；`permission` 和 `toolContract` 仍會以 `pending_execution_guard` 表達，前端不應把它顯示成 side-effect 已安全完成。

### ApprovalRequest

high-risk side-effect request 目前會停在 approval gate：

- `GET /api/v1/assistant/approval-requests`
- `GET /api/v1/assistant/approval-requests/:approvalRequestId`
- `POST /api/v1/assistant/approval-requests/:approvalRequestId/approve`
- `POST /api/v1/assistant/approval-requests/:approvalRequestId/reject`
- `POST /api/v1/assistant/approval-requests/:approvalRequestId/cancel`

For `001-internal-assistant-embedded-chat-panel`:

- Use ApprovalRequest detail/status for display only.
- Do not implement approve/reject/cancel UI in this feature.
- Approval operation endpoints are documented for backend completeness and future approval-management feature specs.
- Chat panel may provide an open-detail callback so the host app can open approval detail page.
- Inline approve/reject would require a future independent spec and backend-provided authorization fields; those fields are not part of the current handoff.

`approval_required` SSE 對 `001` 前端只需要 status card / action summary / risk level / open detail callback，不代表 side-effect 已完成。

## Conversation experience（Backend Feature 013）

來源：後端 repo `internal-ai-assistant.com` 的 `docs/frontend-integration/assistant-conversation-experience.md`（Core 013 以上；Gateway 需同步更新）。全部為新增欄位或新端點，舊後端不會回這些欄位。

| 端點 | 變更 |
| --- | --- |
| `POST /assistant/sessions` | `data.opening = { configVersion: string \| null, greeting, quickReplies: [{ id, label }] }`；選項已依使用者權限與 `pageContext.module` 篩選 |
| `POST /assistant/sessions/:id/messages` | body 為 `message` 與 `choiceId` 二選一；`choiceId` 不存在、已不在設定中或無權限 → 404（與 session 不存在相同） |
| SSE `final` | `data.suggestions?: [{ id, label }]`，只在有值時出現：成功回答後的延伸建議、能力總覽、無法辨識問題時的可用選項 |
| `GET /assistant/sessions?limit&cursor` | 使用者自己、至少有一則訊息、未封存的 session，依 `lastMessageAt` 由新到舊；`{ sessions: [{ sessionId, title, createdAt, lastMessageAt }], nextCursor }`；`limit` 1–50（預設 20）；cursor 不透明，原樣帶回；不合法回 400 |
| `POST /assistant/sessions/:id/archive` | 無 body、無 query；回 `{ sessionId, status: "closed" }`；之後讀取與送訊息回 404；不存在、他人或已封存回 404 |
| `GET /assistant/sessions?status=archived` | （Phase 8）列出已封存的 session，格式與分頁同上；`status` 只接受 `archived`，其他值回 400 |
| `POST /assistant/sessions/:id/unarchive` | （Phase 8）無 body、無 query；回 `{ sessionId, status: "active" }`，回到一般列表；不存在、他人或未封存回 404 |
| `DELETE /assistant/sessions/:id` | （Phase 8）無 body、無 query；回 `{ sessionId, status: "deleted" }`；使用者端永久移除（不再列出、讀取與送訊息回 404），後端保留資料供稽核；一般與已封存的 session 皆可刪除；不存在、他人或已刪除回 404 |

前端規則：

- 只顯示伺服器給的選項，不寫死、不快取；問候與選項的文字來自各客戶設定，前端程式對所有客戶相同。
- 點擊選項時送 `{ choiceId, pageContext }`，不送 `message`；後端把設定中的完整問句存為使用者訊息，之後讀歷史時文字可能與按鈕 `label` 不同。
- 建議只顯示在最新一則回答；歷史訊息不帶建議；還原既有 session 不會有 `opening`。
- `title` 可能為 `null`。

## Out of this handoff

這份 handoff 不以以下 surface 為主：

- `health` / `readiness`
- admin review APIs
- internal observability endpoints
- persistence model 細節
- raw audit / review / retrieval internals

若後續 frontend 需要 admin review 或 observability 整合，建議另出 admin-facing handoff，避免 assistant-facing contract 和 internal operations contract 混在一起。
