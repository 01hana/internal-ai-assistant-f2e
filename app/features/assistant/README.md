# Assistant Feature Root

本目錄保留 Internal Assistant Embedded Chat Panel 的 feature-local UI 與 composables。

- assistant widget 專屬 UI / composables 放這裡
- reference UI 不得 import / copy / move
- API contract 以 backend assistant handoff 為準
- Phase 1 之後才開始填入 types / services / composables / components
- 本地 baseline 初始化後，先執行 `npm run prepare` 生成 Nuxt 型別環境，再進行 `typecheck` 或後續實作
