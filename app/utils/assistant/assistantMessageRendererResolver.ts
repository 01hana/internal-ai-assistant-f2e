import type {
  AssistantRenderableMessage,
  AssistantUiMessage,
  AssistantStreamingUiMessage,
  AnswerDecisionUiState,
  HistoryMessageSummary,
  ResolvedAssistantMessageRenderer,
} from '../../types/assistant'

function isUiMessage(
  message: AssistantRenderableMessage,
): message is AssistantUiMessage {
  return 'kind' in message
}

function isAssistantHistoryMessage(
  message: AssistantRenderableMessage,
): message is HistoryMessageSummary & { role: 'assistant' } {
  return !isUiMessage(message) && message.role === 'assistant'
}

function isCompletedStreamingMessage(
  message: AssistantRenderableMessage,
): message is AssistantStreamingUiMessage & {
  kind: 'assistant_streaming'
} {
  return (
    isUiMessage(message) &&
    message.kind === 'assistant_streaming' &&
    message.status === 'completed' &&
    !!message.finalAnswerDecision
  )
}

function getMessageKey(message: AssistantRenderableMessage): string {
  return isUiMessage(message) ? message.key : message.messageId
}

function getDecisionKind(
  message: AssistantRenderableMessage,
): AnswerDecisionUiState['kind'] | null {
  if (isCompletedStreamingMessage(message)) {
    return message.finalDecisionState?.kind ?? message.finalAnswerDecision ?? null
  }

  if (isAssistantHistoryMessage(message)) {
    return message.answerDecision ?? null
  }

  if (!isUiMessage(message)) {
    return null
  }

  switch (message.kind) {
    case 'clarification':
      return 'clarification_required'
    case 'no_answer':
    case 'tool_failure':
      return 'no_answer'
    case 'permission_denied':
      return 'permission_denied'
    case 'escalation':
      return 'escalation_required'
    default:
      return null
  }
}

function getUnsupportedFallbackKind(
  message: AssistantRenderableMessage,
): ResolvedAssistantMessageRenderer['fallbackKind'] | undefined {
  const decisionKind = getDecisionKind(message)

  if (decisionKind === 'permission_denied') {
    return 'permission_denied'
  }

  if (decisionKind === 'escalation_required') {
    return 'escalation_required'
  }

  if (
    isCompletedStreamingMessage(message) &&
    message.finalDecisionState?.kind === 'no_answer' &&
    message.finalDecisionState.noAnswerReason === 'tool_failure'
  ) {
    return 'tool_failure'
  }

  if (
    isAssistantHistoryMessage(message) &&
    message.answerDecision === 'no_answer' &&
    'noAnswerReason' in message &&
    message.noAnswerReason === 'tool_failure'
  ) {
    return 'tool_failure'
  }

  if (isUiMessage(message) && message.kind === 'tool_failure') {
    return 'tool_failure'
  }

  if (!isUiMessage(message) && message.role === 'system') {
    return 'system'
  }

  return undefined
}

function isToolFailureDecision(
  message: AssistantRenderableMessage,
): boolean {
  if (
    isCompletedStreamingMessage(message) &&
    message.finalDecisionState?.kind === 'no_answer'
  ) {
    return message.finalDecisionState.noAnswerReason === 'tool_failure'
  }

  if (
    isAssistantHistoryMessage(message) &&
    message.answerDecision === 'no_answer' &&
    'noAnswerReason' in message
  ) {
    return message.noAnswerReason === 'tool_failure'
  }

  return isUiMessage(message) && message.kind === 'tool_failure'
}

function createResolvedMessage(
  message: AssistantRenderableMessage,
  overrides: Omit<ResolvedAssistantMessageRenderer, 'key' | 'message'>,
): ResolvedAssistantMessageRenderer {
  return {
    key: getMessageKey(message),
    message,
    ...overrides,
  }
}

export function resolveAssistantMessageRenderer(
  message: AssistantRenderableMessage,
): ResolvedAssistantMessageRenderer {
  if (!isUiMessage(message)) {
    if (message.role === 'user') {
      return createResolvedMessage(message, {
        rendererKind: 'user',
        frameRole: 'user',
        messageTestId: 'assistant-user-message',
        timestampTestId: 'assistant-user-message-time',
        showTimestamp: true,
      })
    }

    if (message.role === 'assistant') {
      const decisionKind = getDecisionKind(message)

      if (decisionKind === 'permission_denied') {
        return createResolvedMessage(message, {
          rendererKind: 'permission_denied',
          frameRole: 'assistant',
          messageTestId: 'assistant-permission-denied-message',
          timestampTestId: 'assistant-permission-denied-time',
          showTimestamp: true,
        })
      }

      if (decisionKind === 'escalation_required') {
        return createResolvedMessage(message, {
          rendererKind: 'escalation',
          frameRole: 'assistant',
          messageTestId: 'assistant-escalation-message',
          timestampTestId: 'assistant-escalation-time',
          showTimestamp: true,
        })
      }

      if (isToolFailureDecision(message)) {
        return createResolvedMessage(message, {
          rendererKind: 'tool_failure',
          frameRole: 'assistant',
          messageTestId: 'assistant-tool-failure-message',
          timestampTestId: 'assistant-tool-failure-time',
          showTimestamp: true,
        })
      }

      if (decisionKind === 'clarification_required') {
        return createResolvedMessage(message, {
          rendererKind: 'clarification',
          frameRole: 'assistant',
          messageTestId: 'assistant-clarification-message',
          timestampTestId: 'assistant-clarification-time',
          showTimestamp: true,
        })
      }

      if (decisionKind === 'confirmation_required') {
        return createResolvedMessage(message, {
          rendererKind: 'confirmation',
          frameRole: 'assistant',
          messageTestId: 'assistant-action-draft-message',
          timestampTestId: 'assistant-action-draft-time',
          showTimestamp: true,
        })
      }

      if (decisionKind === 'no_answer') {
        return createResolvedMessage(message, {
          rendererKind: 'no_answer',
          frameRole: 'assistant',
          messageTestId: 'assistant-no-answer-message',
          timestampTestId: 'assistant-no-answer-time',
          showTimestamp: true,
        })
      }

      return createResolvedMessage(message, {
        rendererKind: 'assistant_answer',
        frameRole: 'assistant',
        messageTestId: 'assistant-ai-message',
        timestampTestId: 'assistant-ai-message-time',
        showTimestamp: true,
      })
    }

    return createResolvedMessage(message, {
      rendererKind: 'unsupported_safe_state',
      frameRole: null,
      messageTestId: 'assistant-unsupported-safe-state',
      showTimestamp: false,
      fallbackKind: 'system',
    })
  }

  switch (message.kind) {
    case 'user':
      return createResolvedMessage(message, {
        rendererKind: 'user',
        frameRole: 'user',
        messageTestId: 'assistant-user-message',
        timestampTestId: 'assistant-user-message-time',
        showTimestamp: true,
      })
    case 'assistant_answer':
      return createResolvedMessage(message, {
        rendererKind: 'assistant_answer',
        frameRole: 'assistant',
        messageTestId: 'assistant-ai-message',
        timestampTestId: 'assistant-ai-message-time',
        showTimestamp: true,
      })
    case 'assistant_streaming':
      if (message.status !== 'completed' || !message.finalAnswerDecision) {
        return createResolvedMessage(message, {
          rendererKind: 'assistant_streaming',
          frameRole: 'assistant',
          messageTestId: 'assistant-streaming-message',
          showTimestamp: false,
        })
      }

      if (message.finalDecisionState?.kind === 'clarification_required') {
        return createResolvedMessage(message, {
          rendererKind: 'clarification',
          frameRole: 'assistant',
          messageTestId: 'assistant-clarification-message',
          timestampTestId: 'assistant-clarification-time',
          showTimestamp: true,
        })
      }

      if ((message.finalDecisionState?.kind ?? message.finalAnswerDecision) === 'confirmation_required') {
        return createResolvedMessage(message, {
          rendererKind: 'confirmation',
          frameRole: 'assistant',
          messageTestId: 'assistant-action-draft-message',
          timestampTestId: 'assistant-action-draft-time',
          showTimestamp: true,
        })
      }

      if (
        message.finalDecisionState?.kind === 'no_answer' &&
        message.finalDecisionState.noAnswerReason !== 'tool_failure'
      ) {
        return createResolvedMessage(message, {
          rendererKind: 'no_answer',
          frameRole: 'assistant',
          messageTestId: 'assistant-no-answer-message',
          timestampTestId: 'assistant-no-answer-time',
          showTimestamp: true,
        })
      }

      if ((message.finalDecisionState?.kind ?? message.finalAnswerDecision) === 'answered') {
        return createResolvedMessage(message, {
          rendererKind: 'assistant_answer',
          frameRole: 'assistant',
          messageTestId: 'assistant-ai-message',
          timestampTestId: 'assistant-ai-message-time',
          showTimestamp: true,
        })
      }

      if ((message.finalDecisionState?.kind ?? message.finalAnswerDecision) === 'permission_denied') {
        return createResolvedMessage(message, {
          rendererKind: 'permission_denied',
          frameRole: 'assistant',
          messageTestId: 'assistant-permission-denied-message',
          timestampTestId: 'assistant-permission-denied-time',
          showTimestamp: true,
        })
      }

      if (isToolFailureDecision(message)) {
        return createResolvedMessage(message, {
          rendererKind: 'tool_failure',
          frameRole: 'assistant',
          messageTestId: 'assistant-tool-failure-message',
          timestampTestId: 'assistant-tool-failure-time',
          showTimestamp: true,
        })
      }

      if ((message.finalDecisionState?.kind ?? message.finalAnswerDecision) === 'escalation_required') {
        return createResolvedMessage(message, {
          rendererKind: 'escalation',
          frameRole: 'assistant',
          messageTestId: 'assistant-escalation-message',
          timestampTestId: 'assistant-escalation-time',
          showTimestamp: true,
        })
      }

      return createResolvedMessage(message, {
        rendererKind: 'unsupported_safe_state',
        frameRole: 'assistant',
        messageTestId: 'assistant-unsupported-safe-state',
        timestampTestId: 'assistant-unsupported-safe-state-time',
        showTimestamp: true,
        fallbackKind: getUnsupportedFallbackKind(message),
      })
    case 'clarification':
      return createResolvedMessage(message, {
        rendererKind: 'clarification',
        frameRole: 'assistant',
        messageTestId: 'assistant-clarification-message',
        timestampTestId: 'assistant-clarification-time',
        showTimestamp: true,
      })
    case 'confirmation':
      return createResolvedMessage(message, {
        rendererKind: 'confirmation',
        frameRole: 'assistant',
        messageTestId: 'assistant-action-draft-message',
        timestampTestId: 'assistant-action-draft-time',
        showTimestamp: true,
      })
    case 'no_answer':
      return createResolvedMessage(message, {
        rendererKind: 'no_answer',
        frameRole: 'assistant',
        messageTestId: 'assistant-no-answer-message',
        timestampTestId: 'assistant-no-answer-time',
        showTimestamp: true,
      })
    case 'permission_denied':
      return createResolvedMessage(message, {
        rendererKind: 'permission_denied',
        frameRole: 'assistant',
        messageTestId: 'assistant-permission-denied-message',
        timestampTestId: 'assistant-permission-denied-time',
        showTimestamp: true,
      })
    case 'tool_failure':
      return createResolvedMessage(message, {
        rendererKind: 'tool_failure',
        frameRole: 'assistant',
        messageTestId: 'assistant-tool-failure-message',
        timestampTestId: 'assistant-tool-failure-time',
        showTimestamp: true,
      })
    case 'escalation':
      return createResolvedMessage(message, {
        rendererKind: 'escalation',
        frameRole: 'assistant',
        messageTestId: 'assistant-escalation-message',
        timestampTestId: 'assistant-escalation-time',
        showTimestamp: true,
      })
    default:
      return createResolvedMessage(message, {
        rendererKind: 'unsupported_safe_state',
        frameRole: message.role === 'assistant' ? 'assistant' : null,
        messageTestId: 'assistant-unsupported-safe-state',
        showTimestamp: false,
        fallbackKind: getUnsupportedFallbackKind(message),
      })
  }
}

export function resolveAssistantMessageRenderers(
  messages: AssistantRenderableMessage[],
): ResolvedAssistantMessageRenderer[] {
  return messages.map(resolveAssistantMessageRenderer)
}
