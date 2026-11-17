<script setup lang="ts">
defineProps<{
  name: "archive" | "back" | "trash" | "unarchive" | "bot" | "chat" | "close" | "history" | "list" | "restart" | "send" | "stop" | "thumb-up" | "thumb-down" | "user";
}>();
</script>

<template>
  <svg
    class="assistant-product-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="name === 'chat'">
      <path d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.1 8.1 0 0 1-3.5-.8L4 19.5l1.25-3.75A7.5 7.5 0 1 1 20 11.5Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
    </template>
    <template v-else-if="name === 'bot'">
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4M9 12h.01M15 12h.01M9 16h6" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'list'">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </template>
    <template v-else-if="name === 'back'">
      <path d="m15 18-6-6 6-6" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14M10 11v6M14 11v6" />
    </template>
    <template v-else-if="name === 'unarchive'">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M12 17v-6M9.5 13.5 12 11l2.5 2.5" />
    </template>
    <template v-else-if="name === 'archive'">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </template>
    <template v-else-if="name === 'history'">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'restart'">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </template>
    <template v-else-if="name === 'send'">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </template>
    <template v-else-if="name === 'stop'">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </template>
    <template v-else-if="name === 'thumb-up'">
      <path d="M7 10v10H4V10h3Zm0 0 4-7 1 1v4h5.2a2 2 0 0 1 1.95 2.45l-1.15 5A2 2 0 0 1 16.05 17H7" />
    </template>
    <template v-else-if="name === 'thumb-down'">
      <path d="M7 14V4H4v10h3Zm0 0 4 7 1-1v-4h5.2a2 2 0 0 0 1.95-2.45l-1.15-5A2 2 0 0 0 16.05 7H7" />
    </template>
    <template v-else>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </template>
  </svg>
</template>
