import { fileURLToPath, URL } from "node:url";

// Server-only upstream. Browser clients always address the same-origin route.
// const assistantApiOrigin = (process.env.ASSISTANT_API_ORIGIN ?? "http://localhost:4000")
//   .replace(/\/+$/, "");
// const assistantApiBase = `${assistantApiOrigin}/api/v1`;

export default defineNuxtConfig({
  alias: {
    "@ideaxpress/assistant-sdk/styles.css": fileURLToPath(new URL("./packages/assistant-sdk/styles.css", import.meta.url)),
    "@ideaxpress/assistant-sdk": fileURLToPath(new URL("./packages/assistant-sdk/src/index.ts", import.meta.url)),
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
      // Frontend 001 API adapter ownership; do not repurpose this for SDK proxy routing.
      apiBase: process.env.NUXT_API_URL ?? "",
    },
  },
  // nitro: {
  //   devProxy: {
  //     "/api/v1/assistant": {
  //       changeOrigin: true,
  //       target: assistantApiOrigin,
  //     },
  //   },
  // },
  // routeRules: {
  //   "/api/v1/assistant/**": {
  //     proxy: `${assistantApiBase}/assistant/**`,
  //   },
  // },
  pinia: {
    storesDirs: ["./stores/**"],
  },
  build: {
    transpile: ["@ideaxpress/assistant-sdk"],
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
