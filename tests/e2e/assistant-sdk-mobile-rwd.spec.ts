import { expect, test } from "@playwright/test";

const hostUrl = "http://127.0.0.1:4173/tests/fixtures/assistant-sdk/mobile-rwd-host.html";
const widths = [320, 375, 390, 430, 576, 577, 768, 1024, 1280] as const;

async function openSdk(page: import("@playwright/test").Page) {
  await page.goto(hostUrl);
  await page.waitForFunction(() => Boolean((window as Window & { __sdkReady?: boolean }).__sdkReady));
  await page.locator("[data-assistant-launcher]").click();
  await expect(page.locator("[data-assistant-panel]")).toBeVisible();
  await expect(page.locator("[data-assistant-panel]")).toHaveAttribute("data-panel-entered", "true");
}

for (const width of widths) {
  test(`SDK panel uses the correct viewport mode at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openSdk(page);
    const panel = page.locator("[data-assistant-panel]");
    const header = page.locator("[data-testid='assistant-panel-header']");
    const area = page.locator("[data-testid='assistant-message-area']");
    const footer = page.locator("[data-testid='assistant-panel-footer']");
    const box = await panel.boundingBox();
    const headerBox = await header.boundingBox();
    const areaBox = await area.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(box && headerBox && areaBox && footerBox).toBeTruthy();
    const style = await panel.evaluate(element => {
      const computed = getComputedStyle(element);
      return { radius: computed.borderTopLeftRadius, shadow: computed.boxShadow };
    });

    if (width <= 576) {
      expect(box!.x).toBe(0);
      expect(box!.y).toBe(0);
      expect(box!.width).toBe(width);
      expect(box!.height).toBe(700);
      expect(style.radius).toBe("0px");
      expect(style.shadow).toBe("none");
      expect(await page.locator("[data-assistant-sdk-root]").getAttribute("data-mobile-open")).toBe("true");
      expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe("fixed");
    }
    else {
      expect(box!.x).toBeGreaterThan(0);
      expect(box!.y).toBeGreaterThan(0);
      expect(box!.width).toBe(360);
      expect(box!.height).toBe(620);
      expect(style.radius).not.toBe("0px");
      expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe("fixed");
    }
    expect(headerBox!.y).toBeGreaterThanOrEqual(box!.y);
    expect(areaBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
    expect(footerBox!.y).toBeGreaterThanOrEqual(areaBox!.y + areaBox!.height - 1);
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(box!.y + box!.height + 1);
    expect(await area.evaluate(element => getComputedStyle(element).overflowY)).toBe("auto");
  });
}

for (const width of [375, 390, 576] as const) {
  test(`mobile SDK panel slides in and out at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(hostUrl);
    await page.waitForFunction(() => Boolean((window as Window & { __sdkReady?: boolean }).__sdkReady));
    await page.locator("[data-assistant-launcher]").click();
    const panel = page.locator("[data-assistant-panel]");
    await expect(panel).toHaveClass(/assistant-sdk-panel-enter-active/);
    await page.waitForTimeout(80);
    const entering = await panel.evaluate(element => ({
      transform: getComputedStyle(element).transform,
      opacity: Number(getComputedStyle(element).opacity),
      y: element.getBoundingClientRect().y,
    }));
    expect(entering.transform).not.toBe("none");
    expect(entering.y).toBeGreaterThan(0);
    expect(entering.y).toBeLessThan(700);
    expect(entering.opacity).toBeLessThan(1);
    await expect(panel).toHaveAttribute("data-panel-entered", "true");
    expect((await panel.boundingBox())?.y).toBe(0);
    expect((await panel.boundingBox())?.height).toBe(700);

    await page.locator("[data-assistant-close]").click();
    await expect(panel).toHaveClass(/assistant-sdk-panel-leave-active/);
    expect(await panel.getAttribute("inert")).not.toBeNull();
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    await page.waitForTimeout(65);
    const leaving = await panel.evaluate(element => ({
      opacity: Number(getComputedStyle(element).opacity),
      y: element.getBoundingClientRect().y,
    }));
    expect(leaving.y).toBeGreaterThan(0);
    expect(leaving.y).toBeLessThan(700);
    expect(leaving.opacity).toBeLessThan(1);
    await expect(panel).toHaveCount(0);
    await expect(page.locator("[data-assistant-launcher]")).toBeVisible();
    expect(await page.evaluate(() => document.body.style.position)).toBe("");
  });
}

for (const width of [577, 1280] as const) {
  test(`desktop SDK retains its opening keyframe at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(hostUrl);
    await page.waitForFunction(() => Boolean((window as Window & { __sdkReady?: boolean }).__sdkReady));
    await page.locator("[data-assistant-launcher]").click();
    const panel = page.locator("[data-assistant-panel]");
    await expect(panel).toBeVisible();
    expect(await panel.evaluate(element => getComputedStyle(element).animationName)).toContain("assistant-sdk-panel-enter");
    await expect(panel).toHaveAttribute("data-panel-entered", "true");
    expect((await panel.boundingBox())?.width).toBe(360);
    await page.locator("[data-assistant-close]").click();
    await expect(panel).toHaveCount(0);
  });
}

test("mobile rapid close and reopen keeps one panel and the scroll lock", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openSdk(page);
  await page.evaluate(() => {
    const handle = (window as Window & { __sdkHandle: { close: () => void; open: () => void } }).__sdkHandle;
    handle.close();
    handle.open();
  });
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveAttribute("data-panel-entered", "true");
  expect((await panel.boundingBox())?.y).toBe(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await page.evaluate(() => (window as Window & { __sdkHandle: { close: () => void } }).__sdkHandle.close());
  await expect(panel).toHaveClass(/assistant-sdk-panel-leave-active/);
  await page.waitForTimeout(65);
  await page.evaluate(() => (window as Window & { __sdkHandle: { open: () => void } }).__sdkHandle.open());
  await expect(panel).toHaveCount(1);
  await expect.poll(async () => (await panel.boundingBox())?.y).toBe(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
  await page.locator("[data-assistant-close]").click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});

test("mobile reduced motion opens and closes without panel movement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(hostUrl);
  await page.waitForFunction(() => Boolean((window as Window & { __sdkReady?: boolean }).__sdkReady));
  await page.locator("[data-assistant-launcher]").click();
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toBeVisible();
  expect(await panel.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  expect(await panel.evaluate(element => getComputedStyle(element).transform)).toBe("none");
  await expect(panel).toHaveAttribute("data-panel-entered", "true");
  await page.locator("[data-assistant-close]").click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator("[data-assistant-launcher]")).toBeVisible();
});

test("resizing during mobile entry settles into the desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 576, height: 700 });
  await page.goto(hostUrl);
  await page.waitForFunction(() => Boolean((window as Window & { __sdkReady?: boolean }).__sdkReady));
  await page.locator("[data-assistant-launcher]").click();
  const panel = page.locator("[data-assistant-panel]");
  await expect(panel).toHaveClass(/assistant-sdk-panel-enter-active/);
  await page.setViewportSize({ width: 577, height: 700 });
  await expect.poll(async () => (await panel.boundingBox())?.width).toBe(360);
  expect((await panel.boundingBox())?.y).toBe(60);
  expect(await panel.evaluate(element => getComputedStyle(element).transform)).toBe("none");
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
});

test("SDK restores host scrolling across resize, close, and unmount", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(hostUrl);
  await page.waitForFunction(() => Boolean((window as Window & { __sdkReady?: boolean }).__sdkReady));
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.locator("[data-assistant-launcher]").click();
  await expect(page.locator("[data-assistant-panel]")).toBeVisible();
  expect(await page.evaluate(() => document.body.style.top)).toBe("-400px");

  await page.setViewportSize({ width: 577, height: 700 });
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
  expect(await page.evaluate(() => window.scrollY)).toBe(400);
  await page.setViewportSize({ width: 576, height: 700 });
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("fixed");
  await page.locator("[data-assistant-close]").click();
  await expect.poll(() => page.evaluate(() => document.body.style.position)).toBe("");
  expect(await page.evaluate(() => window.scrollY)).toBe(400);
  await page.evaluate(() => (window as Window & { __sdkHandle: { unmount: () => void } }).__sdkHandle.unmount());
  await expect(page.locator("[data-assistant-sdk-root]")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});

test("mobile SDK follows visual viewport height changes without moving the composer offscreen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.addInitScript(() => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 700, writable: true },
      offsetTop: { configurable: true, value: 0, writable: true },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
    (window as Window & { __resizeVisualViewport?: (height: number, top: number) => void }).__resizeVisualViewport = (height, top) => {
      Object.defineProperty(visualViewport, "height", { configurable: true, value: height });
      Object.defineProperty(visualViewport, "offsetTop", { configurable: true, value: top });
      visualViewport.dispatchEvent(new Event("resize"));
    };
  });
  await openSdk(page);
  await page.evaluate(() => (window as Window & { __resizeVisualViewport: (height: number, top: number) => void }).__resizeVisualViewport(420, 20));
  await expect.poll(async () => (await page.locator("[data-assistant-panel]").boundingBox())?.height).toBe(420);
  const panelBox = await page.locator("[data-assistant-panel]").boundingBox();
  const footerBox = await page.locator("[data-testid='assistant-panel-footer']").boundingBox();
  expect(panelBox?.y).toBe(20);
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(440);
  expect(await page.locator("[data-assistant-panel]").evaluate(element => getComputedStyle(element).transform)).toBe("none");
  await expect(page.locator("[data-assistant-panel]")).not.toHaveClass(/assistant-sdk-panel-enter-active/);
  await page.evaluate(() => (window as Window & { __resizeVisualViewport: (height: number, top: number) => void }).__resizeVisualViewport(700, 0));
  await expect.poll(async () => (await page.locator("[data-assistant-panel]").boundingBox())?.height).toBe(700);
});

test("mobile SDK keeps send, Stop, IME, and message metadata usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openSdk(page);
  const input = page.locator("[data-testid='assistant-chat-input']");
  await expect(input).toBeEnabled();
  await input.fill("first question");
  await input.press("Enter");
  await page.waitForFunction(() => (window as Window & { __streams: unknown[] }).__streams.length === 1);
  await expect(page.locator("[data-testid='assistant-chat-cancel']")).toBeVisible();
  await page.locator("[data-testid='assistant-chat-cancel']").click();
  await expect(page.locator("[data-testid='assistant-chat-submit']")).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __streamSignals: AbortSignal[] }).__streamSignals[0]?.aborted)).toBe(true);

  await input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    textarea.value = "這週新增多少工單";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }));
    textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
  });
  expect(await page.evaluate(() => (window as Window & { __streams: unknown[] }).__streams.length)).toBe(1);
  await input.press("Enter");
  await page.waitForFunction(() => (window as Window & { __streams: unknown[] }).__streams.length === 2);
  await page.evaluate(() => {
    const browser = window as Window & { __streams: ReadableStreamDefaultController<Uint8Array>[] };
    const event = {
      requestId: "server:second", sessionId: "session-rwd", messageId: "message:second",
      eventType: "final", sequence: 1,
      data: { answerDecision: "answered", answer: "本週新增 3 筆工單", evidenceRefs: [{ id: "source:one", sourceType: "structured_record", title: "資料來源：內部資料查詢" }] },
    };
    browser.__streams[1]!.enqueue(new TextEncoder().encode(`event: final\ndata: ${JSON.stringify(event)}\n\n`));
  });
  await expect(page.locator("[data-testid='assistant-streaming-content']").last()).toContainText("本週新增 3 筆工單");
  await expect(page.locator("[data-testid='assistant-evidence-ref']")).toContainText("資料來源：內部資料查詢");
  await expect(page.locator("[data-testid='assistant-message-avatar-assistant']").last()).toBeVisible();
  await expect(page.locator("[data-testid='assistant-message-timestamp']").last()).toBeVisible();
  await expect(page.locator("[data-testid='assistant-feedback-helpful']")).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __sentMessages: string[] }).__sentMessages)).toEqual(["first question", "這週新增多少工單"]);
  await page.locator("[data-assistant-close]").click();
  await expect(page.locator("[data-assistant-panel]")).toHaveCount(0);
  await page.locator("[data-assistant-launcher]").click();
  await expect(page.locator("[data-assistant-panel]")).toHaveAttribute("data-panel-entered", "true");
  await expect(page.locator("[data-testid='assistant-streaming-content']").last()).toContainText("本週新增 3 筆工單");
});

for (const width of [375, 390, 576, 577, 1280] as const) {
  test(`SDK user bubble and feedback toolbar layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openSdk(page);
    const input = page.locator("[data-testid='assistant-chat-input']");
    await input.fill(`長文字測試${"內文換行".repeat(45)}`);
    await input.press("Enter");
    await page.waitForFunction(() => (window as Window & { __streams: unknown[] }).__streams.length === 1);
    await page.evaluate(() => {
      const browser = window as Window & { __streams: ReadableStreamDefaultController<Uint8Array>[] };
      const event = {
        requestId: "server:layout", sessionId: "session-rwd", messageId: "message:layout",
        eventType: "final", sequence: 1,
        data: { answerDecision: "answered", answer: "正式回答", evidenceRefs: [] },
      };
      browser.__streams[0]!.enqueue(new TextEncoder().encode(`event: final\ndata: ${JSON.stringify(event)}\n\n`));
    });

    const user = page.locator("[data-testid='assistant-user-message']").last();
    const assistant = page.locator("[data-testid='assistant-ai-message']").last();
    await expect(user.locator(".assistant-message-avatar")).toHaveCount(0);
    await expect(user.locator(".assistant-message-frame-content")).toHaveCount(1);
    await expect(user.locator(".assistant-feedback-controls")).toHaveCount(0);
    await expect(assistant.locator("[data-testid='assistant-message-avatar-assistant']")).toBeVisible();
    await expect(assistant.locator(".assistant-feedback-button")).toHaveCount(2);
    const userLayout = await user.evaluate(element => {
      const frame = element.getBoundingClientRect();
      const content = element.querySelector(".assistant-message-frame-content")!.getBoundingClientRect();
      const bubble = element.querySelector(".assistant-message-bubble--user")!.getBoundingClientRect();
      const time = element.querySelector("time")!.getBoundingClientRect();
      return { frameRight: frame.right, contentRight: content.right, bubbleRight: bubble.right, bubbleWidth: bubble.width, bubbleHeight: bubble.height, timeRight: time.right, timeTop: time.top, bubbleBottom: bubble.bottom };
    });
    expect(Math.abs(userLayout.frameRight - userLayout.contentRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(userLayout.frameRight - userLayout.bubbleRight)).toBeLessThanOrEqual(1);
    expect(userLayout.frameRight - userLayout.timeRight).toBeLessThanOrEqual(5);
    expect(userLayout.timeTop).toBeGreaterThanOrEqual(userLayout.bubbleBottom);
    expect(userLayout.bubbleHeight).toBeGreaterThan(45);
    expect(userLayout.bubbleWidth).toBeLessThan(width * 0.8);

    const helpful = assistant.locator("[data-testid='assistant-feedback-helpful']");
    const notHelpful = assistant.locator("[data-testid='assistant-feedback-not-helpful']");
    const feedbackStyle = await helpful.evaluate(element => {
      const style = getComputedStyle(element);
      const timestamp = element.closest(".assistant-message-metadata")!.querySelector("time")!;
      const timeStyle = getComputedStyle(timestamp);
      const rect = element.getBoundingClientRect();
      const timeRect = timestamp.getBoundingClientRect();
      const iconRect = element.querySelector("svg")!.getBoundingClientRect();
      const nextIconRect = element.nextElementSibling!.querySelector("svg")!.getBoundingClientRect();
      return { background: style.backgroundColor, borderWidth: style.borderTopWidth, radius: style.borderRadius, shadow: style.boxShadow, color: style.color, timestampColor: timeStyle.color, width: rect.width, height: rect.height, centerY: rect.y + rect.height / 2, timeCenterY: timeRect.y + timeRect.height / 2, timeToLike: iconRect.left - timeRect.right, likeToDislike: nextIconRect.left - iconRect.right };
    });
    expect(feedbackStyle.background).toBe("rgba(0, 0, 0, 0)");
    expect(feedbackStyle.borderWidth).toBe("0px");
    expect(feedbackStyle.radius).toBe("0px");
    expect(feedbackStyle.shadow).toBe("none");
    expect(feedbackStyle.color).toBe("rgb(107, 114, 128)");
    expect(await notHelpful.evaluate(element => getComputedStyle(element).color)).toBe("rgb(107, 114, 128)");
    expect(feedbackStyle.color).not.toBe(feedbackStyle.timestampColor);
    expect(feedbackStyle.width).toBe(24);
    expect(feedbackStyle.height).toBe(32);
    expect(Math.abs(feedbackStyle.timeToLike - 4)).toBeLessThanOrEqual(1);
    expect(Math.abs(feedbackStyle.likeToDislike - 4)).toBeLessThanOrEqual(1);
    expect(Math.abs(feedbackStyle.centerY - feedbackStyle.timeCenterY)).toBeLessThanOrEqual(1);
    await expect(helpful).toHaveAttribute("aria-pressed", "false");
    await expect(notHelpful).toHaveAttribute("aria-label", "這個回答沒有幫助");
    await helpful.hover();
    await expect.poll(() => helpful.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await expect.poll(() => helpful.evaluate(element => getComputedStyle(element).color)).not.toBe(feedbackStyle.color);
    await helpful.evaluate(element => {
      element.setAttribute("aria-pressed", "true");
      (element as HTMLButtonElement).disabled = true;
    });
    expect(await helpful.evaluate(element => getComputedStyle(element).opacity)).not.toBe("1");
    expect(await helpful.evaluate(element => getComputedStyle(element).color)).not.toBe(feedbackStyle.color);
    await helpful.evaluate(element => {
      element.setAttribute("aria-pressed", "false");
      (element as HTMLButtonElement).disabled = false;
    });
    await page.keyboard.press("Tab");
    await helpful.focus();
    expect(await helpful.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
    expect(await page.locator("[data-testid='assistant-chat-submit']").evaluate(element => getComputedStyle(element).borderRadius)).not.toBe("0px");
  });
}

for (const width of [390, 1280] as const) {
  test(`SDK safe outcome cards stay single and wrap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openSdk(page);
    const cases = [
      { decision: "no_answer", reason: "no_evidence", label: "缺少可信資料", answer: `目前沒有足夠證據可以安全回答。${"請確認查詢範圍。".repeat(35)}`, testId: "assistant-no-answer-message" },
      { decision: "clarification_required", label: "需要補充資訊", answer: "請指定要查詢哪一筆資料。", testId: "assistant-clarification-message" },
      { decision: "permission_denied", label: "權限受限", answer: "你目前沒有權限取得此資訊。", testId: "assistant-permission-denied-message" },
    ] as const;
    const input = page.locator("[data-testid='assistant-chat-input']");
    for (const [index, outcome] of cases.entries()) {
      await input.fill(`狀態測試 ${index}`);
      await input.press("Enter");
      await page.waitForFunction(expected => (window as Window & { __streams: unknown[] }).__streams.length === expected, index + 1);
      await page.evaluate(({ index, outcome }) => {
        const browser = window as Window & { __streams: ReadableStreamDefaultController<Uint8Array>[] };
        const event = {
          requestId: `server:state:${index}`, sessionId: "session-rwd", messageId: `message:state:${index}`,
          eventType: "final", sequence: 1,
          data: { answerDecision: outcome.decision, noAnswerReason: "reason" in outcome ? outcome.reason : undefined, answer: outcome.answer, evidenceRefs: [] },
        };
        browser.__streams[index]!.enqueue(new TextEncoder().encode(`event: final\ndata: ${JSON.stringify(event)}\n\n`));
      }, { index, outcome });
      const frame = page.locator(`[data-testid='${outcome.testId}']`).last();
      await expect(frame.locator(".assistant-product-state-bubble")).toHaveCount(1);
      await expect(frame.locator(".assistant-message-bubble")).toHaveCount(0);
      await expect(frame.locator(".assistant-product-state-badge")).toHaveText(outcome.label);
      await expect(frame.locator(".assistant-product-state-bubble > p").first()).toHaveText(outcome.answer);
      expect((await frame.innerText()).split(outcome.answer).length - 1).toBe(1);
      await expect(frame.locator("[data-testid='assistant-message-timestamp']")).toBeVisible();
      const card = frame.locator(".assistant-product-state-bubble");
      const cardBox = await card.boundingBox();
      const panelBox = await page.locator("[data-assistant-panel]").boundingBox();
      expect(cardBox && panelBox).toBeTruthy();
      expect(cardBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
      expect(await card.evaluate(element => getComputedStyle(element).overflowWrap)).toBe("anywhere");
      const hint = card.locator(".assistant-product-state-hint");
      await expect(hint).toHaveCount(1);
      expect(Number.parseFloat(await hint.evaluate(element => getComputedStyle(element).fontSize))).toBeLessThan(
        Number.parseFloat(await card.evaluate(element => getComputedStyle(element).fontSize)),
      );
    }
  });
}
