import { describe, expect, it, vi } from "vitest";
import {
  resolveLatestAssistantSendContext,
} from "../../../app/features/assistant/composables/useChat";
import { useAssistantHostContext } from "../../../app/features/assistant/composables/useAssistantHostContext";
import type {
  AssistantHostContextProvider,
  AssistantHostContextSnapshot,
} from "../../../app/types/assistant";
import {
  entityHostContextSnapshot,
  pageHostContextSnapshot,
} from "../../fixtures/assistant-api/host-context";

describe("retry and resend latest host context", () => {
  it("re-reads PageContext and resolves scope with the retry purpose", async () => {
    const retrySnapshot = {
      ...entityHostContextSnapshot,
      pageContext: {
        ...entityHostContextSnapshot.pageContext,
        route: "/orders/SO-20002?tab=details#summary",
        entityId: "SO-20002",
      },
    } satisfies AssistantHostContextSnapshot;
    const snapshots = [
      pageHostContextSnapshot,
      retrySnapshot,
    ] satisfies AssistantHostContextSnapshot[];
    const provider = {
      getSnapshot: vi.fn(() => snapshots.shift()!),
    } satisfies AssistantHostContextProvider;
    const hostContext = useAssistantHostContext(provider);

    const firstSend = await resolveLatestAssistantSendContext(
      hostContext,
      "send",
    );
    const retry = await resolveLatestAssistantSendContext(
      hostContext,
      "retry",
    );

    expect(provider.getSnapshot).toHaveBeenNthCalledWith(1, {
      purpose: "send",
    });
    expect(provider.getSnapshot).toHaveBeenNthCalledWith(2, {
      purpose: "retry",
    });
    expect(firstSend.snapshot.pageContext).not.toEqual(
      retry.snapshot.pageContext,
    );
    expect(retry.snapshot.pageContext).toMatchObject({
      route: "/orders/SO-20002",
      entityId: "SO-20002",
    });
    expect(firstSend.scope.kind).toBe("page");
    expect(retry.scope).toMatchObject({
      kind: "entity",
      source: "default",
    });
    expect(retry.scope.key).toContain("entity:order:so-20002");
  });
});
