/**
 * useStreaming (T-024)
 *
 * Streaming state-machine composable.
 *
 * States:
 *   idle → sendMessage() → sending
 *   sending → first token received → streaming
 *   streaming → backend done event → completed
 *   sending (30 s without first token) → timeout
 *   any active state → cancelStream() → cancelled
 *   any active state → network/parse error → error
 *   backend sends error event → interrupted
 *
 * Token append target:
 *   The last message in useChatSessionStore.messages whose type is
 *   'ai-streaming'.  If no such message exists the token is silently dropped
 *   (useChat will create the placeholder message before calling startStream).
 */

import { startStream, cancelStream as serviceCancel } from '~/services/streaming'
import { getStreamUrl, cancelStream as apiCancel } from '~/services/api/chat'
import type { StreamingState, LocaleKey } from '~/types/chat'
import { getQuickReplies } from '~/features/chat/utils/quickReplyMapping'

const LOCALE_LS_KEY = 'chat_locale'

/** How long (ms) we wait for the first token before declaring a timeout. */
const FIRST_TOKEN_TIMEOUT_MS = 30_000

export function useStreaming() {
  const sessionStore = useChatSessionStore()

  // ── Internal timer ─────────────────────────────────────────────────────────
  let _timeoutHandle: ReturnType<typeof setTimeout> | null = null

  function _clearTimeout() {
    if (_timeoutHandle !== null) {
      clearTimeout(_timeoutHandle)
      _timeoutHandle = null
    }
  }

  // ── State helpers ──────────────────────────────────────────────────────────
  function setState(s: StreamingState) {
    sessionStore.setStreamingState(s)
  }

  // ── Token append ───────────────────────────────────────────────────────────
  function _appendToken(token: string) {
    const last = sessionStore.messages.at(-1)
    if (last?.type === 'ai-streaming') {
      last.content += token
    }
  }

  // Helper: safely resolve session token from the store (supports ref/plain)
  function _resolveToken(): string | null {
    try {
      // sessionStore may be undefined in some early lifecycle moments
      const anyStore = sessionStore as any
      return anyStore?.sessionToken?.value ?? anyStore?.sessionToken ?? null
    } catch {
      return null
    }
  }

  // ── Public: startStream ────────────────────────────────────────────────────
  /**
   * Begin a streaming request.
   *
   * @param message  User's raw text (will be URL-encoded by getStreamUrl)
   */
  async function startStreaming(message: string): Promise<void> {
    const token = _resolveToken()
    if (!token) {
      setState('error')
      return
    }

    setState('sending')

    // 30-second timeout: fires if we never receive the first token
    _timeoutHandle = setTimeout(() => {
      if (sessionStore.streamingState === 'sending') {
        serviceCancel()
        setState('timeout')
      }
    }, FIRST_TOKEN_TIMEOUT_MS)

    const streamUrl = getStreamUrl(token)
    let firstTokenReceived = false

    startStream(streamUrl, message, {
      onToken(t) {
        if (!firstTokenReceived) {
          firstTokenReceived = true
          _clearTimeout()
          setState('streaming')
        }
        _appendToken(t)
      },

      onDone(payload) {
        _clearTimeout()
        // Transition the last streaming message to a finished AI message
        const last = sessionStore.messages.at(-1)
        if (last?.type === 'ai-streaming') {
          last.type = 'ai'
          // Inject per-message quickReplies from done payload
          const storedLocale = (typeof localStorage !== 'undefined'
            ? localStorage.getItem(LOCALE_LS_KEY)
            : null) as LocaleKey | null
          const currentLocale: LocaleKey = storedLocale ?? 'zh-TW'
          last.quickReplies = getQuickReplies(
            payload?.action,
            payload?.intentLabel,
            last.content,
            currentLocale,
          )
        }
        setState('completed')
      },

      onError(err) {
        _clearTimeout()
        console.error('[useStreaming] stream error', err)
        // Distinguish "backend sent an error" (interrupted) from "we cancelled it"
        const currentState = sessionStore.streamingState
        if (currentState === 'cancelled') return
        setState('interrupted')
      },

      onTimeout(message?: string) {
        _clearTimeout()
        if (message) console.warn('[useStreaming] server timeout:', message)
        setState('timeout')
      },

      onInterrupted(message?: string) {
        _clearTimeout()
        if (message) console.warn('[useStreaming] stream interrupted:', message)
        setState('interrupted')
      },
    })
  }

  // ── Public: cancelStreaming ────────────────────────────────────────────────
  /**
   * Cancel the active stream (user-initiated).
   * Also sends DELETE to the backend to free server resources.
   */
  async function cancelStreaming(): Promise<void> {
    _clearTimeout()
    // Stop the local SSE reader first
    serviceCancel()
    setState('cancelled')

    // Fire-and-forget the backend cancel; ignore errors
    const token = _resolveToken()
    if (token) {
      apiCancel(token).catch((e) => console.warn('[useStreaming] cancel API error', e))
    }
  }

  // ── Public: reset ──────────────────────────────────────────────────────────
  function resetStreaming() {
    _clearTimeout()
    serviceCancel()
    setState('idle')
  }

  return {
    // expose derived state for templates
    streamingState: computed(() => sessionStore.streamingState),
    isStreaming: computed(
      () =>
        sessionStore.streamingState === 'streaming' ||
        sessionStore.streamingState === 'sending',
    ),

    startStreaming,
    cancelStreaming,
    resetStreaming,
  }
}
