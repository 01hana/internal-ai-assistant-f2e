import {
  answeredIdOnlyStream,
  clarificationStream,
  interruptedStreamSeed,
  noEvidenceStream,
  permissionDeniedStream,
  toolFailureStream,
} from "../assistant-sse/events";
import type { AssistantSseEventInput } from "../../../app/types/assistant";

export type CanonicalSseOutcomeName =
  | "completed-answer"
  | "no-answer"
  | "clarification"
  | "permission-denied"
  | "tool-failure"
  | "timeout"
  | "interrupted";

export type CanonicalSseOutcomeFixture = {
  readonly events: readonly AssistantSseEventInput[];
  readonly expectedText: RegExp;
  readonly name: CanonicalSseOutcomeName;
  readonly terminationMode: "final" | "eof-before-final" | "inactivity";
};

function toSseFrame(event: AssistantSseEventInput): string {
  return `event: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`;
}

// This adapter only turns canonical Frontend 001 events into a browser fetch
// response; terminationMode remains test orchestration metadata.
export function createCanonicalSseResponse(fixture: CanonicalSseOutcomeFixture): Response {
  const encoder = new TextEncoder();
  const responseText = fixture.events.map(toSseFrame).join("");

  function createBody(): ReadableStream<Uint8Array> {
    return {
      getReader() {
        let sent = false;
        let cancelled = false;

        return {
          async cancel() {
            cancelled = true;
          },
          async read() {
            if (cancelled) {
              return { done: true, value: undefined };
            }

            if (!sent) {
              sent = true;

              if (fixture.terminationMode !== "inactivity") {
                return {
                  done: false,
                  value: encoder.encode(responseText),
                };
              }
            }

            if (fixture.terminationMode === "inactivity") {
              return await new Promise<ReadableStreamReadResult<Uint8Array>>(() => {
                // Keep the stream open so Shared Runtime timeout remains inactivity-based.
              });
            }

            return { done: true, value: undefined };
          },
          releaseLock() {
            // The shared runner does not require this, but real readers expose it.
          },
        };
      },
    } as unknown as ReadableStream<Uint8Array>;
  }

  const response = new Response(null, {
    headers: {
      "content-type": "text/event-stream",
    },
    status: 200,
  });

  return new Proxy(response, {
    get(target, property, receiver) {
      if (property === "body") {
        return createBody();
      }

      if (property === "text") {
        return async () => responseText;
      }

      const value = Reflect.get(target, property, receiver);

      return typeof value === "function"
        ? value.bind(target)
        : value;
    },
  });
}

export function createCanonicalSseOutcomeFixture(name: CanonicalSseOutcomeName): CanonicalSseOutcomeFixture {
  switch (name) {
    case "completed-answer":
      return {
        events: answeredIdOnlyStream,
        expectedText: /SO-10001.*confirmed/i,
        name,
        terminationMode: "final",
      };
    case "no-answer":
      return {
        events: noEvidenceStream,
        expectedText: /沒有足夠證據|no.?answer/i,
        name,
        terminationMode: "final",
      };
    case "clarification":
      return {
        events: clarificationStream,
        expectedText: /指定要查詢哪一筆|clarification/i,
        name,
        terminationMode: "final",
      };
    case "permission-denied":
      return {
        events: permissionDeniedStream,
        expectedText: /沒有權限|permission/i,
        name,
        terminationMode: "final",
      };
    case "tool-failure":
      return {
        events: toolFailureStream,
        expectedText: /無法安全產生確定答案|tool/i,
        name,
        terminationMode: "final",
      };
    case "timeout":
      return {
        events: [],
        expectedText: /回覆失敗|timed out|timeout|逾時/i,
        name,
        terminationMode: "inactivity",
      };
    case "interrupted":
      return {
        events: interruptedStreamSeed,
        expectedText: /interrupted|中斷/i,
        name,
        terminationMode: "eof-before-final",
      };
  }
}
