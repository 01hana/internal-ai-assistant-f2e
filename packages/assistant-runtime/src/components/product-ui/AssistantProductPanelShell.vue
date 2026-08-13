<script setup lang="ts">
import AssistantProductIcon from "./AssistantProductIcon.vue";

withDefaults(defineProps<{
  contextReady?: boolean;
  showRestart?: boolean;
  status: string;
  title?: string;
  restartLabel?: string;
  closeLabel?: string;
}>(), {
  contextReady: true,
  showRestart: true,
  title: "AI 助理",
  restartLabel: "重新開始助理對話",
  closeLabel: "關閉助理面板",
});

const emit = defineEmits<{
  close: [];
  restart: [];
}>();
</script>

<template>
  <section
    class="assistant-product-panel-shell"
    data-testid="assistant-panel"
    role="dialog"
    aria-labelledby="assistant-panel-title"
  >
    <div class="assistant-product-panel-surface">
      <header
        class="assistant-product-panel-header"
        data-testid="assistant-panel-header"
      >
        <div class="assistant-product-panel-identity">
          <div class="assistant-product-panel-avatar" aria-hidden="true">
            <AssistantProductIcon name="bot" />
            <span
              class="assistant-product-panel-presence"
              :data-ready="contextReady ? 'true' : 'false'"
            />
          </div>
          <div class="assistant-product-panel-heading">
            <h2 id="assistant-panel-title">{{ title }}</h2>
            <span>{{ status }}</span>
          </div>
        </div>

        <div class="assistant-product-panel-header-actions">
          <button
            v-if="showRestart"
            type="button"
            class="assistant-product-header-icon"
            data-testid="assistant-panel-restart"
            :aria-label="restartLabel"
            :title="restartLabel"
            @click="emit('restart')"
          >
            <AssistantProductIcon name="restart" />
          </button>
          <button
            type="button"
            class="assistant-product-header-icon"
            data-testid="assistant-panel-close"
            data-assistant-close
            :aria-label="closeLabel"
            :title="closeLabel"
            @click="emit('close')"
          >
            <AssistantProductIcon name="close" />
          </button>
        </div>
      </header>

      <div
        class="assistant-panel-status"
        data-testid="assistant-panel-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ status }}
      </div>

      <main class="assistant-product-panel-main" data-testid="assistant-panel-main">
        <slot />
      </main>
    </div>
  </section>
</template>
