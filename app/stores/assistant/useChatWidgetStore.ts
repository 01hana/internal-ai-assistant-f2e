import { defineStore, getActivePinia } from "pinia";
import type { AssistantPanelAvailability } from "../../types/assistant";
import {
  createAssistantRuntimeStores,
  resetAssistantRuntimeWidgetState,
} from "../../../packages/assistant-runtime/src";
import { FRONTEND001_RUNTIME_SCOPE } from "./useSessionStore";

export interface AssistantChatWidgetState {
  isOpen: boolean;
  availability: AssistantPanelAvailability;
}

export const useChatWidgetStore = defineStore("assistant-chat-widget", () => {
  const activePinia = getActivePinia();

  if (!activePinia) {
    throw new Error("assistant_frontend001_pinia_required");
  }

  const widgetState = createAssistantRuntimeStores({
    pinia: activePinia,
    runtimeScope: FRONTEND001_RUNTIME_SCOPE,
  }).widget;
  const isOpen = widgetState.isOpen;
  const availability =
    widgetState.availability as Ref<AssistantPanelAvailability>;

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  function toggle() {
    isOpen.value = !isOpen.value;
  }

  function setAvailability(nextAvailability: AssistantPanelAvailability) {
    availability.value = nextAvailability;
  }

  function reset() {
    resetAssistantRuntimeWidgetState(widgetState);
  }

  return {
    isOpen,
    availability,
    open,
    close,
    toggle,
    setAvailability,
    reset,
  };
});
