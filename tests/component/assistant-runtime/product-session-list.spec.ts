import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import AssistantProductPanelShell from "../../../packages/assistant-runtime/src/components/product-ui/AssistantProductPanelShell.vue";
import AssistantProductSessionList from "../../../packages/assistant-runtime/src/components/product-ui/AssistantProductSessionList.vue";

/** Frontend 003 Phase 3 (T018, T019, T022): history entry in the panel header and the session list view. */
const sessions = [
  { sessionId: "s-1", title: "查詢訂單 SO-10001 狀態", createdAt: "2026-11-16T02:00:00.000Z", lastMessageAt: "2026-11-16T02:05:00.000Z" },
  { sessionId: "s-2", title: null, createdAt: "2026-11-01T02:00:00.000Z", lastMessageAt: "2026-11-01T02:05:00.000Z" },
];

describe("panel header history entry (T018)", () => {
  const shell = (props: Record<string, unknown>) => mount(AssistantProductPanelShell, { props: { status: "AI 助理已就緒", ...props } });

  it("shows the history button only when history is available", () => {
    expect(shell({}).find("[data-testid='assistant-panel-history']").exists()).toBe(false);
    const button = shell({ showHistory: true }).get("[data-testid='assistant-panel-history']");
    expect(button.attributes("aria-label")).toBe("對話紀錄");
  });

  it("replaces the history and restart buttons with a back button in the list view", async () => {
    const wrapper = shell({ showHistory: true, historyOpen: true });
    expect(wrapper.find("[data-testid='assistant-panel-history']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='assistant-panel-restart']").exists()).toBe(false);
    const back = wrapper.get("[data-testid='assistant-panel-back']");
    expect(back.attributes("aria-label")).toBe("返回對話");
    await back.trigger("click");
    expect(wrapper.emitted("back")).toHaveLength(1);
  });

  it("emits history when the history button is clicked", async () => {
    const wrapper = shell({ showHistory: true });
    await wrapper.get("[data-testid='assistant-panel-history']").trigger("click");
    expect(wrapper.emitted("history")).toHaveLength(1);
  });
});

describe("session list (T019, T022)", () => {
  const list = (props: Record<string, unknown> = {}) => mount(AssistantProductSessionList, { props: { sessions, ...props }, attachTo: document.body });

  it("lists titles, a fallback title, the current session and a time", () => {
    const wrapper = list({ currentSessionId: "s-1" });
    const items = wrapper.findAll("[data-testid='assistant-session-list-item']");
    expect(items).toHaveLength(2);
    expect(items[0].text()).toContain("查詢訂單 SO-10001 狀態");
    expect(items[0].find("[data-testid='assistant-session-current']").exists()).toBe(true);
    expect(items[0].get("[data-testid='assistant-session-open']").attributes("aria-current")).toBe("true");
    expect(items[0].get("time").attributes("datetime")).toBe("2026-11-16T02:05:00.000Z");
    expect(items[1].text()).toContain("未命名對話");
    wrapper.unmount();
  });

  it("emits open with the session ID", async () => {
    const wrapper = list();
    await wrapper.findAll("[data-testid='assistant-session-open']")[1].trigger("click");
    expect(wrapper.emitted("open")).toEqual([["s-2"]]);
    wrapper.unmount();
  });

  it("asks for confirmation before archiving and can be cancelled", async () => {
    const wrapper = list();
    await wrapper.findAll("[data-testid='assistant-session-archive']")[0].trigger("click");
    expect(wrapper.text()).toContain("確定封存？");
    expect(wrapper.emitted("archive")).toBeUndefined();
    // Archive confirms with the primary (blue) button; only delete uses the danger (red) one.
    expect(wrapper.get("[data-testid='assistant-session-archive-confirm']").classes()).toContain("assistant-session-list-action--primary");

    await wrapper.get("[data-testid='assistant-session-archive-cancel']").trigger("click");
    expect(wrapper.text()).not.toContain("確定封存？");

    await wrapper.findAll("[data-testid='assistant-session-archive']")[0].trigger("click");
    await wrapper.get("[data-testid='assistant-session-archive-confirm']").trigger("click");
    expect(wrapper.emitted("archive")).toEqual([["s-1"]]);
    wrapper.unmount();
  });

  it("shows delete next to archive only when enabled, with its own confirmation", async () => {
    expect(list().find("[data-testid='assistant-session-delete']").exists()).toBe(false);

    const wrapper = list({ showDelete: true });
    const first = wrapper.findAll("[data-testid='assistant-session-list-item']")[0];
    const icons = first.findAll(".assistant-session-list-item-icons button").map((button) => button.attributes("data-testid"));
    expect(icons).toEqual(["assistant-session-archive", "assistant-session-delete"]);
    expect(first.get("[data-testid='assistant-session-delete']").attributes("aria-label")).toBe("刪除「查詢訂單 SO-10001 狀態」");

    await first.get("[data-testid='assistant-session-delete']").trigger("click");
    expect(wrapper.text()).toContain("確定刪除？刪除後無法復原。");
    expect(wrapper.get("[data-testid='assistant-session-delete-confirm']").classes()).toContain("assistant-session-list-action--danger");
    await wrapper.get("[data-testid='assistant-session-delete-cancel']").trigger("click");
    expect(wrapper.emitted("delete")).toBeUndefined();

    await wrapper.findAll("[data-testid='assistant-session-delete']")[0].trigger("click");
    await wrapper.get("[data-testid='assistant-session-delete-confirm']").trigger("click");
    expect(wrapper.emitted("delete")).toEqual([["s-1"]]);
    expect(wrapper.emitted("archive")).toBeUndefined();
    wrapper.unmount();
  });

  it("shows the 對話 / 已封存 switch only when the archived view is available", async () => {
    expect(list().find("[data-testid='assistant-session-view-archived']").exists()).toBe(false);

    const wrapper = list({ showArchivedView: true });
    expect(wrapper.get("[data-testid='assistant-session-view-active']").attributes("aria-pressed")).toBe("true");
    expect(wrapper.get("[data-testid='assistant-session-view-archived']").attributes("aria-pressed")).toBe("false");
    await wrapper.get("[data-testid='assistant-session-view-active']").trigger("click");
    expect(wrapper.emitted("switchView")).toBeUndefined();
    await wrapper.get("[data-testid='assistant-session-view-archived']").trigger("click");
    expect(wrapper.emitted("switchView")).toEqual([["archived"]]);
    wrapper.unmount();
  });

  it("shows archived rows without an open action, with unarchive and delete", async () => {
    const wrapper = list({ view: "archived", showArchivedView: true, showDelete: true });
    const first = wrapper.findAll("[data-testid='assistant-session-list-item']")[0];
    expect(first.find("[data-testid='assistant-session-open']").exists()).toBe(false);
    expect(first.find("[data-testid='assistant-session-archive']").exists()).toBe(false);
    expect(first.text()).toContain("查詢訂單 SO-10001 狀態");
    const icons = first.findAll(".assistant-session-list-item-icons button").map((button) => button.attributes("data-testid"));
    expect(icons).toEqual(["assistant-session-unarchive", "assistant-session-delete"]);
    expect(first.get("[data-testid='assistant-session-unarchive']").attributes("aria-label")).toBe("取消封存「查詢訂單 SO-10001 狀態」");

    await first.get("[data-testid='assistant-session-unarchive']").trigger("click");
    expect(wrapper.emitted("unarchive")).toEqual([["s-1"]]);

    await first.get("[data-testid='assistant-session-delete']").trigger("click");
    await wrapper.get("[data-testid='assistant-session-delete-confirm']").trigger("click");
    expect(wrapper.emitted("delete")).toEqual([["s-1"]]);
    expect(list({ view: "archived", sessions: [] }).get("[data-testid='assistant-session-list-empty']").text()).toBe("沒有已封存的對話");
    wrapper.unmount();
  });

  it("shows loading, empty and error states, and retries", async () => {
    expect(list({ loading: true }).find("[data-testid='assistant-session-list-loading']").exists()).toBe(true);
    expect(list({ sessions: [] }).get("[data-testid='assistant-session-list-empty']").text()).toBe("還沒有對話紀錄");
    const failed = list({ error: "目前無法載入對話紀錄，請稍後再試。" });
    expect(failed.get("[data-testid='assistant-session-list-error']").attributes("role")).toBe("alert");
    expect(failed.get("[data-testid='assistant-session-list-retry']").classes()).toContain("assistant-session-list-action--primary");
    await failed.get("[data-testid='assistant-session-list-retry']").trigger("click");
    expect(failed.emitted("retry")).toHaveLength(1);
  });

  it("offers load more only when there is a next page", async () => {
    expect(list().find("[data-testid='assistant-session-list-more']").exists()).toBe(false);
    const wrapper = list({ hasMore: true });
    await wrapper.get("[data-testid='assistant-session-list-more']").trigger("click");
    expect(wrapper.emitted("loadMore")).toHaveLength(1);
    expect(list({ hasMore: true, loadingMore: true }).get("[data-testid='assistant-session-list-more']").attributes("disabled")).toBeDefined();
  });

  it("shows per-session errors and disables a session while its request is pending", () => {
    const wrapper = list({ itemStates: { "s-1": { pending: true }, "s-2": { error: "目前無法封存這段對話，請稍後再試。" } } });
    const items = wrapper.findAll("[data-testid='assistant-session-list-item']");
    expect(items[0].get("[data-testid='assistant-session-open']").attributes("disabled")).toBeDefined();
    expect(items[0].get("[data-testid='assistant-session-archive']").attributes("disabled")).toBeDefined();
    expect(items[1].get("[data-testid='assistant-session-item-error']").text()).toBe("目前無法封存這段對話，請稍後再試。");
  });

  it("disables opening while switching is not allowed", () => {
    const wrapper = list({ openDisabled: true });
    expect(wrapper.findAll("[data-testid='assistant-session-open']").every((button) => button.attributes("disabled") !== undefined)).toBe(true);
  });

  it("moves focus to the list heading and labels the archive buttons (T022)", async () => {
    const wrapper = list();
    await nextTick(); await nextTick();
    expect(document.activeElement?.id).toBe("assistant-session-list-title");
    expect(wrapper.get("[data-testid='assistant-session-list']").attributes("aria-labelledby")).toBe("assistant-session-list-title");
    expect(wrapper.findAll("[data-testid='assistant-session-archive']")[0].attributes("aria-label")).toBe("封存「查詢訂單 SO-10001 狀態」");
    wrapper.unmount();
  });
});
