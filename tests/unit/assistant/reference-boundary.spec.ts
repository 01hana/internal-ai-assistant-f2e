import { access, readdir, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = new URL("../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const productionRoots = [
  "app/features/assistant",
  "app/services",
  "app/stores/assistant",
  "app/utils/assistant",
  "app/types/assistant",
] as const;

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
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }

      return [entryPath];
    }),
  );

  return files.flat();
}

async function readProductionSources() {
  const sourceFiles = (
    await Promise.all(
      productionRoots.map(async (root) => {
        const directory = new URL(root, projectRoot);
        const files = await collectFiles(fileURLToPath(directory));
        return files.filter(file => /\.(ts|vue)$/.test(file));
      }),
    )
  ).flat();

  return Promise.all(
    sourceFiles.map(async (file) => ({
      file,
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

describe("Final Phase reference boundary guardrails", () => {
  it("keeps production assistant source isolated from docs/reference raw UI files", async () => {
    const sources = await readProductionSources();

    for (const { relativePath, source } of sources) {
      expect(source, relativePath).not.toContain(
        "docs/reference/legacy-chatbot-widget/raw",
      );
    }
  });

  it("does not introduce forbidden assistant module layouts or card-layer directories", async () => {
    expect(
      await pathExists(fileURLToPath(new URL("app/lib/assistant", projectRoot))),
    ).toBe(false);
    expect(
      await pathExists(
        fileURLToPath(new URL("app/components/assistant/cards", projectRoot)),
      ),
    ).toBe(false);
    expect(
      await pathExists(
        fileURLToPath(
          new URL("app/features/assistant/components/cards", projectRoot),
        ),
      ),
    ).toBe(false);
  });

  it("keeps the assistant service architecture consolidated and free of split client files", async () => {
    const assistantServiceSource = await readFile(
      new URL("app/services/api/assistant.ts", projectRoot),
      "utf8",
    );

    expect(assistantServiceSource).not.toContain("$fetch");
    expect(assistantServiceSource).not.toContain("createChatClient");
    expect(assistantServiceSource).not.toContain("createAssistantClient");

    for (const fileName of [
      "sessions.ts",
      "messages.ts",
      "feedback.ts",
      "actionDrafts.ts",
      "approvalRequests.ts",
    ]) {
      expect(
        await pathExists(
          fileURLToPath(new URL(`app/services/api/${fileName}`, projectRoot)),
        ),
      ).toBe(false);
    }
  });

  it("does not introduce forbidden helper names or card-layer naming in assistant production source", async () => {
    const sources = await readProductionSources();

    for (const { relativePath, source } of sources) {
      expect(source, relativePath).not.toContain("createChatClient");
      expect(source, relativePath).not.toContain("createAssistantClient");
      expect(relativePath, relativePath).not.toMatch(/\/cards?\//i);
      expect(relativePath, relativePath).not.toMatch(/cards?\.[a-z]+$/i);
    }
  });
});
