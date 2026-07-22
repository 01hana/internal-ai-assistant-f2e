import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const scannedSourceRoots = [
  "packages/assistant-runtime/src",
  "packages/assistant-sdk/src",
] as const;

const approvedModuleSingletons = new Set([
  // Duplicate mount detection is lifecycle bookkeeping, not shared chat/runtime state.
  "packages/assistant-sdk/src/lifecycle/mountHandle.ts:mountedTargets",
]);

const forbiddenModuleScopePatterns = [
  {
    reason: "module-level Pinia instance",
    pattern: /\b(?:const|let|var)\s+(\w+)\s*=\s*createPinia\s*\(/,
  },
  {
    reason: "active Frontend 001 Pinia access",
    pattern: /\b(getActivePinia|setActivePinia)\s*\(/,
  },
  {
    reason: "module-level mutable runtime instance",
    pattern: /\b(?:let|var)\s+(\w*(?:active|current|shared|global)\w*(?:Runtime|Controller|Store|State)\w*)\b/i,
  },
  {
    reason: "module-level AbortController",
    pattern: /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+AbortController\s*\(/,
  },
  {
    reason: "module-level stream or EventSource",
    pattern: /\b(?:const|let|var)\s+(\w+)\s*=\s*new\s+(?:ReadableStream|EventSource)\s*\(/,
  },
  {
    reason: "module-level timer handle",
    pattern: /\b(?:const|let|var)\s+(\w*(?:timer|timeout|interval)\w*)\s*=\s*(?:setTimeout|setInterval|null|undefined)\b/i,
  },
  {
    reason: "module-level listener registry",
    pattern: /\b(?:const|let|var)\s+(\w*(?:listener|listeners|subscription|subscriptions)\w*)\s*=\s*new\s+(?:Map|Set|WeakMap|WeakSet)\s*\(/i,
  },
  {
    reason: "module-level pending callback registry",
    pattern: /\b(?:const|let|var)\s+(\w*(?:callback|callbacks|pendingCallback|pendingCallbacks)\w*)\s*=\s*new\s+(?:Map|Set|WeakMap|WeakSet)\s*\(/i,
  },
  {
    reason: "module-level cross-widget runtime registry",
    pattern: /\b(?:const|let|var)\s+(\w*(?:widgetRuntime|runtimeRegistry|runtimeRecords|activeWidgets)\w*)\s*=\s*new\s+(?:Map|Set|WeakMap|WeakSet)\s*\(/i,
  },
] as const;

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      return listSourceFiles(absolute);
    }

    return /\.(ts|tsx|vue)$/.test(entry) ? [absolute] : [];
  });
}

function relativeToRepo(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

function updateBraceDepth(line: string, currentDepth: number): number {
  const withoutStrings = line
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "\"\"")
    .replace(/\/\/.*$/, "");
  const opens = withoutStrings.match(/{/g)?.length ?? 0;
  const closes = withoutStrings.match(/}/g)?.length ?? 0;

  return Math.max(0, currentDepth + opens - closes);
}

function findForbiddenRuntimeSingletons(file: string, source: string): string[] {
  const relative = relativeToRepo(file);
  const violations: string[] = [];
  let braceDepth = 0;

  for (const [index, line] of source.split("\n").entries()) {
    const trimmed = line.trim();
    const startsAtModuleScope = braceDepth === 0;

    if (startsAtModuleScope && trimmed.length > 0 && !trimmed.startsWith("import ") && !trimmed.startsWith("export type")) {
      for (const { pattern, reason } of forbiddenModuleScopePatterns) {
        const match = pattern.exec(trimmed);
        const symbol = match?.[1];
        if (!match || (symbol && approvedModuleSingletons.has(`${relative}:${symbol}`))) {
          continue;
        }

        violations.push(`${relative}:${index + 1} ${reason}: ${trimmed}`);
      }
    }

    braceDepth = updateBraceDepth(line, braceDepth);
  }

  return violations;
}

function localScopeForMount(input: { backendSessionId: string; mountId: string }) {
  return {
    backendSessionId: input.backendSessionId,
    localRuntimeScopeId: `local-runtime:${input.mountId}`,
    piniaScopeId: `pinia:${input.mountId}`,
  };
}

describe("runtime state isolation source guard", () => {
  it("scans actual SDK and shared runtime source for forbidden module-level runtime singletons", () => {
    const violations = scannedSourceRoots.flatMap((root) =>
      listSourceFiles(path.join(repoRoot, root)).flatMap((file) =>
        findForbiddenRuntimeSingletons(file, readFileSync(file, "utf8")),
      ),
    );

    expect(violations).toEqual([]);
  });

  it("would fail on module-level cross-widget runtime state", () => {
    const fixtureFile = path.join(repoRoot, "packages/assistant-sdk/src/runtime/badFixture.ts");
    const badSource = [
      "import { createPinia } from 'pinia';",
      "const sharedPinia = createPinia();",
      "let activeRuntimeState = {};",
      "const sharedAbort = new AbortController();",
      "const pendingCallbacks = new Map();",
    ].join("\n");

    expect(findForbiddenRuntimeSingletons(fixtureFile, badSource)).toEqual([
      "packages/assistant-sdk/src/runtime/badFixture.ts:2 module-level Pinia instance: const sharedPinia = createPinia();",
      "packages/assistant-sdk/src/runtime/badFixture.ts:3 module-level mutable runtime instance: let activeRuntimeState = {};",
      "packages/assistant-sdk/src/runtime/badFixture.ts:4 module-level AbortController: const sharedAbort = new AbortController();",
      "packages/assistant-sdk/src/runtime/badFixture.ts:5 module-level pending callback registry: const pendingCallbacks = new Map();",
    ]);
  });

  it("keeps shared backend session identity separate from local runtime and Pinia scopes", () => {
    const first = localScopeForMount({
      backendSessionId: "same-backend-session",
      mountId: "mount-a",
    });
    const second = localScopeForMount({
      backendSessionId: "same-backend-session",
      mountId: "mount-b",
    });

    expect(first.backendSessionId).toBe(second.backendSessionId);
    expect(first.localRuntimeScopeId).not.toBe(second.localRuntimeScopeId);
    expect(first.piniaScopeId).not.toBe(second.piniaScopeId);
  });
});
