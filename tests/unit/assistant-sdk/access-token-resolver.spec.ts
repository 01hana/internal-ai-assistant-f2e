import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { resolveAccessToken } from "../../../packages/assistant-sdk/src/transport/accessTokenResolver";

const repoRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const resolverSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/transport/accessTokenResolver.ts");
const gatewayTransportSourcePath = path.join(repoRoot, "packages/assistant-sdk/src/transport/defaultTransport.ts");

describe("SDK request-scoped access token resolver", () => {
  it("accepts synchronous and asynchronous opaque tokens, trimming surrounding whitespace", async () => {
    await expect(resolveAccessToken(() => "token-sync")).resolves.toEqual({ ok: true, token: "token-sync" });
    await expect(resolveAccessToken(async () => "  token-async  ")).resolves.toEqual({ ok: true, token: "token-async" });
  });

  it.each([
    [undefined],
    [() => null],
    [() => undefined],
    [() => ""],
    [() => "   "],
  ] as const)("fails closed when the credential is unavailable", async (getAccessToken) => {
    await expect(resolveAccessToken(getAccessToken)).resolves.toEqual({
      error: { code: "authentication_unavailable", userMessage: "integration error" },
      ok: false,
    });
  });

  it("contains getter failures without exposing the raw error", async () => {
    const sentinel = "RAW_ACCESS_TOKEN_FAILURE_SENTINEL";

    for (const getAccessToken of [
      () => { throw new Error(sentinel); },
      async () => await Promise.reject(new Error(sentinel)),
    ]) {
      const result = await resolveAccessToken(getAccessToken);

      expect(result).toEqual({
        error: { code: "authentication_unavailable", userMessage: "integration error" },
        ok: false,
      });
      expect(JSON.stringify(result)).not.toContain(sentinel);
    }
  });

  it("calls the getter on every operation without a mount-lifetime cache", async () => {
    const getAccessToken = vi.fn()
      .mockResolvedValueOnce("token-A")
      .mockResolvedValueOnce("token-B");

    await expect(resolveAccessToken(getAccessToken)).resolves.toEqual({ ok: true, token: "token-A" });
    await expect(resolveAccessToken(getAccessToken)).resolves.toEqual({ ok: true, token: "token-B" });
    expect(getAccessToken).toHaveBeenCalledTimes(2);
  });

  it("keeps Gateway credential handling opaque and free of local identity or token persistence", () => {
    const source = [
      readFileSync(resolverSourcePath, "utf8"),
      readFileSync(gatewayTransportSourcePath, "utf8"),
    ].join("\n");

    expect(source).not.toMatch(/\bjwt\b|decode|atob|UUID_Company|Permissions|customer(?:Id)?\s*[:=]/i);
    expect(source).not.toMatch(/localStorage|sessionStorage|cachedAccessToken|resolvedToken|authTokenState/);
    expect(source).not.toMatch(/x-(?:actor-id|organization-id|host-app|role|permission-scopes|customer-id)/i);
  });
});
