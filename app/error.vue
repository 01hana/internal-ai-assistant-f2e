<script setup lang="ts">
defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
    message?: string
  }
}>()
</script>

<template>
  <NuxtLayout name="default">
    <main class="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p class="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Internal Assistant Frontend
      </p>
      <h1 class="text-3xl font-semibold text-neutral-950">
        發生錯誤
      </h1>
      <p class="text-base text-neutral-700">
        {{ error?.statusMessage || error?.message || '目前無法完成此操作，請稍後再試。' }}
      </p>
      <p class="text-sm text-neutral-500">
        Status: {{ error?.statusCode ?? 'unknown' }}
      </p>
    </main>
  </NuxtLayout>
</template>
