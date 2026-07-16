<script setup lang="ts">
import type {
  AssistantHostContextProvider,
  HostCallbacks,
  WidgetConfiguration,
} from "../types/public";

const props = withDefaults(
  defineProps<{
    provider?: AssistantHostContextProvider;
    configuration?: WidgetConfiguration;
    callbacks?: HostCallbacks;
  }>(),
  {
    provider: undefined,
    configuration: undefined,
    callbacks: undefined,
  },
);
</script>

<template>
  <section
    class="assistant-sdk-root"
    :data-theme="props.configuration?.theme ?? 'system'"
    :data-position="props.configuration?.position ?? 'bottom-right'"
    aria-label="Internal assistant SDK shell"
  >
    <button class="assistant-sdk-launcher" type="button">
      Assistant
    </button>
    <aside class="assistant-sdk-panel" aria-live="polite">
      <p>Assistant SDK shell is ready. Runtime bridge will be connected later.</p>
    </aside>
  </section>
</template>
