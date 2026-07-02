import { defineConfig } from "vitest/config";

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
      {
        test: {
          name: "component",
          include: ["tests/component/**/*.spec.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});
