import * as assistantService from "../../../../app/services/api/assistant";

export const frontend001ServiceAdapter = {
  assistantService,
} as const;

export type Frontend001ServiceAdapter = typeof frontend001ServiceAdapter;
