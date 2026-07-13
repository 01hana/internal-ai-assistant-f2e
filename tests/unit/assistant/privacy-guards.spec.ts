import { readFile } from "node:fs/promises";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import { useAssistantSessionStore } from "../../../app/stores/assistant/useSessionStore";
import type {
  AssistantStreamingUiMessage,
  EvidenceNormalizationInput,
  PageContext,
} from "../../../app/types/assistant";
import { normalizeEvidenceReferences } from "../../../app/utils/assistant/evidenceNormalizationAdapter";
import { sanitizePageContext } from "../../../app/utils/assistant/pageContextSanitizer";
import {
  createSessionStorageSessionMap,
  type AssistantSessionStorageLike,
} from "../../../app/utils/assistant/sessionStorageSessionMap";

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: AssistantSessionStorageLike = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };

  return { storage, values };
}

describe("Final Phase privacy guardrails", () => {
  it("persists only a minimal versioned session pointer in sessionStorage continuity", () => {
    const { storage, values } = createMemoryStorage();
    const sessionMap = createSessionStorageSessionMap({ storage });
    const scopeKey = "actor:org:erp-web:page:orders";

    sessionMap.write(scopeKey, "session-001");

    const storageKey = `internal-assistant:session:${encodeURIComponent(scopeKey)}`;
    const storedPointer = JSON.parse(values.get(storageKey) ?? "{}");

    expect(storedPointer).toEqual({
      version: 1,
      sessionId: "session-001",
    });
    expect(storedPointer).not.toHaveProperty("pageContext");
    expect(storedPointer).not.toHaveProperty("history");
    expect(storedPointer).not.toHaveProperty("identityHeaders");
  });

  it("sanitizes page context to id-only selected rows and removes sensitive payload fields without mutating the source input", () => {
    const rawPageContext: PageContext = {
      route: " /orders?status=pending ",
      entityId: " SO-20002 ",
      selectedRows: [
        {
          id: " SO-20002 ",
          orderNumber: "SO-20002",
          status: "pending",
          secret: "should-strip",
          nested: { internal: true },
        } as unknown as PageContext["selectedRows"][number],
        {
          id: "   ",
        } as unknown as PageContext["selectedRows"][number],
      ],
      activeFilters: [
        {
          field: "status",
          value: "pending",
        },
        {
          field: "apiKey",
          value: "SECRET",
        },
      ],
      visibleColumns: ["orderNumber", "status", "apiKey"],
      userVisibleState: {
        pageSize: 20,
        rawPayload: "should-strip",
        stack: "should-strip",
      },
    };

    const sanitized = sanitizePageContext(rawPageContext);

    expect(sanitized).toEqual({
      route: "/orders",
      entityId: "SO-20002",
      selectedRows: [{ id: "SO-20002" }],
      activeFilters: [
        {
          field: "status",
          value: "pending",
        },
      ],
      visibleColumns: ["orderNumber", "status"],
      userVisibleState: {
        pageSize: 20,
      },
    });
    expect(rawPageContext.selectedRows?.[0]).toMatchObject({
      orderNumber: "SO-20002",
      secret: "should-strip",
    });
  });

  it("normalizes evidence without inventing titles or retaining raw payload fields", () => {
    expect(
      normalizeEvidenceReferences(["evidence-001"]),
    ).toEqual([
      {
        kind: "reference",
        id: "evidence-001",
      },
    ]);

    const normalized = normalizeEvidenceReferences([
      {
        id: "evidence-002",
        sourceType: "document_chunk",
        sourceId: "orders",
        title: "安全摘要",
        snippet: "只保留安全摘要。",
        rawEvidence: {
          keepOut: true,
        },
        rawToolOutput: "SECRET",
        fullDocumentText: "FULL TEXT",
      },
    ] as unknown as EvidenceNormalizationInput);

    expect(normalized).toEqual([
      {
        kind: "summary",
        id: "evidence-002",
        sourceType: "document_chunk",
        sourceId: "orders",
        title: "安全摘要",
        snippet: "只保留安全摘要。",
      },
    ]);
    expect(normalized[0]).not.toHaveProperty("rawEvidence");
    expect(normalized[0]).not.toHaveProperty("rawToolOutput");
    expect(normalized[0]).not.toHaveProperty("fullDocumentText");
  });

  it("clears message-level UI state on session reset instead of persisting assistant interaction details", () => {
    setActivePinia(createPinia());
    const store = useAssistantSessionStore();

    store.startFeedbackSubmission("message-001", "helpful", "req-feedback-001");
    store.startActionDraftDetailLoad("action-draft-001", {
      messageId: "message-001",
    });
    store.ensureApprovalRequestState("approval-request-001", {
      messageId: "message-001",
    });

    const streamingMessage: AssistantStreamingUiMessage = {
      key: "stream:req-001",
      kind: "assistant_streaming",
      role: "assistant",
      content: "partial",
      createdAt: "2026-07-11T09:00:00.000Z",
      status: "streaming",
      lastSequence: 1,
      evidence: [],
      requestId: "req-001",
      messageId: "message-001",
    };
    store.appendAssistantStreamingPlaceholder(streamingMessage);

    store.resetSessionState();

    expect(store.feedbackByMessageId).toEqual({});
    expect(store.actionDraftById).toEqual({});
    expect(store.approvalRequestById).toEqual({});
    expect(store.messages).toEqual([]);
    expect(store.activeRequestId).toBeNull();
  });

  it("keeps feedback submission limited to rating and intent without comment/reason side channels", async () => {
    const source = await readFile(
      new URL(
        "../../../app/features/assistant/composables/useChat.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const submitFeedbackSection = source.slice(
      source.indexOf("async function submitFeedback"),
      source.indexOf("async function openApprovalDetail"),
    );

    expect(submitFeedbackSection).toContain("mapFeedbackValueToRequest(input.value)");
    expect(submitFeedbackSection).not.toMatch(/\breason\s*:/);
    expect(submitFeedbackSection).not.toMatch(/\bcomment\s*:/);
    expect(submitFeedbackSection).not.toContain("console.");
  });

  it("does not implement localStorage as the assistant session continuity strategy", async () => {
    const source = await readFile(
      new URL(
        "../../../app/utils/assistant/sessionStorageSessionMap.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("window.sessionStorage");
    expect(source).not.toContain("localStorage");
  });
});
