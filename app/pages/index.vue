<template>
  <main class="min-h-screen bg-neutral-100 px-4 py-8 sm:px-8">
    <UContainer>
      <div class="mb-8">
        <UBadge
          label="Enterprise host preview"
          color="neutral"
          variant="subtle"
        />
        <h1 class="mt-3 text-2xl font-semibold text-highlighted">
          訂單作業總覽
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-muted">
          此頁僅模擬企業後台宿主畫面，用於預覽右下角的內部 AI 助理 launcher。
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        <UCard
          v-for="item in [
            ['待確認訂單', '18'],
            ['今日出貨', '42'],
            ['異常待處理', '3'],
          ]"
          :key="item[0]"
        >
          <p class="text-sm text-muted">
            {{ item[0] }}
          </p>
          <p class="mt-2 text-3xl font-semibold text-highlighted">
            {{ item[1] }}
          </p>
        </UCard>
      </div>
    </UContainer>

    <ChatWidget context-summary="訂單作業總覽" />
  </main>
</template>
