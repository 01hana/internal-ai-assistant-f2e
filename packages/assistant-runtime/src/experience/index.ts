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

/** Frontend 003: the configured greeting shown as the first assistant message of a new session (local only). */
export interface AssistantGreetingMessage {
  key: string;
  kind: "assistant_greeting";
  role: "assistant";
  content: string;
  createdAt: string;
  choices: AssistantChoice[];
}

export function createAssistantGreetingMessage(
  sessionId: string,
  opening: AssistantOpening,
  createdAt: string,
): AssistantGreetingMessage {
  return {
    key: `local-greeting:${sessionId}`,
    kind: "assistant_greeting",
    role: "assistant",
    content: opening.greeting,
    createdAt,
    choices: [...opening.quickReplies],
  };
}

export function isAssistantGreetingMessage(value: unknown): value is AssistantGreetingMessage {
  return isRecord(value) && value.kind === "assistant_greeting";
}

function messageChoices(message: unknown): AssistantChoice[] {
  if (!isRecord(message)) return [];
  if (message.kind === "assistant_greeting" && Array.isArray(message.choices)) return message.choices as AssistantChoice[];
  if (message.kind === "assistant_streaming" && message.status === "completed" && Array.isArray(message.suggestions)) {
    return message.suggestions as AssistantChoice[];
  }
  return [];
}

function isRejectedChoiceTurn(message: unknown): boolean {
  return isRecord(message) && (message.kind === "user" || message.role === "user") && typeof message.notice === "string";
}

/**
 * Choices are offered only under the latest message, and only when that message is the greeting or a
 * completed answer. Sending anything appends a user message, so older choices disappear on their own.
 * A turn whose choice was rejected (it carries a notice and got no answer) is skipped, so the remaining
 * choices stay available.
 */
export function resolveLatestAssistantChoices(
  messages: readonly unknown[],
): { messageKey: string; choices: AssistantChoice[] } | null {
  let index = messages.length - 1;
  while (index >= 0 && isRejectedChoiceTurn(messages[index])) index -= 1;
  const last = messages[index];
  const choices = messageChoices(last);

  return choices.length > 0 && isRecord(last) && typeof last.key === "string"
    ? { messageKey: last.key, choices }
    : null;
}

/** Removes a choice the server no longer accepts from every message that offers it. */
export function withoutAssistantChoice<TMessage>(messages: readonly TMessage[], choiceId: string): TMessage[] {
  return messages.map((message) => {
    if (!isRecord(message)) return message;
    if (message.kind === "assistant_greeting" && Array.isArray(message.choices)) {
      return { ...message, choices: (message.choices as AssistantChoice[]).filter((choice) => choice.id !== choiceId) } as TMessage;
    }
    if (message.kind === "assistant_streaming" && Array.isArray(message.suggestions)) {
      return { ...message, suggestions: (message.suggestions as AssistantChoice[]).filter((choice) => choice.id !== choiceId) } as TMessage;
    }
    return message;
  });
}
