import type { AssistantPanelAvailability } from "../../types/assistant";

export interface AssistantChatWidgetState {
  isOpen: boolean;
  availability: AssistantPanelAvailability;
}

export const useChatWidgetStore = defineStore("assistant-chat-widget", () => {
  const isOpen = ref(false);
  const availability = ref<AssistantPanelAvailability>("normal");

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
    isOpen.value = false;
    availability.value = "normal";
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
