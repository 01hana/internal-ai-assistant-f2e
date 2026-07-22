import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  accumulateAssistantAnswerDelta,
  AssistantSseParser,
  createAssistantSseStreamRunner,
  parseAssistantSseText,
  resolveAssistantSseTerminalReason,
} from "../../../packages/assistant-runtime/src/sse";
import type { AssistantSseEventInput } from "../../../packages/assistant-runtime/src/types";
import {
  answerDeltaEvent,
  errorEvent,
  finalAnsweredIdOnlyEvent,
  finalToolFailureEvent,
  unknownEvent,
} from "../../fixtures/assistant-sse/events";

const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const sharedSsePath = path.join(repoRoot, "packages/assistant-runtime/src/sse/index.ts");
const sdkSourceRoot = path.join(repoRoot, "packages/assistant-sdk/src");
const frontend001ParserPath = path.join(repoRoot, "app/utils/assistant/assistantSseParser.ts");
const frontend001StreamPath = path.join(repoRoot, "app/features/assistant/composables/useAssistantSseStream.ts");

function toSseFrame(event: AssistantSseEventInput, trailingBlankLine = true): string {
  const frame = [
    `event: ${event.eventType}`,
    `data: ${JSON.stringify(event)}`,
  ].join("\n");

  return trailingBlankLine ? `${frame}\n\n` : frame;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    const stats = statSync(absolute);
    return stats.isDirectory()
      ? listSourceFiles(absolute)
      : /\.(ts|vue)$/.test(entry) ? [absolute] : [];
  });
}

async function waitFor(
  predicate: () => boolean,
  message = "condition was not reached",
): Promise<void> {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }

  throw new Error(message);
}

describe("assistant-runtime canonical SSE stream model", () => {
  it("parses canonical delta, final, error, unknown, malformed, and ignored events", () => {
    const duplicateDelta = toSseFrame(answerDeltaEvent);
    const results = parseAssistantSseText([
      duplicateDelta,
      duplicateDelta,
      toSseFrame(unknownEvent),
      "event: final\ndata: {invalid-json}\n\n",
      toSseFrame(errorEvent),
      toSseFrame(finalToolFailureEvent),
    ].join(""));

    expect(results.map(result => result.kind)).toEqual([
      "event",
      "ignored_event",
      "unknown_event",
      "malformed_event",
      "event",
      "event",
    ]);
  });

  it("buffers partial frames and flushes EOF-before-final as interrupted semantics", () => {
    const parser = new AssistantSseParser();
    const input = toSseFrame(finalAnsweredIdOnlyEvent, false);

    expect(parser.push(input.slice(0, 12))).toEqual([]);
    expect(parser.push(input.slice(12))).toEqual([]);
    expect(parser.flush()[0]).toMatchObject({
      kind: "event",
      eventName: "final",
    });

    expect(resolveAssistantSseTerminalReason({ finalReceived: false, eof: true })).toBe("interrupted");
  });

  it("keeps timeout inactivity-based and not an invented SSE event", () => {
    expect(resolveAssistantSseTerminalReason({ finalReceived: false, timedOut: true })).toBe("timeout");
    expect(resolveAssistantSseTerminalReason({ finalReceived: true, timedOut: true })).toBe("completed");
  });

  it("accumulates answer deltas without owning transport or request envelopes", () => {
    expect(accumulateAssistantAnswerDelta("", answerDeltaEvent)).toBe(answerDeltaEvent.data.delta);

    const sharedSource = readFileSync(sharedSsePath, "utf8");
    expect(sharedSource).not.toMatch(/\bfetch\b|\$fetch|useRuntimeConfig|requestBuilder|endpoint|identityHeaders/);
  });

  it("does not add a package-level SDK SSE parser", () => {
    const violations = listSourceFiles(sdkSourceRoot).filter((file) => {
      const relative = path.relative(repoRoot, file).split(path.sep).join("/");
      const source = readFileSync(file, "utf8");
      return /sse.*parser/i.test(relative) || /\bparseAssistantSseText\b|\bnew AssistantSseParser\b/.test(source);
    });

    expect(violations).toEqual([]);
  });

  it("keeps Frontend 001 parser as a shared-runtime re-export and stream composable as adapter-only source", () => {
    const parserSource = readFileSync(frontend001ParserPath, "utf8");
    const streamSource = readFileSync(frontend001StreamPath, "utf8");

    expect(parserSource).toContain("packages/assistant-runtime/src/sse");
    expect(parserSource).not.toMatch(/class\s+AssistantSseParser|parseField|dispatchFrame|JSON\.parse/);

    expect(streamSource).toContain("createAssistantSseStreamRunner");
    expect(streamSource).toContain("sendMessageStream");
    expect(streamSource).not.toMatch(/new\s+AssistantSseParser|\.getReader\(|while\s*\(|setTimeout|clearTimeout|AbortController|ReadableStreamDefaultReader/);
  });

  it("owns inactivity timeout reset and prevents timeout after final in shared runtime", async () => {
    vi.useFakeTimers();

    try {
      let streamController!: ReadableStreamDefaultController<Uint8Array>;
      const encoder = new TextEncoder();
      const statusChanges: string[] = [];
      const timeoutCallback = vi.fn();
      const runner = createAssistantSseStreamRunner<void>({
        inactivityTimeoutMs: 1_000,
        async openStream() {
          return new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          });
        },
        callbacks: {
          onTimeout: timeoutCallback,
        },
        state: {
          onStatusChange(status) {
            statusChanges.push(status);
          },
        },
      });

      const startPromise = runner.start();
      await waitFor(() => statusChanges.includes("streaming"));

      await vi.advanceTimersByTimeAsync(999);
      streamController.enqueue(encoder.encode(toSseFrame(answerDeltaEvent)));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(999);

      expect(statusChanges).not.toContain("timeout");
      expect(timeoutCallback).not.toHaveBeenCalled();

      streamController.enqueue(encoder.encode(toSseFrame(finalAnsweredIdOnlyEvent)));
      await Promise.resolve();
      await startPromise;
      await vi.advanceTimersByTimeAsync(1_000);

      expect(runner.getStatus()).toBe("completed");
      expect(statusChanges).not.toContain("timeout");
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("removes timers and external abort listeners during cancel/reset cleanup", async () => {
    vi.useFakeTimers();

    try {
      const externalController = new AbortController();
      const addListener = vi.spyOn(externalController.signal, "addEventListener");
      const removeListener = vi.spyOn(externalController.signal, "removeEventListener");
      const readerCancel = vi.fn();
      const runner = createAssistantSseStreamRunner<void>({
        inactivityTimeoutMs: 1_000,
        async openStream() {
          return new ReadableStream<Uint8Array>({
            start() {},
            cancel: readerCancel,
          });
        },
      });

      const startPromise = runner.start(undefined, {
        externalSignal: externalController.signal,
      });
      await waitFor(() => runner.getStatus() === "streaming");

      await runner.cancel();
      await startPromise;
      await vi.advanceTimersByTimeAsync(1_000);

      expect(readerCancel).toHaveBeenCalledOnce();
      expect(addListener).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
      expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      expect(runner.getStatus()).toBe("aborted");

      await runner.reset();
      expect(runner.getStatus()).toBe("idle");
      expect(runner.getResults()).toEqual([]);
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("treats EOF before final as interrupted in the shared stream runner", async () => {
    const interrupted = vi.fn();
    const encoder = new TextEncoder();
    const runner = createAssistantSseStreamRunner<void>({
      async openStream() {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(toSseFrame(answerDeltaEvent)));
            controller.close();
          },
        });
      },
      callbacks: {
        onInterrupted: interrupted,
      },
    });

    await runner.start();

    expect(runner.getStatus()).toBe("interrupted");
    expect(interrupted).toHaveBeenCalledWith({
      code: "stream_interrupted",
      safeMessage: "The assistant stream ended before a final result.",
    });
  });
});
