# 客戶系統安裝與更新指南

本文件說明如何把 `@ideaxpress/assistant-sdk`（AI 助理前端 SDK）安裝到客戶系統、完成串接，以及之後如何更新。完整的 API 與安全邊界說明請見 [README.md](./README.md)。

> 實際串接範例：`idx-shinmone-scm-frontend`（新模螺絲委外託工系統，Nuxt 3 + Quasar）。

---

## 1. 前置條件

| 項目 | 需求 |
|---|---|
| 前端框架 | Vue `^3.5`（Nuxt 3 / 4 皆可，Nuxt 為選用） |
| 登入 | 客戶系統已有自己的登入機制，能在前端取得使用者的 access token |
| 套件存取 | 能存取 GitHub `ideaxpress` 組織的 GitHub Packages（見第 2 節） |
| 後端 | 該客戶的 AI 助理後端已部署並完成 provision（見第 5 節） |

SDK 自帶 Pinia 與所有樣式，客戶系統**不需要**另外安裝 Pinia、Tailwind、Nuxt UI 或 Quasar。

---

## 2. 設定套件來源（每個 repo 做一次）

在客戶系統 repo 根目錄新增 `.npmrc`：

```ini
@ideaxpress:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

- `.npmrc` 可以 commit，裡面只有變數名稱，沒有 token 本身。
- `GITHUB_TOKEN` 放在本機 `.env` / shell 環境或 CI secret，**不要 commit**。
- Token 需要 `read:packages` 權限，且帳號必須能存取 `ideaxpress` 組織。若專案的 Nuxt layer 已經用 `GITHUB_TOKEN` 從 `ideaxpress` 拉程式碼，同一把 token 加上 `read:packages` 即可共用。
- npm 讀 `.npmrc` 時用的是 shell 環境變數，不會讀 `.env`。在本機請先 `export GITHUB_TOKEN=...`，或寫在 `~/.zshrc`。

---

## 3. 安裝

```bash
npm install @ideaxpress/assistant-sdk
```

`package.json` 會出現：

```json
"@ideaxpress/assistant-sdk": "^0.1.0"
```

只使用這兩個公開入口，不要 deep import 套件內部路徑：

```ts
import { mountAssistantWidget } from '@ideaxpress/assistant-sdk'
import '@ideaxpress/assistant-sdk/styles.css'
```

---

## 4. 掛載到客戶系統

### 4.1 放一個掛載點

在登入後會出現的版面（例如 `app.vue` 或主 layout）放一個空元素：

```vue
<div id="assistant-root" />
```

### 4.2 登入後掛載、登出時銷毀

SDK 只在瀏覽器端執行。Nuxt 專案若 `ssr: true`，請把掛載程式放在 `onMounted` 或 `*.client.ts` plugin 內。

```ts
import '@ideaxpress/assistant-sdk/styles.css'
import { mountAssistantWidget } from '@ideaxpress/assistant-sdk'

let handle: ReturnType<typeof mountAssistantWidget> | null = null

function mountAssistant() {
  if (handle) return
  handle = mountAssistantWidget({
    target: '#assistant-root',
    provider: async () => ({
      hostApp: '<HostApp 代碼>',          // 必須與後端 provision 的 HostApp 相同
      pageContext: { route: route.path }, // 只放頁面脈絡，不要放權限或 token
    }),
    getAccessToken: () => getAssistantAccessToken(), // 見 4.3
    configuration: {
      integrationMode: 'gateway-v1',
      launcher: { enabled: true },
      sessionScope: '<客戶系統代碼>-main',
    },
  })
}

function destroyAssistant() {
  handle?.destroy()
  handle = null
}

// 登入 → mountAssistant()；登出、元件卸載 → destroyAssistant()
```

- 同一個 target 只能有一個 widget；重新掛載前要先 `destroy()`。
- 登出時一定要 `destroy()`，否則下一位使用者可能看到上一位的對話。

### 4.3 取得 AI 助理用的 token

`getAccessToken` 要回傳 **AI 助理的 token**，不是客戶系統原本的登入 token。流程是：

```
客戶系統登入 token
   │  POST /assistant-identity/identity/exchange
   │  Authorization: Bearer <客戶系統登入 token>
   ▼
Identity Bridge 回傳 { accessToken, tokenType: "Bearer", expiresIn, ... }
   │
   ▼
getAccessToken() 回傳 accessToken，SDK 只會放在 Authorization header
```

不需要自己寫，直接複製 SDK repo 內的範本：**[`templates/nuxt-gateway/`](./templates/nuxt-gateway/README.md)**。

| 檔案 | 作用 |
|---|---|
| `composables/assistant/assistantIdentityTokenProvider.ts` | 交換 token、快取到過期前 30 秒、使用者換人時自動作廢 |
| `composables/assistant/assistantWidget.ts` | 組出 `mountAssistantWidget` 的完整參數；只需改最上方的 `HOST_APP`、`SESSION_SCOPE` |
| `tests/unit/assistantIdentityTokenProvider.spec.ts` | 上面 token provider 的單元測試 |

範本的 README 有複製指令和 app.vue 的完整掛載範例。

### 4.4 必要參數一覽

`mountAssistantWidget` 的型別上只有 `target`、`provider` 必填，但在 Gateway 架構下以下四項都不能省（範本的 `assistantWidget.ts` 已全部設定好）：

| 參數 | 為什麼不能省 |
|---|---|
| `target` | 掛載點 |
| `provider` 回傳的 `hostApp` | 必須與後端 provision 的 HostApp 一致 |
| `configuration.integrationMode: 'gateway-v1'` | 不寫會用預設的 `backend001-compatibility`，不帶 token，會被 Gateway 拒絕 |
| `getAccessToken` | 只在 `gateway-v1` 使用；沒有它請求就沒有授權 |

`configuration.sessionScope` 建議設定；`launcher`、`callbacks`、主題與位置等都可省略。

### 4.5 反向代理路由

SDK 一律呼叫**同網域**的相對路徑，客戶系統的網站伺服器要把這兩個路徑轉給 AI 助理後端：

| 路徑 | 轉到 | 備註 |
|---|---|---|
| `/api/v1/assistant/` | Gateway | 回覆是 SSE 串流，需關閉緩衝 |
| `/assistant-identity/identity/exchange` | Identity Bridge | token 交換 |

Nginx 範例（服務位址依部署環境調整）：

```nginx
location ^~ /api/v1/assistant/ {
    proxy_pass http://ai-assistant-gateway:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_buffering off;        # SSE 串流必須
    proxy_read_timeout 300s;
}

location = /assistant-identity/identity/exchange {
    proxy_pass http://ai-assistant-bridge:3000/identity/exchange;
    proxy_set_header Host $host;
}
```

本機開發時可用 Nuxt 的 `routeRules` 代理到本機後端：

```ts
// nuxt.config.ts
$development: {
  routeRules: {
    '/assistant-identity/**': { proxy: 'http://127.0.0.1:3107/**' },
    '/api/v1/assistant/**': { proxy: 'http://127.0.0.1:4000/api/v1/assistant/**' },
  },
},
```

### 4.6 （選用）對應客戶系統的主題色

覆寫 `--assistant-sdk-*` CSS 變數即可，不需要改 SDK：

```css
#assistant-root {
  --assistant-sdk-accent: var(--q-primary);
  --assistant-sdk-font-family: inherit;
}
```

可用的變數清單見 README「Theme token contract」。

---

## 5. 後端要先準備的事（交給部署者）

前端裝好之後，AI 助理後端必須已經為這個客戶系統建立好以下資料，否則 token 交換或對話會被拒絕：

| 項目 | 說明 |
|---|---|
| Customer / Integration | 這個客戶與這組串接的識別碼 |
| HostApp | 與前端 `provider` 回傳的 `hostApp` 相同 |
| Identity Bridge 設定 | 能驗證此客戶系統的登入 token（issuer、驗證端點等） |
| TrustProfile、工具與權限 | 這個客戶允許使用哪些查詢工具，以及需要的權限 |

這些由後端的 `provision` 流程建立，請參考該客戶的部署手冊（例如 `runbooks/deploy-192.168.10.110.md` 第 4、5 節）。

---

## 6. 更新 SDK

```bash
# 更新到目前版號範圍內的最新版（例如 ^0.1.0 → 0.1.x 最新）
npm update @ideaxpress/assistant-sdk

# 指定版本（跨 minor / major 時使用）
npm install @ideaxpress/assistant-sdk@0.2.0
```

更新後：

1. 看 README 最下方的 Release notes，確認有沒有需要修改的地方。
2. 若 dev server 畫面沒有變化，刪除 Vite 快取後重啟：`rm -rf node_modules/.cache/vite .nuxt`。
3. 正式環境照原本流程重新建置並部署前端。

版號規則：

| 版號變化 | 代表 | 客戶系統要做的事 |
|---|---|---|
| `0.1.0` → `0.1.1`（patch） | 修 bug、調整樣式 | `npm update` 即可 |
| `0.1.x` → `0.2.0`（minor） | 新增功能，舊用法仍可用 | 指定版本安裝，視需要使用新功能 |
| `0.x` → `1.0.0`（major） | 參數或 API 不相容 | 依 Release notes 修改串接程式 |

> 目前仍是 `0.x` 階段，minor 版本之間也可能有小幅調整，更新前請先看 Release notes。

---

## 7. 尚未發佈到 GitHub Packages 前的暫行做法

在第一次正式發佈前，SDK 以 `.tgz` 檔交付：

1. 把 `.tgz` 放到客戶系統的 `vendor/`，例如 `vendor/assistant-sdk-0.1.0.tgz`。
2. 安裝：
   ```bash
   npm install ./vendor/assistant-sdk-0.1.0.tgz
   ```
   `package.json` 會變成 `"@ideaxpress/assistant-sdk": "file:vendor/assistant-sdk-0.1.0.tgz"`。
3. **`vendor/` 要 commit 進 repo**，否則別人或 CI 安裝時會找不到檔案。
4. 更新時用新的 `.tgz` 覆蓋，再執行一次步驟 2。

改用 GitHub Packages 後，把依賴改回 `"^0.1.0"` 並重新 `npm install`，就可以刪掉 `vendor/`。

---

## 8. 疑難排解

| 現象 | 可能原因 / 處理 |
|---|---|
| `npm install` 出現 `401 Unauthorized` | `GITHUB_TOKEN` 沒有設定、過期，或缺少 `read:packages` |
| `npm install` 出現 `404 Not Found` | `.npmrc` 沒有設定 `@ideaxpress:registry`，或帳號沒有 `ideaxpress` 組織的存取權 |
| 畫面上沒有 AI 助理按鈕 | 頁面上沒有 `#assistant-root`；還沒登入就呼叫掛載；忘了引入 `styles.css` |
| 主控台出現 duplicate mount | 同一個 target 掛了兩次；重新掛載前先 `destroy()` |
| 送出訊息顯示「授權無法使用」 | token 交換失敗：檢查 `/assistant-identity/identity/exchange` 路由，以及後端是否設定好此客戶的 Identity Bridge |
| `/api/v1/assistant/...` 回 `502` | 反向代理連不到 Gateway，AI 助理後端可能未啟動 |
| `/api/v1/assistant/...` 回 `400` | 通常是正常的參數驗證；若持續發生，確認 `integrationMode` 為 `gateway-v1` |
| 回覆一直轉圈、最後顯示中斷 | 反向代理緩衝了 SSE：確認 `proxy_buffering off`，且 `proxy_read_timeout` 夠長 |
| 主控台出現 Vue 相關錯誤或 widget 無反應 | 專案中有兩份 Vue；確認客戶系統的 `vue` 版本符合 `^3.5`，並執行 `npm dedupe` |

---

## 附錄：SDK 維護者的發佈流程

在 `internal-ai-assistant` repo：

```bash
npm version patch --workspace @ideaxpress/assistant-sdk   # 或 minor / major
npm run build:assistant-sdk
npm publish --workspace @ideaxpress/assistant-sdk
```

發佈前請在 README 的 Release notes 補上這一版的變更。發佈需要具備 `write:packages` 權限的 token。
