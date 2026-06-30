/**
 * useChatSessionStore (T-006)
 *
 * Holds the active chat session state: token, messages, streaming state,
 * handoff state, lead form state, and quick-replies visibility.
 */

import type { ChatMessageVM, StreamingState, HandoffState, LeadFormState } from '~/types/chat';

export const useChatSessionStore = defineStore('chatSession', () => {
  const sessionToken = ref<string | null>(null);
  const sessionStatus = ref<'idle' | 'initialising' | 'active' | 'expired' | 'error'>('idle');
  const messages = ref<ChatMessageVM[]>([]);
  const streamingState = ref<StreamingState>('idle');
  const handoffState = ref<HandoffState>({ status: 'normal' } as HandoffState);
  const leadFormState = ref<LeadFormState>({ submitted: false } as LeadFormState);
  const [quickRepliesVisible, setQuickRepliesVisibleState] = useAppState(true);

  function setSessionToken(token: string | null) {
    sessionToken.value = token;
  }

  function setSessionStatus(status: typeof sessionStatus.value) {
    sessionStatus.value = status;
  }

  function appendMessage(message: ChatMessageVM) {
    messages.value.push(message);
  }

  function updateLastMessage(patch: Partial<ChatMessageVM>) {
    const last = messages.value.at(-1);
    if (last) Object.assign(last, patch);
  }

  function clearMessages() {
    messages.value = [];
  }

  function setStreamingState(state: StreamingState) {
    streamingState.value = state;
  }

  function setHandoffState(state: HandoffState) {
    handoffState.value = state;
  }

  function setLeadFormSubmitted(createdAt?: string) {
    leadFormState.value = { submitted: true, createdAt };
  }

  function setQuickRepliesVisible(visible: boolean) {
    setQuickRepliesVisibleState(visible);
  }

  function reset() {
    sessionToken.value = null;
    sessionStatus.value = 'idle';
    messages.value = [];
    streamingState.value = 'idle';
    handoffState.value = { status: 'normal' } as HandoffState;
    leadFormState.value = { submitted: false } as LeadFormState;
    setQuickRepliesVisible(true);
  }

  return {
    // state
    sessionToken,
    sessionStatus,
    messages,
    streamingState,
    handoffState,
    leadFormState,
    quickRepliesVisible,

    // actions
    setSessionToken,
    setSessionStatus,
    appendMessage,
    updateLastMessage,
    clearMessages,
    setStreamingState,
    setHandoffState,
    setLeadFormSubmitted,
    setQuickRepliesVisible,
    reset,
  };
});
