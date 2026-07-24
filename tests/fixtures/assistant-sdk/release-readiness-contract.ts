export const sdkPackageName = "@internal-ai-assistant/assistant-sdk";
export const sdkStylesheetEntry = "@internal-ai-assistant/assistant-sdk/styles.css";

export const sdkPackageRoot = "packages/assistant-sdk";
export const sdkPackageManifest = `${sdkPackageRoot}/package.json`;
export const sdkDistDirectory = `${sdkPackageRoot}/dist`;
export const sdkDistEntry = `${sdkDistDirectory}/index.mjs`;
export const sdkDistTypes = `${sdkDistDirectory}/index.d.ts`;
export const sdkStylesheet = `${sdkPackageRoot}/styles.css`;

export const requiredReleaseReadinessChecks = [
  "public-exports",
  "styles-entry",
  "type-declarations",
  "build-command",
  "pack-dry-run",
  "install-smoke",
  "reference-consumer-smoke",
  "compatibility-mode-smoke",
  "host-integration-gated-disabled",
  "host-integration-gated-enabled",
  "runtime-regression-gate",
  "typecheck",
  "package-artifact-contents",
  "usage-documentation",
  "security-boundary-documentation",
  "github-packages-metadata",
  "productized-widget-runtime",
  "productized-mount-helper",
  "packaged-compatibility-seven-outcomes",
  "source-boundary-scan",
  "no-sourcemaps",
  "no-private-runtime-exports",
  "no-external-backend-calls",
] as const;

export const allowedPackageExportKeys = [
  ".",
  "./styles.css",
] as const;

export const forbiddenPackageExportKeys = [
  "./runtime",
  "./runtime/*",
  "./transport",
  "./transport/*",
  "./session",
  "./session/*",
  "./lifecycle",
  "./lifecycle/*",
  "./events",
  "./events/*",
  "./context",
  "./context/*",
  "./request",
  "./request/*",
  "./components",
  "./components/*",
  "./src",
  "./src/*",
  "./fixtures",
  "./fixtures/*",
  "./tests",
  "./tests/*",
] as const;

export const forbiddenPackageArtifactPathPatterns = [
  /(^|\/)tests\//,
  /(^|\/)fixtures\//,
  /(^|\/)app\//,
  /(^|\/)specs\//,
  /(^|\/)\.specify\//,
  /(^|\/)src\/runtime\//,
  /(^|\/)src\/transport\//,
  /(^|\/)src\/session\//,
  /(^|\/)src\/lifecycle\//,
  /(^|\/)src\/events\//,
  /(^|\/)src\/context\//,
  /(^|\/)src\/request\//,
] as const;

export const forbiddenInstalledImportPatterns = [
  /packages\/assistant-sdk\/src\//,
  /packages\/assistant-sdk\/src\/runtime\//,
  /packages\/assistant-sdk\/src\/transport\//,
  /packages\/assistant-sdk\/src\/session\//,
  /packages\/assistant-sdk\/src\/lifecycle\//,
  /packages\/assistant-sdk\/src\/events\//,
  /packages\/assistant-sdk\/src\/request\//,
  /app\/features\/assistant\//,
  /app\/services\/api\/assistant/,
  /app\/stores\//,
  /app\/utils\/assistant\//,
  /tests\/fixtures\//,
] as const;

export const forbiddenDistSourcePathPatterns = [
  /\.\.\/\.\.\/\.\.\/\.\.\/app\/features/,
  /\.\.\/\.\.\/\.\.\/\.\.\/app\/services/,
  /\.\.\/\.\.\/\.\.\/\.\.\/app\/stores/,
  /\.\.\/\.\.\/\.\.\/\.\.\/app\/utils/,
  /app\/features\/assistant/,
  /app\/services\/api\/assistant/,
  /app\/stores\//,
  /app\/utils\/assistant/,
  /packages\/assistant-sdk\/src\/runtime/,
  /packages\/assistant-sdk\/src\/transport/,
  /packages\/assistant-sdk\/src\/session/,
  /packages\/assistant-sdk\/src\/lifecycle/,
  /packages\/assistant-sdk\/src\/events/,
  /packages\/assistant-sdk\/src\/context/,
  /packages\/assistant-sdk\/src\/request/,
] as const;
