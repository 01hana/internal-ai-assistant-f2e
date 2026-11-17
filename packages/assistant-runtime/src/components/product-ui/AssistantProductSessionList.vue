<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import type { AssistantSessionListItem } from "../../types";
import AssistantProductIcon from "./AssistantProductIcon.vue";

/**
 * Frontend 003: the actor's own sessions (Backend Feature 013). Display only: the host widget owns loading,
 * paging, opening and archiving; this component owns only the two-step archive/delete confirmation.
 */
const props = withDefaults(defineProps<{
  sessions: readonly AssistantSessionListItem[];
  currentSessionId?: string | null;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  /** Per-session state while an open, archive or delete request is pending, or after it failed. */
  itemStates?: Readonly<Record<string, { pending?: boolean; error?: string | null }>>;
  /** Disables opening while the widget cannot switch conversations (for example during a reply). */
  openDisabled?: boolean;
  /** Shows the delete action next to archive. */
  showDelete?: boolean;
  /** Which list is shown: the active sessions or the archived ones. */
  view?: "active" | "archived";
  /** Shows the active / archived switch. */
  showArchivedView?: boolean;
}>(), {
  currentSessionId: null,
  loading: false,
  loadingMore: false,
  hasMore: false,
  error: null,
  itemStates: () => ({}),
  openDisabled: false,
  showDelete: false,
  view: "active",
  showArchivedView: false,
});

const emit = defineEmits<{
  open: [sessionId: string];
  archive: [sessionId: string];
  delete: [sessionId: string];
  unarchive: [sessionId: string];
  switchView: [view: "active" | "archived"];
  loadMore: [];
  retry: [];
}>();

const headingRef = ref<HTMLElement | null>(null);
type ConfirmAction = "archive" | "delete";
const confirming = ref<{ sessionId: string; action: ConfirmAction } | null>(null);
const confirmText: Record<ConfirmAction, string> = { archive: "確定封存？", delete: "確定刪除？刪除後無法復原。" };
const confirmLabel: Record<ConfirmAction, string> = { archive: "封存", delete: "刪除" };

const timeFormatter = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei" });
const dateFormatter = new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei" });
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Taipei" });

function formatLastMessageAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dayKeyFormatter.format(date) === dayKeyFormatter.format(new Date())
    ? timeFormatter.format(date)
    : dateFormatter.format(date);
}

function itemState(sessionId: string) {
  return props.itemStates[sessionId] ?? {};
}

function requestConfirmation(sessionId: string, action: ConfirmAction) {
  confirming.value = { sessionId, action };
}

function confirmAction(sessionId: string, action: ConfirmAction) {
  confirming.value = null;
  if (action === "archive") emit("archive", sessionId);
  else emit("delete", sessionId);
}

onMounted(() => {
  // Moving focus to the heading tells keyboard and screen-reader users the view changed.
  void nextTick(() => headingRef.value?.focus());
});
</script>

<template>
  <section class="assistant-session-list" data-testid="assistant-session-list" aria-labelledby="assistant-session-list-title">
    <h3 id="assistant-session-list-title" ref="headingRef" class="assistant-session-list-title" tabindex="-1">
      對話紀錄
    </h3>

    <div v-if="showArchivedView" class="assistant-session-list-views" role="group" aria-label="對話紀錄分類">
      <button
        type="button"
        class="assistant-session-list-view"
        data-testid="assistant-session-view-active"
        :aria-pressed="view === 'active' ? 'true' : 'false'"
        @click="view !== 'active' && emit('switchView', 'active')"
      >
        對話
      </button>
      <button
        type="button"
        class="assistant-session-list-view"
        data-testid="assistant-session-view-archived"
        :aria-pressed="view === 'archived' ? 'true' : 'false'"
        @click="view !== 'archived' && emit('switchView', 'archived')"
      >
        已封存
      </button>
    </div>

    <p v-if="loading" class="assistant-session-list-state" data-testid="assistant-session-list-loading" role="status">
      正在載入對話紀錄…
    </p>

    <div v-else-if="error" class="assistant-session-list-state" data-testid="assistant-session-list-error" role="alert">
      <p>{{ error }}</p>
      <button
        type="button"
        class="assistant-session-list-action assistant-session-list-action--primary"
        data-testid="assistant-session-list-retry"
        @click="emit('retry')"
      >
        重試
      </button>
    </div>

    <p v-else-if="sessions.length === 0" class="assistant-session-list-state" data-testid="assistant-session-list-empty">
      {{ view === "archived" ? "沒有已封存的對話" : "還沒有對話紀錄" }}
    </p>

    <ul v-else class="assistant-session-list-items">
      <li
        v-for="item in sessions"
        :key="item.sessionId"
        class="assistant-session-list-item"
        data-testid="assistant-session-list-item"
        :data-session-id="item.sessionId"
        :data-current="item.sessionId === currentSessionId ? 'true' : undefined"
      >
        <template v-if="confirming?.sessionId === item.sessionId">
          <span class="assistant-session-list-confirm-text">{{ confirmText[confirming.action] }}</span>
          <div class="assistant-session-list-item-actions">
            <button
              type="button"
              :class="['assistant-session-list-action', `assistant-session-list-action--${confirming.action === 'delete' ? 'danger' : 'primary'}`]"
              :data-testid="`assistant-session-${confirming.action}-confirm`"
              @click="confirmAction(item.sessionId, confirming.action)"
            >
              {{ confirmLabel[confirming.action] }}
            </button>
            <button
              type="button"
              class="assistant-session-list-action"
              :data-testid="`assistant-session-${confirming.action}-cancel`"
              @click="confirming = null"
            >
              取消
            </button>
          </div>
        </template>
        <template v-else-if="view === 'archived'">
          <div class="assistant-session-list-open assistant-session-list-open--static">
            <span class="assistant-session-list-item-title">{{ item.title ?? "未命名對話" }}</span>
            <span class="assistant-session-list-item-meta">
              <time :datetime="item.lastMessageAt">{{ formatLastMessageAt(item.lastMessageAt) }}</time>
            </span>
          </div>
          <div class="assistant-session-list-item-icons">
            <button
              type="button"
              class="assistant-session-list-icon"
              data-testid="assistant-session-unarchive"
              :aria-label="`取消封存「${item.title ?? '未命名對話'}」`"
              title="取消封存"
              :disabled="itemState(item.sessionId).pending"
              @click="emit('unarchive', item.sessionId)"
            >
              <AssistantProductIcon name="unarchive" />
            </button>
            <button
              v-if="showDelete"
              type="button"
              class="assistant-session-list-icon assistant-session-list-icon--danger"
              data-testid="assistant-session-delete"
              :aria-label="`刪除「${item.title ?? '未命名對話'}」`"
              title="刪除"
              :disabled="itemState(item.sessionId).pending"
              @click="requestConfirmation(item.sessionId, 'delete')"
            >
              <AssistantProductIcon name="trash" />
            </button>
          </div>
          <p
            v-if="itemState(item.sessionId).error"
            class="assistant-session-list-item-error"
            data-testid="assistant-session-item-error"
            role="alert"
          >
            {{ itemState(item.sessionId).error }}
          </p>
        </template>
        <template v-else>
          <button
            type="button"
            class="assistant-session-list-open"
            data-testid="assistant-session-open"
            :disabled="openDisabled || itemState(item.sessionId).pending"
            :aria-current="item.sessionId === currentSessionId ? 'true' : undefined"
            @click="emit('open', item.sessionId)"
          >
            <span class="assistant-session-list-item-title">{{ item.title ?? "未命名對話" }}</span>
            <span class="assistant-session-list-item-meta">
              <span v-if="item.sessionId === currentSessionId" data-testid="assistant-session-current">目前對話 · </span>
              <time :datetime="item.lastMessageAt">{{ formatLastMessageAt(item.lastMessageAt) }}</time>
            </span>
          </button>
          <div class="assistant-session-list-item-icons">
            <button
              type="button"
              class="assistant-session-list-icon"
              data-testid="assistant-session-archive"
              :aria-label="`封存「${item.title ?? '未命名對話'}」`"
              title="封存"
              :disabled="itemState(item.sessionId).pending"
              @click="requestConfirmation(item.sessionId, 'archive')"
            >
              <AssistantProductIcon name="archive" />
            </button>
            <button
              v-if="showDelete"
              type="button"
              class="assistant-session-list-icon assistant-session-list-icon--danger"
              data-testid="assistant-session-delete"
              :aria-label="`刪除「${item.title ?? '未命名對話'}」`"
              title="刪除"
              :disabled="itemState(item.sessionId).pending"
              @click="requestConfirmation(item.sessionId, 'delete')"
            >
              <AssistantProductIcon name="trash" />
            </button>
          </div>
          <p
            v-if="itemState(item.sessionId).error"
            class="assistant-session-list-item-error"
            data-testid="assistant-session-item-error"
            role="alert"
          >
            {{ itemState(item.sessionId).error }}
          </p>
        </template>
      </li>
    </ul>

    <button
      v-if="!loading && !error && hasMore"
      type="button"
      class="assistant-session-list-action assistant-session-list-more"
      data-testid="assistant-session-list-more"
      :disabled="loadingMore"
      @click="emit('loadMore')"
    >
      {{ loadingMore ? "載入中…" : "載入更多" }}
    </button>
  </section>
</template>
