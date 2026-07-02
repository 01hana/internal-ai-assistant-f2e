export default defineNuxtConfig({
  modules: ["@nuxt/ui", "@pinia/nuxt", "@nuxt/eslint"],
  css: ["~/assets/css/main.css"],
  devtools: {
    enabled: true,
  },
  runtimeConfig: {
    public: {
      assistantWidgetMode: "embedded",
    },
  },
  compatibilityDate: "2026-07-01",
});
