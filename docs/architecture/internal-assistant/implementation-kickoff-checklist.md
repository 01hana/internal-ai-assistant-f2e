# Implementation Kickoff Checklist

後續每一批開始前，MUST 先確認以下事項：

- [ ] source root 已確認
- [ ] Nuxt 4 `app/` 結構已確認
- [ ] `app/features/assistant/` production target 已確認
- [ ] `app/services/index.ts` 已確認為唯一 HTTP client
- [ ] `app/services/api/assistant.ts` 已確認為唯一 assistant service
- [ ] backend contract handoff 文件存在
- [ ] reference UI 僅作為參考
- [ ] 沒有 import / copy / move reference UI files
- [ ] 沒有引入 public chatbot semantics
- [ ] 沒有新增 backend / connector / RAG / LLM / approval management scope
- [ ] 沒有 `app/lib/assistant/`
- [ ] 沒有 `app/components/assistant/cards/`
- [ ] test / fixture directory strategy 已確認
