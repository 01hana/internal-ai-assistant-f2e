import type { AssistantAccessTokenProvider } from "../types/public";
import { toTransportFailure } from "./transportErrors";

export type AccessTokenResolution =
  | { readonly ok: true; readonly token: string }
  | ReturnType<typeof toTransportFailure>;

/**
 * Resolves an opaque Host credential for exactly one future transport operation.
 * It deliberately does not inspect, persist, or cache the token.
 */
export async function resolveAccessToken(
  getAccessToken: AssistantAccessTokenProvider | undefined,
): Promise<AccessTokenResolution> {
  if (!getAccessToken) {
    return toTransportFailure("authentication_unavailable");
  }

  try {
    const token = await getAccessToken();
    const normalizedToken = typeof token === "string" ? token.trim() : "";

    return normalizedToken
      ? { ok: true, token: normalizedToken }
      : toTransportFailure("authentication_unavailable");
  }
  catch {
    return toTransportFailure("authentication_unavailable");
  }
}
