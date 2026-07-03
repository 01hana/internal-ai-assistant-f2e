export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxt/eslint", "@vueuse/nuxt"],
  css: ["~/assets/css/main.css"],
  devtools: {
    enabled: true,
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "",
    },
  },
  pinia: {
    storesDirs: ["./stores/**"],
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
