/**
 * useChatSession (T-025)
 *
 * Manages the full lifecycle of a chat session:
 *
 *   initSession()
 *     1. Read localStorage.chat_session_token
 *     2a. Token exists  → getSessionHistory(token)
 *         Success       → restore messages into store
 *         401/404       → clear token → create new session
 *     2b. No token      → createSession() → store token in localStorage
 *
 *   clearSession()   – wipe localStorage + reset store
 *   restartSession() – clearSession + initSession
 */

import { createSession, getSessionHistory } from '~/services/api/chat';
import type { ChatMessageVM, HistoryMessageDTO } from '~/types/chat';

const LS_KEY = 'chat_session_token';

export function useChatSession() {
  const sessionStore = useChatSessionStore();
  const configStore = useWidgetConfigStore();
  const { t, locale } = useI18n({ useScope: 'global' });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function readStoredToken(): string | null {
    if (import.meta.env.SSR) return null;
    return localStorage.getItem(LS_KEY);
  }

  function writeToken(token: string) {
    if (!import.meta.env.SSR) localStorage.setItem(LS_KEY, token);
  }

  function removeToken() {
    if (!import.meta.env.SSR) localStorage.removeItem(LS_KEY);
  }

  // ── Welcome message helper ────────────────────────────────────────────────

  function _appendWelcomeMessage(): void {
    const { config } = configStore;

    const currentLocale = (locale.value as 'zh-TW' | 'en') ?? 'zh-TW';
    const welcomeText = config?.welcomeMessage?.[currentLocale] ?? t('widget.welcome');

    // Derive locale-specific quick-reply strings from widget config.
    // Falls back to an empty array when config is not yet loaded.
    const quickReplies = (
      config?.quickReplies?.[currentLocale] ??
      config?.quickReplies?.['zh-TW'] ??
      []
    ).filter(Boolean) as string[];

    const welcome: ChatMessageVM = {
      id: crypto.randomUUID(),
      type: 'ai',
      content: welcomeText,
      timestamp: new Date().toISOString(),
      quickReplies,
      rating: null,
    };

    sessionStore.appendMessage(welcome);
  }

  // ── Create a brand-new session ────────────────────────────────────────────

  async function _createNewSession(): Promise<void> {
    sessionStore.setSessionStatus('initialising');

    const session = await createSession();

    if (!session || !session.sessionToken) {
      console.warn('[useChatSession] createSession returned invalid data', session);

      sessionStore.setSessionStatus('error');

      return;
    }
    sessionStore.setSessionToken(session.sessionToken);
    writeToken(session.sessionToken);
    sessionStore.setSessionStatus('active');
    // Show welcome message for new sessions
    _appendWelcomeMessage();
    // Quick replies visible on new session
    sessionStore.setQuickRepliesVisible(true);
  }

  // ── Restore from existing token ───────────────────────────────────────────

  async function _restoreSession(token: string): Promise<void> {
    sessionStore.setSessionStatus('initialising');
    // Always clear before restoring to avoid duplicate appends on re-open
    sessionStore.clearMessages();

    try {
      const history = await getSessionHistory(token);

      if (!history || !Array.isArray(history.messages)) {
        console.warn('[useChatSession] history response is not an array', history);
        removeToken();
        await _createNewSession();
        return;
      }
      sessionStore.setSessionToken(token);
      // Map backend DTOs → frontend ChatMessageVM
      const vms: ChatMessageVM[] = history.messages.map((msg: HistoryMessageDTO) => ({
        id: String(msg.id),
        type: msg.role === 'user' ? 'user' : 'ai',
        content: msg.content,
        timestamp: msg.createdAt,
        rating: null,
      }));
      vms.forEach(vm => sessionStore.appendMessage(vm));
      sessionStore.setSessionStatus('active');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;

      if (status === 401 || status === 404) {
        // Stale / invalid token – start fresh
        removeToken();
        await _createNewSession();
      } else {
        // Unexpected network error – still try to continue with a new session
        console.error('[useChatSession] history fetch failed', err);
        removeToken();
        await _createNewSession();
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Initialise the session on widget open.
   * Called every time the widget opens — re-checks the stored token and
   * restores history or creates a new session as needed.
   */
  async function initSession(): Promise<void> {
    try {
      const stored = readStoredToken();
      if (stored) {
        await _restoreSession(stored);
      } else {
        await _createNewSession();
      }
    } catch (err) {
      console.error('[useChatSession] init failed', err);
      sessionStore.setSessionStatus('error');
    }
  }

  /**
   * Wipe the current session from localStorage and reset the store.
   */
  function clearSession(): void {
    removeToken();
    sessionStore.reset();
  }

  /**
   * Tear down the current session and start a fresh one.
   */
  async function restartSession(): Promise<void> {
    clearSession();
    await initSession();
  }

  return {
    sessionToken: computed(() => {
      // Expose a plain string|null to callers to avoid accidental .value reads
      const anyStore = sessionStore as any;
      return anyStore?.sessionToken?.value ?? anyStore?.sessionToken ?? null;
    }),
    sessionStatus: computed(() => sessionStore.sessionStatus),
    messages: computed(() => sessionStore.messages),

    initSession,
    clearSession,
    restartSession,
  };
}
