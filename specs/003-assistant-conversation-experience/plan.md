# Plan: Assistant Conversation Experience（前端）

## 原則

- Test-first：每個 Phase 先寫測試（RED），再實作。
- 每個 Phase 結束有 Gate：`npm run typecheck`、`npm run lint`、相關測試；使用者執行全套 `npm test` 後記錄 `FRONTEND003_GATE_n=PASS`。
- 新欄位皆為選用；既有測試的預期值不修改，若必須修改需先說明並經使用者同意。
- 使用者手動 commit／push；Claude 只 stage 並提供 commit message。

## Phase

| Phase | 內容 | 對應 |
| --- | --- | --- |
| 0 | 基線：記錄目前 `npm test`／typecheck／lint 結果；更新 `docs/contracts/backend-assistant-core` 加入 Feature 013 規格 | — |
| 1 | 契約與資料層：型別、SSE suggestions、choice 請求、transport 列表／封存、bootstrap 空 session 改建 | FR-001～FR-005 |
| 2 | 開場與建議 UI：greeting、Quick Reply、建議、點擊、404 提示 | US1、US2 |
| 3 | 對話紀錄：列表畫面、分頁、還原、兩段式封存 | US3、US4 |
| 4 | 驗收與交付：整合測試、SDK 0.2.0、文件、package 驗證；之後替換 Shinmone 前端（需連接該 repo） | SC-001～SC-005 |

## 本機驗證

後端本機環境需要一份體驗設定才能看到開場與選項：Phase 2 前在後端 repo 準備本機設定（不進客戶正式設定），以 `npm run assistant-experience:provision -- --file <檔案> --allow-unverified` 寫入本機資料庫。
