import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  forbiddenOutgoingFields,
  runtimePayloadNames,
  secretLikeFields,
} from "../../../fixtures/assistant-sdk/forbidden-fields";

const projectRoot = new URL("../../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

const requestRelatedPathPattern = /(request|transport|context|provider|mode|builder|session|runtime)/i;

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

async function readRequestRelatedSdkSources() {
  const files = (await collectFiles(sdkSourcePath))
    .filter(file => /\.(ts|vue)$/.test(file))
    .filter(file => requestRelatedPathPattern.test(file));

  return Promise.all(
    files.map(async file => ({
      file,
      relativePath: relative(projectRootPath, file),
      source: await readFile(file, "utf8"),
    })),
  );
}

function stripAllowedTypeOnlyForbiddenSchemas(source: string): string {
  return source
    .replace(/\b(?:type|interface)\s+\w+[\s\S]*?\{[\s\S]*?\}/g, (block) => {
      if (/\?:\s*never\b/.test(block)) {
        return "";
      }

      return block;
    });
}

function quotedFieldPattern(field: string): string {
  return `(?:${field}|["']${field}["'])`;
}

function containsForbiddenRuntimeObjectLiteral(source: string, field: string): boolean {
  const runtimeSource = stripAllowedTypeOnlyForbiddenSchemas(source);
  return new RegExp(`[{,]\\s*${quotedFieldPattern(field)}\\s*:\\s*(?!never\\b)`).test(runtimeSource);
}

function containsForbiddenRuntimeAssignment(source: string, field: string): boolean {
  const runtimeSource = stripAllowedTypeOnlyForbiddenSchemas(source);
  const targetPattern = runtimePayloadNames.join("|");
  const dotAssignmentPattern = new RegExp(`\\b(?:${targetPattern})\\.${field}\\s*=`);
  const bracketAssignmentPattern = new RegExp(`\\b(?:${targetPattern})\\[["']${field}["']\\]\\s*=`);

  return dotAssignmentPattern.test(runtimeSource) || bracketAssignmentPattern.test(runtimeSource);
}

function containsForbiddenSerialization(source: string, field: string): boolean {
  const runtimeSource = stripAllowedTypeOnlyForbiddenSchemas(source);
  const targetPattern = runtimePayloadNames.join("|");

  return new RegExp(`\\b(?:${targetPattern})\\s*[:=][\\s\\S]*['"]${field}['"]\\s*[,}]`).test(runtimeSource);
}

function containsForbiddenRuntimeLeakage(source: string, field: string): boolean {
  return (
    containsForbiddenRuntimeObjectLiteral(source, field)
    || containsForbiddenRuntimeAssignment(source, field)
    || containsForbiddenSerialization(source, field)
  );
}

describe("Frontend 002 forbidden outgoing backend authority fields", () => {
  it("documents the backend-owned fields that must never be constructed by the SDK outgoing request builder", () => {
    expect(forbiddenOutgoingFields).toEqual([
      "sourceSystem",
      "connector",
      "connectorId",
      "adapter",
      "adapterId",
      "dataSource",
      "candidateTool",
      "candidateTools",
      "toolName",
      "permissionResult",
      "fieldPermissionResult",
      "rowPermissionResult",
      "finalEvidenceSource",
      "rawEvidence",
      "rawConnectorPayload",
      "routingHint",
      "routingHints",
      "approvalNavigation",
      "approvalNavigationMetadata",
      "navigationUrl",
      "approvalUrl",
      "token",
      "accessToken",
      "refreshToken",
      "credential",
      "secret",
    ]);
  });

  it("does not assign backend-owned authority fields in request, transport, context, provider, mode, or session SDK source", async () => {
    const sourceFiles = await readRequestRelatedSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const field of forbiddenOutgoingFields) {
        expect(
          containsForbiddenRuntimeLeakage(source, field),
          `${relativePath} must not construct, assign, or serialize ${field}`,
        ).toBe(false);
      }
    }
  });

  it("allows type-only forbidden schemas while rejecting runtime payload construction", () => {
    const typeOnlyForbiddenSchema = `
      type SanitizedRequest = {
        sourceSystem?: never
        connectorId?: never
        token?: never
      }

      interface ForbiddenOutgoingFields {
        rawEvidence?: never
        secret?: never
      }
    `;
    const runtimePayload = `
      const payload = {
        sourceSystem: "admin",
        token: "secret",
      }
    `;
    const runtimeQuotedPayload = `
      const payload = {
        "sourceSystem": "admin",
        'token': "secret",
      }
    `;
    const runtimeAssignment = `
      outgoing.connectorId = "connector-001";
      request.token = "secret";
    `;
    const runtimeBracketAssignment = `
      payload["sourceSystem"] = "admin";
      request['token'] = "secret";
      outgoing["connectorId"] = "connector-001";
    `;

    expect(containsForbiddenRuntimeLeakage(typeOnlyForbiddenSchema, "sourceSystem")).toBe(false);
    expect(containsForbiddenRuntimeLeakage(typeOnlyForbiddenSchema, "connectorId")).toBe(false);
    expect(containsForbiddenRuntimeLeakage(typeOnlyForbiddenSchema, "token")).toBe(false);
    expect(containsForbiddenRuntimeLeakage(runtimePayload, "sourceSystem")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimePayload, "token")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeQuotedPayload, "sourceSystem")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeQuotedPayload, "token")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeAssignment, "connectorId")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeAssignment, "token")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeBracketAssignment, "sourceSystem")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeBracketAssignment, "connectorId")).toBe(true);
    expect(containsForbiddenRuntimeLeakage(runtimeBracketAssignment, "token")).toBe(true);
  });

  it("does not smuggle secret-like fields through generic outgoing payload objects", async () => {
    const sourceFiles = await readRequestRelatedSdkSources();

    for (const { relativePath, source } of sourceFiles) {
      for (const field of secretLikeFields) {
        expect(
          containsForbiddenSerialization(source, field),
          `${relativePath} must not serialize ${field}`,
        ).toBe(false);
      }
    }
  });
});
