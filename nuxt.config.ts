import { fileURLToPath, URL } from "node:url";

export default defineNuxtConfig({
  alias: {
    "@internal-ai-assistant/assistant-sdk/styles.css": fileURLToPath(new URL("./packages/assistant-sdk/styles.css", import.meta.url)),
    "@internal-ai-assistant/assistant-sdk": fileURLToPath(new URL("./packages/assistant-sdk/src/index.ts", import.meta.url)),
  },
  modules: [
    "@nuxt/ui",
    "@pinia/nuxt",
    "@nuxt/eslint",
    "@vueuse/nuxt",
    "@nuxt/icon",
  ],
  css: ["~/assets/css/main.css"],
  devtools: {
    enabled: true,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_API_URL ?? "",
    },
  },
  pinia: {
    storesDirs: ["./stores/**"],
  },
  build: {
    transpile: ["@internal-ai-assistant/assistant-sdk"],
  },
  components: [
    {
      path: "~/features/assistant/components",
      pathPrefix: false,
    },
  ],
  imports: {
    dirs: ["composables", "utils", "features/assistant/composables"],
  },
  compatibilityDate: "2026-07-01",
});
