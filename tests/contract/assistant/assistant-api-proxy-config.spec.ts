import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const nuxtConfigPath = join(projectRoot, "nuxt.config.ts");
const envExamplePath = join(projectRoot, ".env.example");

describe("assistant API same-origin proxy configuration", () => {
  it("keeps the assistant proxy server-owned without repurposing Frontend 001 API configuration", async () => {
    const source = await readFile(nuxtConfigPath, "utf8");

    expect(source).toContain('process.env.ASSISTANT_API_ORIGIN ?? "http://localhost:4000"');
    expect(source).toContain('apiBase: process.env.NUXT_API_URL ?? ""');
    expect(source).toContain('"/api/v1/assistant": {');
    expect(source).toContain("target: assistantApiOrigin");
    expect(source).toContain('"/api/v1/assistant/**": {');
    expect(source).toContain("proxy: `${assistantApiBase}/assistant/**`");
    expect(source).not.toContain("NUXT_PUBLIC_BASE_URL");
    expect(source).not.toContain("NUXT_PUBLIC_ASSISTANT_SDK_API_BASE_URL");
  });

  it("keeps the SDK preview endpoint independent from Frontend 001 apiBase", async () => {
    const source = await readFile(join(projectRoot, "app/pages/assistant-sdk-preview.vue"), "utf8");

    expect(source).toContain('apiBaseUrl: "/api/v1"');
    expect(source).not.toContain("useRuntimeConfig");
  });

  it("documents the local backend upstream and SDK browser endpoint separately", async () => {
    const source = await readFile(envExamplePath, "utf8");

    expect(source).toContain("ASSISTANT_API_ORIGIN=http://localhost:4000");
    expect(source).not.toContain("NUXT_PUBLIC_ASSISTANT_SDK_API_BASE_URL");
  });
});
