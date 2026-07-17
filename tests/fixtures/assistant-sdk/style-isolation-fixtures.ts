export const forbiddenGlobalStyleSelectors = [
  "*",
  "html",
  "body",
  "button",
  "input",
  "table",
  "a",
] as const;

export const requiredStyleSignals = [
  "--assistant-sdk-",
  ".assistant-sdk-root",
  "data-theme",
  "data-position",
  "assistant-sdk-launcher",
  "assistant-sdk-panel",
  "z-index",
  "focus-visible",
] as const;

export function selectorPattern(selector: string) {
  return new RegExp(`(^|})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[{,]`, "m");
}

