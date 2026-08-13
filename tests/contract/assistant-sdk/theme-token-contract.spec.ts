import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRootPath = process.cwd();
const sdkStylesheetPath = join(projectRootPath, "packages/assistant-sdk/styles.css");

const publicThemeTokens = [
  "--assistant-sdk-z-index",
  "--assistant-sdk-panel-width",
  "--assistant-sdk-panel-height",
  "--assistant-sdk-launcher-size",
  "--assistant-sdk-gap",
  "--assistant-sdk-font-family",
  "--assistant-sdk-font-size",
  "--assistant-sdk-line-height",
  "--assistant-sdk-font-weight-strong",
  "--assistant-sdk-radius",
  "--assistant-sdk-radius-sm",
  "--assistant-sdk-radius-md",
  "--assistant-sdk-radius-lg",
  "--assistant-sdk-radius-pill",
  "--assistant-sdk-space-1",
  "--assistant-sdk-space-2",
  "--assistant-sdk-space-3",
  "--assistant-sdk-space-4",
  "--assistant-sdk-space-5",
  "--assistant-sdk-shadow",
  "--assistant-sdk-bubble-shadow",
  "--assistant-sdk-background",
  "--assistant-sdk-surface",
  "--assistant-sdk-surface-elevated",
  "--assistant-sdk-foreground",
  "--assistant-sdk-muted",
  "--assistant-sdk-border",
  "--assistant-sdk-accent",
  "--assistant-sdk-accent-foreground",
  "--assistant-sdk-danger",
  "--assistant-sdk-danger-foreground",
  "--assistant-sdk-warning",
  "--assistant-sdk-warning-foreground",
  "--assistant-sdk-success",
  "--assistant-sdk-info",
  "--assistant-sdk-launcher-background",
  "--assistant-sdk-panel-background",
  "--assistant-sdk-panel-header-background",
  "--assistant-sdk-message-area-background",
  "--assistant-sdk-message-bubble-background",
  "--assistant-sdk-user-message-background",
  "--assistant-sdk-assistant-message-background",
  "--assistant-sdk-safe-outcome-background",
  "--assistant-sdk-evidence-background",
  "--assistant-sdk-feedback-background",
  "--assistant-sdk-action-draft-background",
  "--assistant-sdk-approval-request-background",
  "--assistant-sdk-input-background",
  "--assistant-sdk-button-primary-background",
  "--assistant-sdk-button-secondary-background",
  "--assistant-sdk-button-danger-background",
  "--assistant-sdk-focus-ring",
] as const;

const productStyleSelectors = [
  "[data-testid=\"assistant-product-runtime-panel\"]",
  "[data-testid=\"assistant-message-area\"]",
  ".assistant-message-bubble",
  "[data-testid=\"assistant-chat-input\"]",
  "[data-testid=\"assistant-chat-submit\"]",
  "[data-testid=\"assistant-safe-outcome\"]",
  "[data-testid=\"assistant-evidence-ref\"]",
  "[data-testid=\"assistant-feedback-helpful\"]",
  "[data-testid=\"assistant-action-draft-confirm\"]",
  "[data-testid=\"assistant-approval-request-open-detail\"]",
  ".assistant-product-panel-shell",
  ".assistant-product-panel-header",
] as const;

function collectRuleBlocks(stylesheet: string): string[] {
  return stylesheet
    .split("}")
    .map(block => block.trim())
    .filter(Boolean);
}

describe("SDK theme token contract", () => {
  it("keeps public theme tokens inherited by assigning only internal defaults on SDK roots", async () => {
    const stylesheet = await readFile(sdkStylesheetPath, "utf8");
    const rootBlocks = collectRuleBlocks(stylesheet).filter(block =>
      block.startsWith(".assistant-sdk-root,\n[data-assistant-sdk-root]")
      || block.startsWith(".assistant-sdk-root[data-theme=")
      || block.startsWith("[data-assistant-sdk-root][data-theme="),
    );

    expect(rootBlocks.length, "Theme defaults must be scoped to SDK root/theme blocks.").toBeGreaterThan(0);

    for (const block of rootBlocks) {
      for (const token of publicThemeTokens) {
        expect(
          block,
          `SDK root/theme blocks must not assign public host override token ${token}; use --assistant-sdk-default-* fallbacks instead.`,
        ).not.toMatch(new RegExp(`${token.replaceAll("-", "\\-")}\\s*:`));
      }
    }

    for (const token of publicThemeTokens) {
      const defaultToken = token.replace("--assistant-sdk-", "--assistant-sdk-default-");
      expect(stylesheet, `Theme contract must declare fallback ${defaultToken}.`).toContain(defaultToken);
      expect(stylesheet, `Theme contract must consume inherited public token ${token}.`).toContain(`var(${token}`);
    }
  });

  it("styles the product widget through package-owned selectors and tokenized visual values", async () => {
    const stylesheet = await readFile(sdkStylesheetPath, "utf8");

    for (const selector of productStyleSelectors) {
      const block = collectRuleBlocks(stylesheet).find(candidate => candidate.includes(selector));
      expect(block, `SDK styles.css must include a rule for product UI selector ${selector}.`).toBeTruthy();
      expect(block, `Product UI selector ${selector} must consume theme variables.`).toContain("var(--assistant-sdk-");
    }

    expect(stylesheet, "SDK stylesheet must stay self-contained and not rely on host Tailwind generation.").not.toMatch(/@tailwind|@apply|tailwindcss/i);
    expect(stylesheet, "SDK stylesheet must not target Nuxt UI or Quasar internals.").not.toMatch(/\b(?:UButton|UIcon|UTextarea|UAlert|UEmpty|UBadge|q-btn|q-card|q-input|q-field)\b/);
  });

  it("keeps the Sky-light shared product shell tokenized and centers the send icon", async () => {
    const stylesheet = await readFile(sdkStylesheetPath, "utf8");
    const sendRule = collectRuleBlocks(stylesheet).find(block =>
      block.includes('[data-testid="assistant-chat-submit"]'),
    );
    const shellRule = collectRuleBlocks(stylesheet).find(block =>
      block.includes(".assistant-product-panel-shell"),
    );

    expect(sendRule).toContain("display: inline-grid");
    expect(sendRule).toContain("place-items: center");
    expect(sendRule).toContain("padding: 0");
    expect(shellRule).toContain("var(--assistant-sdk-panel-background");
    expect(shellRule).toContain("var(--assistant-sdk-panel-shadow");
    expect(stylesheet).toContain("var(--assistant-sdk-panel-header-background");
    expect(stylesheet).toContain("var(--assistant-sdk-panel-enter-duration");
  });
});
