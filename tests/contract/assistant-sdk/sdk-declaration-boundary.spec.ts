import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const sdkRoot = path.join(repoRoot, "packages/assistant-sdk");
const sdkManifest = JSON.parse(readFileSync(path.join(sdkRoot, "package.json"), "utf8"));

const forbiddenPublicDeclarationPatterns = [
  /app\/features/,
  /app\/services/,
  /app\/stores/,
  /app\/utils/,
  /packages\/assistant-runtime/,
  /src\/runtime/,
  /src\/transport/,
  /src\/session/,
  /src\/context/,
  /src\/request/,
  /\bpinia\b/i
];

function listFiles(dir: string, predicate: (file: string) => boolean): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const absolute = path.join(dir, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      return listFiles(absolute, predicate);
    }

    return predicate(absolute) ? [absolute] : [];
  });
}

function relativeToRepo(file: string): string {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

describe("SDK declaration and public package boundary", () => {
  it("keeps package exports limited to the public root and stylesheet entries", () => {
    expect(Object.keys(sdkManifest.exports).sort()).toEqual([".", "./styles.css"]);
    expect(sdkManifest.exports["."]).toMatchObject({
      types: "./dist/index.d.ts",
      import: "./dist/index.mjs"
    });
    expect(sdkManifest.exports["./styles.css"]).toBe("./styles.css");
  });

  it("models dependency ownership without making Pinia a public peer contract", () => {
    expect(sdkManifest.peerDependencies.vue).toBeDefined();
    expect(sdkManifest.peerDependencies.pinia).toBeUndefined();
    expect(sdkManifest.dependencies.pinia).toMatch(/^\S+$/);
    expect(sdkManifest.peerDependenciesMeta.nuxt.optional).toBe(true);
  });

  it("does not expose shared runtime or consumer Pinia setup from public source barrels", () => {
    const publicSources = [
      path.join(sdkRoot, "src/index.ts"),
      path.join(sdkRoot, "src/types/public.ts"),
      path.join(sdkRoot, "src/types/widgetConfiguration.ts")
    ];

    const violations = publicSources.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenPublicDeclarationPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativeToRepo(file)} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });

  it("keeps emitted public declarations facade-only when dist exists", () => {
    const declarationFiles = listFiles(path.join(sdkRoot, "dist"), (file) => file.endsWith(".d.ts"));

    expect(declarationFiles).toContain(path.join(sdkRoot, "dist/index.d.ts"));

    const violations = declarationFiles.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return forbiddenPublicDeclarationPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativeToRepo(file)} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });
});
