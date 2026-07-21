export const productizedAssistantWidgetShellTexts = [
  "Assistant SDK shell is ready",
  "Runtime bridge will be connected later",
] as const;

export const productizedClosedWidgetRequirements = [
  {
    name: "SDK widget root",
    selectors: [
      ".assistant-sdk-root",
      "[data-assistant-sdk-root]",
    ],
  },
  {
    name: "launcher",
    selectors: [
      "button[aria-label*='assistant' i]",
      ".assistant-sdk-launcher",
      "[data-assistant-launcher]",
    ],
  },
 ] as const;

export const productizedOpenWidgetRequirements = [
  {
    name: "panel or dialog",
    selectors: [
      "[role='dialog']",
      "aside[aria-label*='assistant' i]",
      ".assistant-sdk-panel",
      "[data-assistant-panel]",
    ],
  },
  {
    name: "conversation area",
    selectors: [
      "[role='log']",
      "[aria-label*='conversation' i]",
      "[data-assistant-message-list]",
      ".assistant-message-list",
    ],
  },
  {
    name: "input composer",
    selectors: [
      "textarea",
      "input[type='text']",
      "[contenteditable='true']",
      "[data-assistant-composer]",
    ],
  },
  {
    name: "send action",
    selectors: [
      "button[type='submit']",
      "button[aria-label*='send' i]",
      "[data-assistant-send]",
    ],
  },
] as const;

export const productizedRuntimeStateRequirements = [
  {
    name: "loading or streaming state",
    selectors: [
      "[aria-busy='true']",
      "[data-assistant-streaming]",
      "[data-assistant-loading]",
    ],
  },
  {
    name: "answer or safe status surface",
    selectors: [
      "[data-assistant-answer]",
      "[data-assistant-safe-status]",
      "[aria-label*='answer' i]",
    ],
  },
  {
    name: "error surface",
    selectors: [
      "[role='alert']",
      "[data-assistant-error]",
      "[aria-label*='error' i]",
    ],
  },
] as const;

export const publicSdkImportSpecifiers = [
  "@internal-ai-assistant/assistant-sdk",
  "@internal-ai-assistant/assistant-sdk/styles.css",
] as const;

export const forbiddenProductizedConsumerImportPatterns = [
  /app\/features/,
  /app\/services/,
  /app\/stores/,
  /app\/utils/,
  /packages\/assistant-sdk\/src/,
  /tests\/fixtures/,
  /tests\//,
] as const;

export const forbiddenPackagedRuntimeSourcePatterns = [
  /app\/features/,
  /app\/services/,
  /app\/stores/,
  /app\/utils/,
  /packages\/assistant-sdk\/src/,
  /(^|\/)tests\//,
  /(^|\/)fixtures\//,
  /(^|\/)specs\//,
] as const;

export const forbiddenPhase11PackageExportKeys = [
  "./nuxt",
  "./runtime",
  "./runtime/*",
  "./transport",
  "./transport/*",
  "./session",
  "./session/*",
  "./context",
  "./context/*",
  "./request",
  "./request/*",
  "./fixtures",
  "./tests",
] as const;

export const forbiddenSourcemapSignals = [
  /\.map$/,
  /sourceMappingURL/,
  /sourcesContent/,
] as const;

export const requiredReadmeSections = [
  "Installation",
  "Stylesheet import",
  "AssistantWidget usage",
  "mountAssistantWidget usage",
  "Provider contract",
  "WidgetConfiguration",
  "HostCallbacks / HostEvents",
  "Compatibility Mode",
  "Host Integration Mode",
  "Session lifecycle",
  "Security boundary",
  "Forbidden frontend-owned fields",
  "Backend responsibilities",
  "Troubleshooting",
  "Version compatibility",
  "GitHub Packages install notes",
  "Release notes",
] as const;

export function createPublicOnlyConsumerSource(imports: readonly string[] = publicSdkImportSpecifiers) {
  return [
    `import { AssistantWidget, mountAssistantWidget } from ${JSON.stringify(imports[0])};`,
    `import ${JSON.stringify(imports[1])};`,
    "",
    "export const provider = async () => ({ hostApp: 'phase-11-smoke', pageContext: { route: '/orders/1' } });",
    "export const configuration = { integrationMode: 'backend001-compatibility', theme: 'system' };",
    "export const callbacks = { onAnswerCompleted: () => undefined, onError: () => undefined };",
    "export { AssistantWidget, mountAssistantWidget };",
  ].join("\n");
}

export function hasAnyForbiddenPattern(source: string, patterns: readonly RegExp[]) {
  return patterns.some(pattern => pattern.test(source));
}
