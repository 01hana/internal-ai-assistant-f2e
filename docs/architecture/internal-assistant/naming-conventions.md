# Naming Conventions

## Purpose

本文件固定 Internal Assistant Embedded Chat Panel 的 production naming strategy，
避免後續實作重新引入 public chatbot 命名、card layer 命名、或不一致的 service 名稱。

## Reference-Aligned Component Names

UI component names 優先使用以下 production names：

- `ChatWidget`
- `ChatPanel`
- `ChatMessageArea`
- `ChatInputBar`
- `UserMessageItem`
- `AiStreamingItem`
- `AiMessageItem`
- `ClarificationMessage`
- `NoAnswerMessage`
- `PermissionDeniedMessage`
- `ToolFailureMessage`
- `EscalationMessage`
- `ActionDraftConfirmationMessage`
- `ApprovalRequestDisplayMessage`
- `SessionRecoveryMessage`
- `DegradedMessage`
- `InterruptedMessage`

## Assistant-Specific Logic Names

assistant-specific logic names 固定使用：

- `AssistantHostContextProvider`
- `useAssistantSession`
- `useAssistantSseStream`
- `useAssistantHostContext`
- `useAssistantHostContextAdapter`
- `useChat`
- `assistantSseParser`
- `AssistantService`
- assistant contract types

## Naming Intent

- UI shell / message / input 優先沿用 reference-aligned component names
- 核心邏輯固定使用 assistant-specific naming
- 命名不得混入 public chatbot / customer service 語意

## Forbidden Names and Patterns

以下命名或結構明確禁止：

1. `createChatClient`
2. `createAssistantClient`
3. `app/lib/assistant/`
4. `app/components/assistant/cards/`
5. public chatbot / customer service naming
6. `tool_failed` 作為 final state

## Additional Naming Rules

- Approval UI 一律使用 `ApprovalRequestDisplayMessage`，不得命名成可 inline approve
  的 component。
- Action draft UI 一律使用 `ActionDraftConfirmationMessage`，不得暗示 side-effect 已執行。
- degraded / interrupted UI 必須用 `DegradedMessage`、`InterruptedMessage`，不要回退到
  generic error card 命名。
- assistant service 一律集中在 `AssistantService`，不要再拆出 `createChatClient`、
  `createAssistantClient` 或其他平行 client。
