import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  generateAssistantRequestId,
  normalizeAssistantToken,
} from "../../../packages/assistant-runtime/src/helpers";
import type {
  AssistantSseEvent,
  AssistantSseEventEnvelope,
  SessionMessagesResponse,
} from "../../../packages/assistant-runtime/src/types";

const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const sharedRuntimeRoot = path.join(repoRoot, "packages/assistant-runtime/src");
const sdkDistTypesPath = path.join(repoRoot, "packages/assistant-sdk/dist/index.d.ts");

function listSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    const stats = statSync(absolute);
    return stats.isDirectory()
      ? listSourceFiles(absolute)
      : /\.(ts|vue)$/.test(entry) ? [absolute] : [];
  });
}

describe("assistant-runtime shared types and pure helpers", () => {
  it("exports reusable domain contracts without app, Nuxt, or SDK facade imports", () => {
    const sourceFiles = listSourceFiles(sharedRuntimeRoot);
    const violations = sourceFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const relative = path.relative(repoRoot, file);
      return [
        /\bfrom\s+["'][^"']*app\//,
        /\bfrom\s+["'][^"']*packages\/assistant-sdk\//,
        /\buseRuntimeConfig\b/,
        /\buseNuxtApp\b/,
        /\b#imports\b/,
        /\b#app\b/,
      ].filter(pattern => pattern.test(source)).map(pattern => `${relative} matched ${pattern}`);
    });

    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it("keeps SDK emitted declarations from exposing shared runtime internals", () => {
    if (!existsSync(sdkDistTypesPath)) {
      return;
    }

    const declarations = readFileSync(sdkDistTypesPath, "utf8");
    expect(declarations).not.toContain("packages/assistant-runtime");
    expect(declarations).not.toContain("app/");
  });

  it("provides typed SSE and history contracts for later slices", () => {
    const event = {
      requestId: "request-001",
      sessionId: "session-001",
      messageId: "message-001",
      eventType: "answer_delta",
      sequence: 1,
      data: { delta: "Hello" },
    } satisfies AssistantSseEventEnvelope<"answer_delta", { delta: string }> satisfies AssistantSseEvent;

    const history = {
      sessionId: "session-001",
      messages: [],
      nextCursor: null,
    } satisfies SessionMessagesResponse;

    expect(event.eventType).toBe("answer_delta");
    expect(history.nextCursor).toBeNull();
  });

  it("owns request ID generation as a pure helper", () => {
    expect(normalizeAssistantToken(" Assistant Request / ", "req")).toBe("Assistant-Request");
    expect(generateAssistantRequestId({
      prefix: " Assistant Request / ",
      randomUUID: () => "00000000-0000-4000-8000-000000000001",
    })).toBe("Assistant-Request-00000000-0000-4000-8000-000000000001");
  });
});
