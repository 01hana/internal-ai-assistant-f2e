export const publicSdkPackageName = "@internal-ai-assistant/assistant-sdk";
export const publicSdkStylesheetEntry = "@internal-ai-assistant/assistant-sdk/styles.css";
export const nuxtConfigFile = "nuxt.config.ts";

export const requiredReferenceConsumerImports = [
  "AssistantWidget",
  "mountAssistantWidget",
  "AssistantHostContextProvider",
  "WidgetConfiguration",
  "HostCallbacks",
] as const;

export const pluginTypeImportNames = [
  "AssistantHostContextProvider",
  "HostCallbacks",
  "WidgetConfiguration",
] as const;

export const previewValueImportNames = [
  "AssistantWidget",
  "mountAssistantWidget",
] as const;

export const forbiddenReferenceConsumerImports = [
  "packages/assistant-sdk/src/",
  "packages/assistant-sdk/src/runtime/",
  "packages/assistant-sdk/src/transport/",
  "packages/assistant-sdk/src/session/",
  "packages/assistant-sdk/src/events/",
  "app/features/assistant/",
  "app/services/api/assistant",
  "app/stores/",
  "app/utils/assistant/",
] as const;

export const forbiddenNuxtConfigBoundaryPatterns = [
  /packages\/assistant-sdk\/src\/runtime/,
  /packages\/assistant-sdk\/src\/transport/,
  /packages\/assistant-sdk\/src\/session/,
  /packages\/assistant-sdk\/src\/events/,
  /packages\/assistant-sdk\/src\/request/,
  /packages\/assistant-sdk\/src\/context/,
  /app\/features\/assistant/,
  /app\/services\/api\/assistant/,
  /app\/stores\//,
  /app\/utils\/assistant/,
] as const;

export const forbiddenStringSignalDeclarations = [
  /const\s+AssistantWidget\s*=\s*["']AssistantWidget["']/,
  /const\s+mountAssistantWidget\s*=\s*["']mountAssistantWidget["']/,
  /const\s+assistantSdkPublicEntry\s*=\s*["']@internal-ai-assistant\/assistant-sdk["']/,
  /const\s+assistantSdkStylesheetEntry\s*=\s*["']@internal-ai-assistant\/assistant-sdk\/styles\.css["']/,
] as const;

export const referenceConsumerFiles = [
  "app/plugins/assistant-sdk.client.ts",
  "app/pages/assistant-sdk-preview.vue",
] as const;

export function namedImportBlockFor(source: string, packageName: string, importType?: "type" | "value") {
  const typePart = importType === "type" ? "\\s+type" : importType === "value" ? "(?!\\s+type)" : "(?:\\s+type)?";
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `import${typePart}\\s*\\{(?<imports>[\\s\\S]*?)\\}\\s*from\\s*["']${escapedPackageName}["']`,
    "m",
  );

  return pattern.exec(source)?.groups?.imports;
}

export function hasPublicSdkNamedImport(
  source: string,
  symbols: readonly string[],
  importType?: "type" | "value",
) {
  const imports = namedImportBlockFor(source, publicSdkPackageName, importType);

  if (!imports) {
    return false;
  }

  return symbols.every(symbol => new RegExp(`\\b${symbol}\\b`).test(imports));
}

export function hasSdkStylesheetImport(source: string) {
  return new RegExp(
    `import\\s+["']${publicSdkStylesheetEntry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'];?`,
    "m",
  ).test(source);
}

export function hasPublicSdkPackageResolutionSignal(source: string) {
  const escapedPackageName = publicSdkPackageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return [
    new RegExp(`transpile\\s*:\\s*\\[[\\s\\S]*["']${escapedPackageName}["']`),
    new RegExp(`optimizeDeps\\s*:\\s*\\{[\\s\\S]*include\\s*:\\s*\\[[\\s\\S]*["']${escapedPackageName}["']`),
    new RegExp(`["']${escapedPackageName}["']\\s*:`),
  ].some(pattern => pattern.test(source));
}

export function hasPublicSdkStylesheetResolutionSignal(source: string) {
  const escapedStylesheetEntry = publicSdkStylesheetEntry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`["']${escapedStylesheetEntry}["']\\s*:`).test(source);
}

export function importSpecifiers(source: string) {
  const imports = source.matchAll(/import[\s\S]*?from\s*["'](?<specifier>[^"']+)["']|import\s*["'](?<sideEffect>[^"']+)["']/g);

  return [...imports]
    .map(match => match.groups?.specifier ?? match.groups?.sideEffect)
    .filter((specifier): specifier is string => Boolean(specifier));
}
