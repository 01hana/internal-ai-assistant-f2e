export const expectedPublishReadinessMetadata = {
  access: "restricted",
  license: "UNLICENSED",
  name: "@internal-ai-assistant/assistant-sdk",
  registry: "https://npm.pkg.github.com",
  version: "0.1.0",
} as const;

export const requiredPublishPackageFiles = [
  "dist",
  "styles.css",
  "README.md",
] as const;

export function evaluatePrivateFlagSequencing(input: {
  readonly packagePrivate: boolean | undefined;
  readonly runtimeComplete: boolean;
}) {
  if (!input.runtimeComplete && input.packagePrivate !== true) {
    return {
      ok: false,
      reason: "private_flag_removed_before_runtime_completeness",
    } as const;
  }

  if (input.runtimeComplete && input.packagePrivate === true) {
    return {
      ok: false,
      reason: "private_flag_blocks_publish_readiness_after_runtime_completeness",
    } as const;
  }

  return {
    ok: true,
  } as const;
}

export function evaluateInstalledRuntimeCompleteness(input: {
  readonly closedWidgetDom: boolean;
  readonly openedWidgetDom: boolean;
  readonly publicEntryResolved: boolean;
  readonly shellTextFound: boolean;
  readonly stylesheetEntryResolved: boolean;
  readonly mountError: string | null;
}) {
  const missing = [
    !input.publicEntryResolved ? "public_entry_resolution" : null,
    !input.stylesheetEntryResolved ? "stylesheet_entry_resolution" : null,
    input.shellTextFound ? "shell_placeholder_removed" : null,
    !input.closedWidgetDom ? "closed_widget_dom" : null,
    !input.openedWidgetDom ? "opened_widget_dom" : null,
    input.mountError ? "mount_runtime_error" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    complete: missing.length === 0,
    missing,
  } as const;
}
