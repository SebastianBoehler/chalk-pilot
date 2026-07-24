import { expect, test } from "@playwright/test";

interface LiveRealtimeWindow extends Window {
  __chalkPilotRealtime?: {
    channel: () => RTCDataChannel | undefined;
    navigationRequests: Array<{ requestId: string; targetId: string }>;
    received: string[];
    sent: string[];
  };
}

test.skip(
  process.env.RUN_LIVE_OPENAI !== "1",
  "Set RUN_LIVE_OPENAI=1 and OPENAI_API_KEY for the live smoke test.",
);

test("uses live semantic navigation to return the clean display to an earlier concept", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await captureRealtimeChannel(page);
  await page.goto("/setup");
  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.locator("#camera-device")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.locator("#microphone-device")).toBeVisible();
  await page.getByRole("button", { name: "Confirm microphone" }).click();

  const confirmFrame = page.getByRole("button", {
    name: "Use this board frame",
  });
  await expect(confirmFrame).toBeEnabled({ timeout: 45_000 });
  await confirmFrame.click();
  await page.getByRole("button", { name: "Outputs look right" }).click();

  const start = page.getByRole("button", {
    name: "Start learning session",
  });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(
    page.getByRole("heading", { name: "Learning canvas" }),
  ).toBeVisible();
  await expect(page.getByText("listening", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open clean display" }).click();
  const display = await popupPromise;
  await display.waitForLoadState();

  const sessionCanvas = page
    .getByRole("heading", { name: "Learning canvas" })
    .locator("xpath=ancestor::main");
  const sections = sessionCanvas.locator("section");

  await requestLiveTurn(
    page,
    "Use delegate_canvas_task to create one durable sequence about binary place value. Give it six concise, named steps that let a learner convert a binary number, and keep it separate from future concepts.",
  );
  await expect(sections).toHaveCount(1, { timeout: 75_000 });
  const firstTarget = await sections.first().getAttribute("data-canvas-target");
  expect(firstTarget).toBeTruthy();

  await requestLiveTurn(
    page,
    "Use delegate_canvas_task to create a second, separate durable comparison about binary place value versus decimal place value. Do not replace the existing sequence.",
  );
  await expect(sections).toHaveCount(2, { timeout: 75_000 });
  await expect(display.locator("main section")).toHaveCount(2);

  await sections.first().evaluate((section) => {
    const viewport = section.parentElement?.parentElement;
    if (!viewport) throw new Error("The canvas viewport is unavailable.");
    viewport.scrollTop = viewport.scrollHeight;
  });
  await expect
    .poll(() =>
      sections.first().evaluate((section) => {
        const viewport = section.parentElement?.parentElement;
        return viewport?.scrollTop ?? 0;
      }),
    )
    .toBeGreaterThan(0);

  const toolResultsBeforeNavigation = await navigationToolResultCount(page);
  const firstTargetRequestsBeforeNavigation = await navigationRequestIds(
    page,
    firstTarget,
  );
  await requestLiveTurn(
    page,
    "The first binary-place-value concept is relevant now. Call list_canvas_targets, then call focus_canvas or highlight_canvas for that first target. Do not create or update canvas content.",
  );
  await expect
    .poll(() => navigationToolResultCount(page))
    .toBeGreaterThan(toolResultsBeforeNavigation);
  await expect
    .poll(() => navigationRequestIds(page, firstTarget))
    .toHaveLength(firstTargetRequestsBeforeNavigation.length + 1);
  const cleanTarget = display.locator(`[data-canvas-target="${firstTarget}"]`);
  await expect(cleanTarget).toBeVisible();
  await expect(cleanTarget).toHaveAttribute(
    "data-canvas-attention",
    /focus|highlight/,
  );

  await requestLiveTurn(
    page,
    "Reference that same first binary-place-value target again with focus_canvas or highlight_canvas. Do not create or update canvas content.",
  );
  await expect
    .poll(() => navigationToolResultCount(page))
    .toBeGreaterThan(toolResultsBeforeNavigation + 1);
  await expect
    .poll(() => navigationRequestIds(page, firstTarget))
    .toHaveLength(firstTargetRequestsBeforeNavigation.length + 2);
  const repeatedRequestIds = (
    await navigationRequestIds(page, firstTarget)
  ).slice(-2);
  expect(new Set(repeatedRequestIds).size).toBe(2);
});

async function captureRealtimeChannel(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const sent: string[] = [];
    const received: string[] = [];
    const navigationRequests: Array<{ requestId: string; targetId: string }> =
      [];
    const originalSend = RTCDataChannel.prototype.send;
    const originalPostMessage = BroadcastChannel.prototype.postMessage;
    let channel: RTCDataChannel | undefined;

    function trackChannel(next: RTCDataChannel) {
      if (channel === next) return;
      channel = next;
      next.addEventListener("message", (event) => {
        if (typeof event.data === "string") received.push(event.data);
      });
    }

    RTCDataChannel.prototype.send = function (data) {
      trackChannel(this);
      if (typeof data === "string") sent.push(data);
      Reflect.apply(originalSend, this, [data]);
    };
    BroadcastChannel.prototype.postMessage = function (message) {
      const navigation = message as {
        payload?: { requestId?: unknown; targetId?: unknown };
        type?: unknown;
      };
      if (
        navigation.type === "navigation" &&
        typeof navigation.payload?.requestId === "string" &&
        typeof navigation.payload.targetId === "string"
      ) {
        navigationRequests.push({
          requestId: navigation.payload.requestId,
          targetId: navigation.payload.targetId,
        });
      }
      Reflect.apply(originalPostMessage, this, [message]);
    };
    (window as LiveRealtimeWindow).__chalkPilotRealtime = {
      channel: () => channel,
      navigationRequests,
      received,
      sent,
    };
  });
}

async function requestLiveTurn(
  page: import("@playwright/test").Page,
  text: string,
) {
  const completedResponses = await page.evaluate((message) => {
    const realtime = (window as LiveRealtimeWindow).__chalkPilotRealtime;
    const channel = realtime?.channel();
    if (!realtime || !channel || channel.readyState !== "open") {
      throw new Error("The live Realtime data channel is unavailable.");
    }
    const completed = realtime.received.filter(
      (event) => JSON.parse(event).type === "response.done",
    ).length;
    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: message }],
        },
      }),
    );
    channel.send(JSON.stringify({ type: "response.create" }));
    return completed;
  }, text);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as LiveRealtimeWindow).__chalkPilotRealtime?.received.filter(
            (event) => JSON.parse(event).type === "response.done",
          ).length ?? 0,
      ),
    )
    .toBeGreaterThan(completedResponses);
}

async function navigationToolResultCount(
  page: import("@playwright/test").Page,
) {
  return page.evaluate(
    () =>
      ((window as LiveRealtimeWindow).__chalkPilotRealtime?.sent ?? []).filter(
        (event) => {
          try {
            const item = JSON.parse(event).item;
            if (item?.type !== "function_call_output") return false;
            return JSON.parse(item.output).focused === true;
          } catch {
            return false;
          }
        },
      ).length,
  );
}

async function navigationRequestIds(
  page: import("@playwright/test").Page,
  targetId: string | null,
) {
  return page.evaluate(
    (target) =>
      (
        (window as LiveRealtimeWindow).__chalkPilotRealtime
          ?.navigationRequests ?? []
      )
        .filter((navigation) => navigation.targetId === target)
        .map((navigation) => navigation.requestId),
    targetId,
  );
}
