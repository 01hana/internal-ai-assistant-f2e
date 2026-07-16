import ChatWidget from "../../../../app/features/assistant/components/ChatWidget.vue";

export const frontend001ChatWidgetAdapter = {
  component: ChatWidget,
} as const;

export type Frontend001ChatWidgetAdapter =
  typeof frontend001ChatWidgetAdapter;
