export const frontend001BehaviorBaselineFiles = [
  "app/features/assistant/components/ChatWidget.vue",
  "app/features/assistant/components/ChatPanel.vue",
  "app/features/assistant/composables/useChat.ts",
  "app/features/assistant/composables/useAssistantSession.ts",
  "app/features/assistant/composables/useAssistantSseStream.ts",
  "app/services/api/assistant.ts",
  "app/stores/assistant/useChatWidgetStore.ts",
  "app/stores/assistant/useSessionStore.ts",
  "app/utils/assistant/assistantSseParser.ts",
  "app/utils/assistant/answerDecisionStateMapper.ts",
  "app/utils/assistant/assistantMessageRendererResolver.ts",
  "app/utils/assistant/evidenceNormalizationAdapter.ts",
] as const;

export const canonicalSharedRuntimeBoundary = {
  packageName: "@internal-ai-assistant/assistant-runtime",
  root: "packages/assistant-runtime",
  sourceRoot: "packages/assistant-runtime/src",
  role: "future reusable canonical runtime owner",
} as const;

export const canonicalFrontend001ComposableFiles = [
  "app/features/assistant/composables/useChat.ts",
  "app/features/assistant/composables/useAssistantSession.ts",
  "app/features/assistant/composables/useAssistantSseStream.ts",
] as const;

export const canonicalFrontend001ServiceStoreHelperFiles = [
  "app/services/api/assistant.ts",
  "app/stores/assistant/useChatWidgetStore.ts",
  "app/stores/assistant/useSessionStore.ts",
  "app/utils/assistant/assistantSseParser.ts",
  "app/utils/assistant/answerDecisionStateMapper.ts",
  "app/utils/assistant/assistantMessageRendererResolver.ts",
  "app/utils/assistant/evidenceNormalizationAdapter.ts",
] as const;

export const approvedRuntimeBridgeFilePatterns = [
  /(^|\/)packages\/assistant-sdk\/src\/runtime\/frontend001Runtime\.ts$/,
  /(^|\/)packages\/assistant-sdk\/src\/runtime\/chatWidgetAdapter\.ts$/,
  /(^|\/)packages\/assistant-sdk\/src\/runtime\/composableAdapter\.ts$/,
  /(^|\/)packages\/assistant-sdk\/src\/runtime\/sessionAdapter\.ts$/,
  /(^|\/)packages\/assistant-sdk\/src\/runtime\/sseStreamAdapter\.ts$/,
  /(^|\/)packages\/assistant-sdk\/src\/runtime\/serviceAdapter\.ts$/,
] as const;

export const forbiddenDuplicateRuntimeFilePatterns = [
  /(^|\/)ChatWidget\.vue$/,
  /(^|\/)ChatPanel\.vue$/,
  /(^|\/)(assistant|chat)-(api|client|service)\.ts$/i,
  /(^|\/).*sse.*parser.*\.ts$/i,
  /(^|\/).*session.*(runtime|history|store).*\.ts$/i,
  /(^|\/).*answer.*decision.*mapper.*\.ts$/i,
  /(^|\/).*evidence.*(renderer|normalization).*\.ts$/i,
  /(^|\/).*feedback.*(flow|runtime).*\.ts$/i,
  /(^|\/).*action.*draft.*(confirmation|runtime).*\.ts$/i,
  /(^|\/).*approval.*request.*(display|runtime).*\.ts$/i,
] as const;

export const forbiddenRuntimeFactories = [
  "createAssistantClient",
  "createChatClient",
  "new AssistantService",
  "class AssistantService",
  "parseAssistantSseEvent",
  "createSseParser",
  "createSessionHistoryRuntime",
  "answerDecisionStateMapper",
  "evidenceNormalizationAdapter",
  "submitFeedback(",
  "confirmActionDraft(",
  "getApprovalRequest(",
] as const;

export const formalPublicExportNames = [
  "AssistantWidget",
  "mountAssistantWidget",
  "AssistantHostContextProvider",
  "WidgetConfiguration",
  "HostCallbacks",
  "HostEvents",
  "IntegrationMode",
  "MountOptions",
  "MountHandle",
  "SafeError",
  "SanitizedPageContext",
] as const;

export const forbiddenRootEntryPatterns = [
  /app\/features\/assistant/,
  /app\/services\/api\/assistant/,
  /app\/stores\/assistant/,
  /app\/utils\/assistant\/assistantSseParser/,
  /app\/features\/assistant\/composables/,
  /ChatWidget\.vue/,
  /ChatPanel\.vue/,
  /useChatWidgetStore/,
  /useSessionStore/,
  /useAssistantSseStream/,
  /assistantSseParser/,
] as const;

export const forbiddenRuntimeBridgePublicExportPatterns = [
  /export\s+\*\s+from\s+["']\.\/runtime\/frontend001Runtime["']/,
  /export\s+\{[^}]*\}\s+from\s+["']\.\/runtime\/frontend001Runtime["']/,
  /export\s+\{[^}]*\bfrontend001Runtime\b[^}]*\}/,
  /export\s+\{[^}]*\bas\s+frontend001Runtime\b[^}]*\}/,
] as const;

export const forbiddenPackageExports = [
  "./src",
  "./src/*",
  "./runtime",
  "./runtime/*",
  "./transport",
  "./transport/*",
  "./stores",
  "./stores/*",
  "./composables",
  "./composables/*",
  "./components/*",
  "./context/*",
  "./events/*",
  "./session/*",
] as const;

export const frontendIntegrationModes = [
  "Backend 001 Compatibility Mode",
  "Backend 002 Mode",
] as const;

export const allowedFrontendModeTerms = [
  "integrationMode",
  "requestBuilderMode",
  "providerValidationMode",
] as const;

export const forbiddenModeBoundaryPatterns = [
  /\bbackendRequestMode\b/,
  /\brequestMode\s*[:=]\s*["']backend/i,
  /\bhostContext\s*[:=]\s*{/,
  /\bsessionScope\s*[:=]/,
  /\/api\/v1\/assistant\/backend-002/i,
  /\/api\/v1\/assistant\/host-integration/i,
  /modeSpecificEndpoint/i,
  /modeSpecificSseParser/i,
  /modeSpecificRequestEnvelope/i,
  /packageBackendProxy/i,
  /createPackageBackendProxy/i,
] as const;
