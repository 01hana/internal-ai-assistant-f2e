# Nuxt + Gateway 串接範本

新的客戶系統要接上 AI 助理時，直接把這個資料夾的檔案複製到客戶系統 repo，保持相同的目錄結構即可。

> 來源：`idx-shinmone-scm-frontend` 已上線的串接程式，只把客戶專屬的值換成了常數。完整安裝流程見 [../../INSTALL.md](../../INSTALL.md)。

## 檔案

| 檔案 | 作用 | 要不要改 |
|---|---|---|
| `composables/assistant/assistantIdentityTokenProvider.ts` | 用客戶系統登入 token 向 Identity Bridge 交換 AI 助理 token；快取到過期前 30 秒、使用者換人或登出時自動作廢 | 不用改 |
| `composables/assistant/assistantWidget.ts` | 組出 `mountAssistantWidget` 的完整參數（`provider`、`getAccessToken`、`configuration`） | 改最上方的 `HOST_APP`、`SESSION_SCOPE` |
| `tests/unit/assistantIdentityTokenProvider.spec.ts` | token provider 的單元測試（vitest） | 不用改；建議一起複製 |

## 複製

```bash
TEMPLATE="<internal-ai-assistant 路徑>/packages/assistant-sdk/templates/nuxt-gateway"
cd <客戶系統 repo>

mkdir -p composables/assistant tests/unit
cp "$TEMPLATE"/composables/assistant/*.ts composables/assistant/
cp "$TEMPLATE"/tests/unit/*.spec.ts tests/unit/
```

複製後：

1. 打開 `composables/assistant/assistantWidget.ts`，把 `HOST_APP`、`SESSION_SCOPE` 改成這個客戶的值。
2. 確認 `nuxt.config.ts` 的 `imports.dirs` 有包含 `composables/**`（Nuxt 預設只自動引入 `composables/` 第一層）。沒有的話，在 app.vue 手動 `import`。
3. 如果客戶系統沒有 vitest，可以先不複製測試檔。

## 在 app.vue 掛載

兩個 composable 只負責「參數長什麼樣子」，app.vue 只負責「什麼時候掛載、什麼時候銷毀」。

```vue
<script lang="ts" setup>
import '@ideaxpress/assistant-sdk/styles.css'
import { mountAssistantWidget } from '@ideaxpress/assistant-sdk'

const route = useRoute()

let assistantHandle: ReturnType<typeof mountAssistantWidget> | null = null
let assistantHostMounted = false

const assistantIdentityTokenProvider = createAssistantIdentityTokenProvider({
  fetch: globalThis.fetch.bind(globalThis),
  getNativeAccessToken: () => /* 客戶系統取得登入 access token 的方式 */,
  now: Date.now,
})

const mountAssistant = () => {
  if (!assistantHostMounted || !/* 是否已登入 */ || assistantHandle !== null) return
  assistantHandle = mountAssistantWidget(createAssistantWidgetOptions({
    getAssistantAccessToken: assistantIdentityTokenProvider.getAssistantAccessToken,
    getRoute: () => route.path,
    target: '#assistant-root',
  }))
}

const destroyAssistant = () => {
  assistantIdentityTokenProvider.invalidate()
  assistantHandle?.destroy()
  assistantHandle = null
}

// 登入 → mountAssistant()；登出 → destroyAssistant()
onMounted(() => { assistantHostMounted = true; mountAssistant() })
onUnmounted(() => { assistantHostMounted = false; destroyAssistant() })
</script>

<template>
  <!-- 放在登入後的版面內 -->
  <div id="assistant-root" />
</template>
```

需要依客戶系統調整的只有兩處：`getNativeAccessToken`（怎麼拿到登入 token）和「是否已登入」的判斷。

## 維護

- 修改 composable 時，**先改這裡的範本**，再同步到已串接的客戶系統。
- 範本不會打包進 npm 套件（`package.json` 的 `files` 不含 `templates/`），只供 repo 內複製。
- 這個資料夾不在 internal-ai-assistant 的 vitest / eslint 範圍內；測試請在複製到客戶系統後執行。
