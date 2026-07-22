import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  requiredRuntimeRegressionCategories,
  requiredRuntimeRegressionFlowIds,
  runtimeRegressionGate,
} from "../../fixtures/assistant-sdk/runtime-regression-gate";
import {
  approvedRuntimeBridgeFilePatterns,
  forbiddenDuplicateRuntimeFilePatterns,
} from "../../fixtures/assistant-sdk/architecture-guardrails";

const projectRootPath = fileURLToPath(new URL("../../../", import.meta.url));
const sdkSourceRoot = join(projectRootPath, "packages/assistant-sdk/src");
const gateFixturePath = join(projectRootPath, "tests/fixtures/assistant-sdk/runtime-regression-gate.ts");

const allowedAreas = new Set([
  "frontend001-adapter",
  "shared-runtime",
  "frontend002-sdk-boundary",
  "legacy-known-issue",
]);

const allowedOwners = new Set([
  "frontend001-nuxt-adapter",
  "shared-canonical-assistant-runtime",
  "frontend002-sdk-adapter",
]);

const focusedCommandPatterns = [
  /^npm run test:(unit|component|contract) -- .+/,
  /^npx vitest run .+ --reporter=(dot|verbose)$/,
];

const staleOwnershipPhrases = [
  "Frontend 001 remains the only chat runtime owner",
  "Frontend 001 is the reusable canonical runtime owner",
  "Monorepo source-time adapter imports are allowed",
  "Frontend 002 package owns SSE parser",
  "return to existing Frontend 001 error / retry flow",
  "SDK directly imports app/**",
  "ChatWidget owns canonical UI",
  "AssistantService owns canonical SSE",
  "AssistantService owns canonical session",
  "useChat owns canonical business logic",
];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  }
  catch {
    return false;
  }
}

async function collectFiles(directory: string): Promise<string[]> {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }));

  return files.flat();
}

function isApprovedRuntimeBridge(relativePath: string) {
  return approvedRuntimeBridgeFilePatterns.some(pattern => pattern.test(relativePath));
}

describe("Frontend 002 runtime regression gate manifest", () => {
  it("lists every release-critical regression category and flow required before old-owner cleanup", () => {
    const categories = runtimeRegressionGate.map(entry => entry.category);
    const ids = runtimeRegressionGate.map(entry => entry.id);

    for (const category of requiredRuntimeRegressionCategories) {
      expect(categories, `Runtime regression gate must include ${category}.`).toContain(category);
    }

    for (const id of requiredRuntimeRegressionFlowIds) {
      const entry = runtimeRegressionGate.find(candidate => candidate.id === id);
      expect(entry, `Runtime regression gate must include release-blocking flow ${id}.`).toBeTruthy();
      expect(entry?.status, `${id} must be present before T133 can start.`).toBe("present");
      expect(entry?.required, `${id} must stay required.`).toBe(true);
      expect(entry?.releaseBlocking, `${id} must stay release-blocking.`).toBe(true);
    }

    expect(new Set(ids).size, "Runtime regression gate IDs must be unique.").toBe(ids.length);
  });

  it("uses explicit three-layer ownership metadata for every regression entry", () => {
    for (const entry of runtimeRegressionGate) {
      expect(entry.id, "Every runtime regression entry needs a stable id.").toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(allowedAreas.has(entry.area), `${entry.id} must use an approved coverage area.`).toBe(true);
      expect(allowedOwners.has(entry.owner), `${entry.id} must use an approved owner.`).toBe(true);
      expect(entry.requiredFlow.trim().length, `${entry.id} must describe the protected flow.`).toBeGreaterThan(20);

      if (entry.area === "shared-runtime") {
        expect(entry.owner, `${entry.id} shared-runtime entries must be owned by Shared Canonical Assistant Runtime.`)
          .toBe("shared-canonical-assistant-runtime");
      }

      if (entry.area === "frontend002-sdk-boundary") {
        expect(entry.owner, `${entry.id} SDK boundary entries must be owned by the Frontend 002 SDK Adapter.`)
          .toBe("frontend002-sdk-adapter");
      }
    }
  });

  it("points present and known-issue entries at real focused test files and marks gaps honestly", async () => {
    for (const entry of runtimeRegressionGate) {
      expect(entry.paths.length, `${entry.id} must list at least one path or an explicit missing entry.`).toBeGreaterThan(0);

      if (entry.status === "present" || entry.status === "known-issue") {
        for (const path of entry.paths) {
          expect(await pathExists(join(projectRootPath, path)), `${entry.id} path ${path} must exist.`).toBe(true);
        }
      }

      if (entry.status === "known-issue") {
        expect(entry.required, `${entry.id} known issues must not be marked required.`).toBe(false);
        expect(entry.releaseBlocking, `${entry.id} known issues must not block T132 closeout.`).toBe(false);
        expect(entry.notes, `${entry.id} known issues need explicit notes.`).toBeTruthy();
        expect(entry.followUp, `${entry.id} known issues need an owning follow-up task.`).toBeTruthy();
      }

      if (entry.status === "missing") {
        expect(entry.required, `${entry.id} missing entries must not be marked required.`).toBe(false);
        expect(entry.releaseBlocking, `${entry.id} missing entries must not be release-blocking.`).toBe(false);
        expect(entry.missingReason, `${entry.id} missing entries need an explicit reason.`).toBeTruthy();
      }
    }
  });

  it("documents focused commands instead of executing broad suites by default", () => {
    for (const entry of runtimeRegressionGate) {
      expect(
        focusedCommandPatterns.some(pattern => pattern.test(entry.command)),
        `${entry.id} must define a focused npm script pattern or direct Vitest command.`,
      ).toBe(true);
      expect(entry.command).not.toBe("npm run test");
      expect(entry.command).not.toBe("npm run test:unit");
      expect(entry.command).not.toBe("npm run test:component");
      expect(entry.command).not.toBe("npm run test:contract");
    }
  });

  it("keeps the known legacy streaming regression as classification-only coverage", () => {
    const legacyEntry = runtimeRegressionGate.find(entry => entry.id === "legacy-send-message-streaming-known-issue");

    expect(legacyEntry).toBeTruthy();
    expect(legacyEntry?.status).toBe("known-issue");
    expect(legacyEntry?.required).toBe(false);
    expect(legacyEntry?.releaseBlocking).toBe(false);
    expect(legacyEntry?.paths).toContain("tests/component/assistant/send-message-streaming.spec.ts");
    expect(legacyEntry?.notes).toMatch(/legacy assistant-chat-\*/);
    expect(legacyEntry?.followUp).toMatch(/T133/);
  });

  it("does not preserve stale ownership wording from pre-extraction architecture", async () => {
    const source = await readFile(gateFixturePath, "utf8");

    for (const phrase of staleOwnershipPhrases) {
      expect(source, `Runtime regression gate must not preserve stale ownership wording: ${phrase}`).not.toContain(phrase);
    }
  });

  it("keeps runtime regression coverage as references rather than copied SDK runtime tests", async () => {
    const files = await collectFiles(sdkSourceRoot);

    for (const file of files) {
      const relativePath = relative(projectRootPath, file);

      if (isApprovedRuntimeBridge(relativePath)) {
        continue;
      }

      for (const forbiddenPattern of forbiddenDuplicateRuntimeFilePatterns) {
        expect(
          basename(file),
          `${relativePath} must not copy canonical assistant runtime ownership into SDK source.`,
        ).not.toMatch(forbiddenPattern);
      }

      const source = await readFile(file, "utf8");
      expect(source, `${relativePath} must not embed runtime regression test suite execution.`).not.toContain("npm run test");
    }
  });
});
