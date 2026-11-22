import { defineVitestProject } from "@nuxt/test-utils/config";
import { defineConfig } from "vitest/config";

async function defineNuxtComponentProject() {
  const originalStructuredClone = globalThis.structuredClone;

  globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
    try {
      return originalStructuredClone(value, options);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }) as typeof structuredClone;

  try {
    return await defineVitestProject({
      test: {
        name: "component",
        include: ["tests/component/**/*.spec.ts"],
        // Node 25 enables its own Web Storage (a localStorage without methods unless --localstorage-file is given),
        // which hides jsdom's. Turn it off so the tests get jsdom's localStorage; the flag is also accepted by Node 22/24.
        execArgv: ["--no-experimental-webstorage"],
        environmentOptions: {
          nuxt: {
            domEnvironment: "jsdom",
          },
        },
      },
    });
  } finally {
    globalThis.structuredClone = originalStructuredClone;
  }
}

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.spec.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "contract",
          include: ["tests/contract/**/*.spec.ts"],
          environment: "node",
        },
      },
      await defineNuxtComponentProject(),
    ],
  },
});
