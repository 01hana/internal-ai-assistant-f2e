export interface RequestIdGeneratorOptions {
  prefix?: string;
  randomUUID?: () => string;
  now?: () => number;
}

let fallbackCounter = 0;

export function normalizeAssistantToken(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function getRuntimeRandomUUID(): (() => string) | null {
  if (
    typeof globalThis.crypto !== "undefined"
    && typeof globalThis.crypto.randomUUID === "function"
  ) {
    return () => globalThis.crypto.randomUUID();
  }

  return null;
}

export function generateAssistantRequestId(
  options: RequestIdGeneratorOptions = {},
): string {
  const prefix = normalizeAssistantToken(options.prefix ?? "req", "req");
  const randomUUID = options.randomUUID ?? getRuntimeRandomUUID();

  if (randomUUID) {
    try {
      return `${prefix}-${normalizeAssistantToken(randomUUID(), "id")}`;
    }
    catch {
      // Fall through to the deterministic environment-safe fallback.
    }
  }

  fallbackCounter += 1;
  const timestamp = (options.now?.() ?? Date.now()).toString(36);
  return `${prefix}-${timestamp}-${fallbackCounter.toString(36)}`;
}
