/**
 * useChat (T-027)
 *
 * Manages the message list and orchestrates the send → stream → finalise flow.
 *
 * sendMessage(text) flow:
 *   1. Append UserMessageItem to messages
 *   2. Append empty AiStreamingItem (type='ai-streaming') to messages
 *   3. Call useStreaming.startStreaming(text)
 *      — useStreaming appends each token into the last 'ai-streaming' message
 *      — useStreaming.onDone flips type to 'ai' (done in the composable)
 *   4. On terminal states (error/timeout/interrupted/cancelled):
 *      replace last 'ai-streaming' message with the corresponding system item
 *
 * clearMessages() — wipe store messages array
 */

import type { ChatMessageVM, FeedbackValue } from '~/types/chat';


export function useChat() {
  const sessionStore = useChatSessionStore();
  const { startStreaming, cancelStreaming, streamingState } = useStreaming();

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _now(): string {
    return new Date().toISOString();
  }

  function _makeId(): string {
    return crypto.randomUUID();
  }

  // Watch terminal streaming states to replace the placeholder ai-streaming item
  watch(streamingState, state => {
    const last = sessionStore.messages.at(-1);
    if (!last || last.type !== 'ai-streaming') return;

    if (state === 'cancelled') {
      // User-initiated cancel: remove the empty placeholder silently
      sessionStore.messages.pop();
      return;
    }

    const terminalTypeMap: Partial<Record<typeof state, ChatMessageVM['type']>> = {
      error: 'system-error',
      timeout: 'system-timeout',
      interrupted: 'system-error',
    };

    const systemType = terminalTypeMap[state];
    if (systemType) {
      last.type = systemType;
      last.content = ''; // component will show i18n text
    }
    // 'completed' is handled inside useStreaming (flips to 'ai' directly)
  });

  // ── Public: sendMessage ───────────────────────────────────────────────────

  /**
   * Append the user bubble, create the AI streaming placeholder, then kick
   * off the streaming pipeline.
   *
   * TODO: 串接後台 API 後，移除 kbStore.query 分支，全部走 startStreaming。
   */
  async function sendMessage(text: string): Promise<void> {
    if (!text.trim()) return;

    // 1. User message
    const userMsg: ChatMessageVM = {
      id: _makeId(),
      type: 'user',
      content: text.trim(),
      timestamp: _now(),
    };
    sessionStore.appendMessage(userMsg);

    // 2. AI streaming placeholder
    const aiPlaceholder: ChatMessageVM = {
      id: _makeId(),
      type: 'ai-streaming',
      content: '',
      timestamp: _now(),
    };
    sessionStore.appendMessage(aiPlaceholder);

    // 3. Start the real SSE streaming pipeline

    await startStreaming(text.trim());
  }

  // ── Public: rateMessage ───────────────────────────────────────────────────

  /**
   * Toggle the rating of an AI message.
   * If the same value is given again, it resets to null (un-rate).
   */
  function rateMessage(messageId: string, value: FeedbackValue): void {
    const msg = sessionStore.messages.find(m => m.id === messageId);

    if (!msg || msg.type !== 'ai') return;

    msg.rating = msg.rating === value ? null : value;
  }

  // ── Public: cancelStream ──────────────────────────────────────────────────

  async function cancelStream(): Promise<void> {
    await cancelStreaming();
  }

  // ── Public: clearMessages ─────────────────────────────────────────────────

  function clearMessages(): void {
    sessionStore.clearMessages();
  }

  // ── Public: retryLastMessage ──────────────────────────────────────────────

  /**
   * Remove the last system-error / system-timeout item and re-send
   * the last user message.
   */
  async function retryLastMessage(): Promise<void> {
    const msgs = sessionStore.messages;
    // Find the last user message
    let lastUserText: string | null = null;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i]!.type === 'user') {
        lastUserText = msgs[i]!.content;
        break;
      }
    }
    if (!lastUserText) return;

    // Remove the last system item (error/timeout) if present
    const last = msgs.at(-1);
    if (last && (last.type === 'system-error' || last.type === 'system-timeout')) {
      msgs.pop();
    }

    // Re-add the streaming placeholder and restart
    const aiPlaceholder: ChatMessageVM = {
      id: _makeId(),
      type: 'ai-streaming',
      content: '',
      timestamp: _now(),
    };
    sessionStore.appendMessage(aiPlaceholder);
    await startStreaming(lastUserText);
  }

  return {
    messages: computed(() => sessionStore.messages),
    streamingState,

    sendMessage,
    cancelStream,
    clearMessages,
    retryLastMessage,
    rateMessage,
  };
}
