import type {
  AssistantChoice,
  AssistantOpening,
  AssistantSessionListItem,
  AssistantSessionListPage,
} from "../types";

/** Same rule as the backend `EXPERIENCE_CHOICE_ID_PATTERN` (Backend Feature 013). */
export const ASSISTANT_CHOICE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MAX_CHOICE_LABEL_LENGTH = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAssistantChoiceId(value: unknown): value is string {
  return typeof value === "string" && ASSISTANT_CHOICE_ID_PATTERN.test(value);
}

function normalizeChoice(value: unknown): AssistantChoice | null {
  if (!isRecord(value) || !isAssistantChoiceId(value.id) || typeof value.label !== "string") {
    return null;
  }

  const label = value.label.trim();

  return label.length > 0 && label.length <= MAX_CHOICE_LABEL_LENGTH ? { id: value.id, label } : null;
}

/**
 * Keeps only well-formed `{ id, label }` choices, first occurrence of each ID.
 * Returns `undefined` when the value is not an array or nothing valid remains, so callers omit the field.
 */
export function normalizeAssistantChoices(value: unknown): AssistantChoice[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const choices: AssistantChoice[] = [];

  for (const item of value) {
    const choice = normalizeChoice(item);

    if (choice && !seen.has(choice.id)) {
      seen.add(choice.id);
      choices.push(choice);
    }
  }

  return choices.length > 0 ? choices : undefined;
}

/** A malformed opening is dropped entirely; malformed Quick Replies are dropped individually. */
export function normalizeAssistantOpening(value: unknown): AssistantOpening | undefined {
  if (!isRecord(value) || typeof value.greeting !== "string" || value.greeting.trim().length === 0) {
    return undefined;
  }

  const configVersion = typeof value.configVersion === "string" ? value.configVersion : null;

  return {
    configVersion,
    greeting: value.greeting.trim(),
    quickReplies: normalizeAssistantChoices(value.quickReplies) ?? [],
  };
}

function isIsoString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function normalizeSessionListItem(value: unknown): AssistantSessionListItem | null {
  if (
    !isRecord(value)
    || typeof value.sessionId !== "string"
    || value.sessionId.trim().length === 0
    || !isIsoString(value.createdAt)
    || !isIsoString(value.lastMessageAt)
  ) {
    return null;
  }

  const title = typeof value.title === "string" && value.title.trim().length > 0 ? value.title : null;

  return { sessionId: value.sessionId, title, createdAt: value.createdAt, lastMessageAt: value.lastMessageAt };
}

/** Returns `null` for a response that is not a session page; malformed entries are dropped. */
export function normalizeAssistantSessionListPage(value: unknown): AssistantSessionListPage | null {
  if (!isRecord(value) || !Array.isArray(value.sessions)) {
    return null;
  }

  const sessions = value.sessions
    .map(normalizeSessionListItem)
    .filter((item): item is AssistantSessionListItem => item !== null);
  const nextCursor = typeof value.nextCursor === "string" && value.nextCursor.length > 0 ? value.nextCursor : null;

  return { sessions, nextCursor };
}
