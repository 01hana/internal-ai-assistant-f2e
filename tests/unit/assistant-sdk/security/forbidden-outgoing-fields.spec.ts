import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  backendAuthorityFields,
  credentialSinkCallNames,
  credentialSinkObjectNames,
  forbiddenOutgoingFields,
  runtimePayloadNames,
  secretLikeFields,
} from "../../../fixtures/assistant-sdk/forbidden-fields";

const projectRoot = new URL("../../../../", import.meta.url);
const projectRootPath = fileURLToPath(projectRoot);
const sdkSourcePath = fileURLToPath(new URL("packages/assistant-sdk/src", projectRoot));

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

function extractExecutableSource(file: string, source: string): string {
  if (!file.endsWith(".vue")) {
    return source;
  }

  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1] ?? "")
    .join("\n");
}

async function readSdkSources() {
  const files = (await collectFiles(sdkSourcePath))
    .filter(file => /\.(ts|vue)$/.test(file));

  return Promise.all(
    files.map(async file => ({
      file,
      relativePath: relative(projectRootPath, file),
      source: extractExecutableSource(file, await readFile(file, "utf8")),
    })),
  );
}

function parseSource(source: string): ts.SourceFile {
  return ts.createSourceFile("assistant-sdk-guard-input.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function staticPropertyName(name: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name) && (ts.isStringLiteral(name.expression) || ts.isNoSubstitutionTemplateLiteral(name.expression))) {
    return name.expression.text;
  }

  return undefined;
}

function expressionRootName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return expressionRootName(expression.expression);
  }

  return undefined;
}

function assignedFieldName(expression: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const argument = expression.argumentExpression;
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      return argument.text;
    }
  }

  return undefined;
}

function callPath(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return `${callPath(expression.expression)}.${expression.name.text}`;
  }
  return expression.getText();
}

function nodeContainsCredentialReference(node: ts.Node, field: string): boolean {
  let found = false;
  const visit = (candidate: ts.Node) => {
    if (found) {
      return;
    }

    if (ts.isIdentifier(candidate) && candidate.text === field) {
      found = true;
      return;
    }
    if ((ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) && new RegExp(`\\b${field}\\b`).test(candidate.text)) {
      found = true;
      return;
    }
    if (ts.isPropertyAssignment(candidate) && staticPropertyName(candidate.name) === field) {
      found = true;
      return;
    }
    if (ts.isShorthandPropertyAssignment(candidate) && candidate.name.text === field) {
      found = true;
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return found;
}

function isCredentialSinkCall(node: ts.CallExpression | ts.NewExpression): boolean {
  const path = callPath(node.expression);
  const parts = path.split(".");
  const root = parts[0] ?? "";
  const terminal = parts.at(-1) ?? "";

  if (/URLSearchParams|(?:^|\.)URL$/.test(path)) {
    return true;
  }

  return (
    (credentialSinkCallNames as readonly string[]).includes(terminal)
    && (
      terminal === "fetch"
      || terminal === "stringify"
      || (credentialSinkObjectNames as readonly string[]).includes(root)
    )
  );
}

function isObjectLiteralOnOutgoingSurface(node: ts.ObjectLiteralExpression): boolean {
  let current: ts.Node = node;

  while (current.parent) {
    const parent = current.parent;

    if (ts.isVariableDeclaration(parent) && staticPropertyName(parent.name)) {
      return (runtimePayloadNames as readonly string[]).includes(staticPropertyName(parent.name) ?? "");
    }
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return (runtimePayloadNames as readonly string[]).includes(expressionRootName(parent.left) ?? "");
    }
    if (ts.isPropertyAssignment(parent)) {
      if ((runtimePayloadNames as readonly string[]).includes(staticPropertyName(parent.name) ?? "")) {
        return true;
      }
    }
    if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && isCredentialSinkCall(parent)) {
      return true;
    }
    if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) {
      return false;
    }

    current = parent;
  }

  return false;
}

function containsBackendAuthorityLeakage(source: string, field: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }

    if (ts.isPropertyAssignment(node) && staticPropertyName(node.name) === field) {
      found = true;
      return;
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === field) {
      found = true;
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && assignedFieldName(node.left) === field) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(source));
  return found;
}

function containsSecretLikeLeakage(source: string, field: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) {
      return;
    }

    if (ts.isObjectLiteralExpression(node) && isObjectLiteralOnOutgoingSurface(node) && nodeContainsCredentialReference(node, field)) {
      found = true;
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const root = expressionRootName(node.left);
      if (assignedFieldName(node.left) === field && (runtimePayloadNames as readonly string[]).includes(root ?? "")) {
        found = true;
        return;
      }
      if ((runtimePayloadNames as readonly string[]).includes(root ?? "") && nodeContainsCredentialReference(node.right, field)) {
        found = true;
        return;
      }
      if (node.left.getText() === "document.cookie" && nodeContainsCredentialReference(node.right, field)) {
        found = true;
        return;
      }
    }
    if (ts.isVariableDeclaration(node) && staticPropertyName(node.name) && node.initializer) {
      if ((runtimePayloadNames as readonly string[]).includes(staticPropertyName(node.name) ?? "") && nodeContainsCredentialReference(node.initializer, field)) {
        found = true;
        return;
      }
    }
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && isCredentialSinkCall(node)) {
      if ((node.arguments ?? []).some(argument => nodeContainsCredentialReference(argument, field))) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(source));
  return found;
}

function containsForbiddenSerialization(source: string, field: string): boolean {
  return containsSecretLikeLeakage(source, field);
}

function containsForbiddenRuntimeLeakage(source: string, field: string): boolean {
  return (backendAuthorityFields as readonly string[]).includes(field)
    ? containsBackendAuthorityLeakage(source, field)
    : containsSecretLikeLeakage(source, field);
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
    const sourceFiles = await readSdkSources();

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

  it("classifies ephemeral credential resolver state as safe when it is not an outgoing sink", () => {
    const ephemeralResolverState = `
      function resolveCredential(normalizedToken: string) {
        return { ok: true, token: normalizedToken };
      }
    `;
    const outgoingPayload = `
      const payload = { token: normalizedToken };
    `;

    expect(containsForbiddenRuntimeLeakage(ephemeralResolverState, "token")).toBe(false);
    expect(containsForbiddenRuntimeLeakage(outgoingPayload, "token")).toBe(true);
  });

  it("rejects secret-like fields on actual outgoing assignments including quoted and bracket forms", () => {
    const outgoingAssignments = [
      ["token", "request.token = value"],
      ["accessToken", "body.accessToken = value"],
      ["refreshToken", "pageContext.refreshToken = value"],
      ["credential", "metadata.credential = value"],
      ["secret", "callbackPayload.secret = value"],
      ["token", "providerContext['token'] = value"],
      ["accessToken", "routingMetadata[\"accessToken\"] = value"],
      ["credential", "query.credential = value"],
      ["secret", "persistencePayload['secret'] = value"],
    ] as const;

    for (const [field, source] of outgoingAssignments) {
      expect(containsForbiddenRuntimeLeakage(source, field), source).toBe(true);
    }
  });

  it("rejects credentials in URL, message, logging, telemetry, persistence, and arbitrary-header sinks", () => {
    const sinkExamples = [
      ["token", "const url = `/gateway?token=${token}`"],
      ["accessToken", "new URLSearchParams({ accessToken })"],
      ["credential", "const messageText = `credential=${credential}`"],
      ["secret", "const hiddenPrompt = `secret=${secret}`"],
      ["token", "console.log({ token })"],
      ["credential", "telemetry.track({ credential })"],
      ["accessToken", "localStorage.setItem('auth', accessToken)"],
      ["refreshToken", "sessionStorage.setItem('auth', refreshToken)"],
      ["secret", "indexedDB.put({ secret })"],
      ["token", "document.cookie = `auth=${token}`"],
      ["token", "headers.authorization = `Bearer ${token}`"],
    ] as const;

    for (const [field, source] of sinkExamples) {
      expect(containsForbiddenRuntimeLeakage(source, field), source).toBe(true);
    }
  });

  it("does not smuggle secret-like fields through generic outgoing payload objects", async () => {
    const sourceFiles = await readSdkSources();

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
