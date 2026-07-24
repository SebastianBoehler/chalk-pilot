import { rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { artifactSections } from "./display-artifacts";

declare global {
  interface Window {
    navigationScrollCalls?: Array<{ target?: string; block?: string }>;
  }
}

const createdSessions = new Set<string>();

test.afterEach(async () => {
  await Promise.all(
    [...createdSessions].map((sessionId) =>
      rm(join(process.cwd(), ".chalkpilot", "sessions", sessionId), {
        force: true,
        recursive: true,
      }),
    ),
  );
  createdSessions.clear();
});

test("presentation surface contains no setup controls", async ({ page }) => {
  await page.goto("/display");

  await expect(page.getByText("Waiting for controller")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start at the board." }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
});

test("renders persisted typed artifacts on the synchronized display", async ({
  page,
  request,
}) => {
  const sessionId = await createArtifactSession(request);
  const canvasResponse = await request.get(`/api/sessions/${sessionId}/canvas`);
  expect(canvasResponse.ok()).toBe(true);
  const canvas = await canvasResponse.json();
  expect(canvas).toMatchObject({
    focusId: "retrieval-check",
    order: [
      "recall-growth",
      "learning-mechanism",
      "retrieval-loop",
      "retrieval-check",
      "compare-recall",
      "invalid-diagram",
    ],
    sections: {
      "recall-growth": { kind: "chart" },
      "learning-mechanism": { kind: "flow" },
      "retrieval-loop": { kind: "sequence" },
      "retrieval-check": { kind: "checkpoint" },
      "compare-recall": { kind: "comparison" },
      "invalid-diagram": { kind: "mermaid" },
    },
  });

  await page.goto("/display");
  await expect(page.getByText("Waiting for controller")).toBeVisible();
  await page.evaluate(async (snapshot) => {
    const channel = new BroadcastChannel("chalkpilot-display-v1");
    channel.postMessage({
      version: 1,
      type: "snapshot",
      payload: { agentState: "speaking", canvas: snapshot, navigation: null },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    channel.close();
  }, canvas);

  await expect(page.getByText("speaking")).toBeVisible();
  await expect(
    page.getByRole("figure", { name: "Recall growth" }),
  ).toBeVisible();
  await expect(page.getByLabel("Chart legend")).toContainText("Recall");
  await expect(page.getByLabel("Concept flow")).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Connect the mechanism" }),
  ).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("supports")).toBeVisible();
  await expect(page.getByLabel("Learning sequence")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Retrieve from memory" }),
  ).toBeVisible();
  await expect(page.getByText("Compare with notes")).toHaveCount(0);
  await expect(page.getByLabel("Prediction checkpoint")).toContainText(
    "Which step comes before checking notes?",
  );
  await expect(page.getByText("Recall versus rereading")).toBeVisible();

  const updatedCanvas = structuredClone(canvas);
  updatedCanvas.sections["retrieval-check"].updatedAt =
    "2026-07-23T10:01:00.000Z";
  updatedCanvas.sections["retrieval-check"].data.status = "correct";
  updatedCanvas.sections["retrieval-check"].data.showAnswer = true;
  updatedCanvas.sections["learning-mechanism"].updatedAt =
    "2026-07-23T10:01:00.000Z";
  updatedCanvas.sections["learning-mechanism"].data.activeNodeId = "transfer";
  await page.evaluate(async (nextCanvas) => {
    const channel = new BroadcastChannel("chalkpilot-display-v1");
    channel.postMessage({
      version: 1,
      type: "canvas",
      payload: nextCanvas,
    });
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    channel.close();
  }, updatedCanvas);
  await expect(page.getByLabel("Prediction checkpoint")).not.toContainText(
    "Correct",
  );
  await expect(page.getByText("Retrieve from memory.")).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Try a new case" }),
  ).toHaveAttribute("aria-current", "true");

  await expect(
    page.getByText("This diagram could not be rendered."),
  ).toBeVisible();
  await expect(page.getByText("Syntax error in text")).toHaveCount(0);
  await expect(page.locator('[id^="dchalkpilot-"]')).toHaveCount(0);
  await expect(page.locator('[aria-roledescription="error"]')).toHaveCount(0);
});

test("centers and pulses each semantic navigation request on the clean display", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sessionId = await createArtifactSession(request);
  const canvas = await (
    await request.get(`/api/sessions/${sessionId}/canvas`)
  ).json();
  await page.goto("/display");
  await page.evaluate(() => {
    const calls: Array<{ target?: string; block?: string }> = [];
    Element.prototype.scrollIntoView = function (
      options?: ScrollIntoViewOptions,
    ) {
      if (this instanceof HTMLElement) {
        calls.push({
          target: this.dataset.canvasTarget,
          block: options?.block,
        });
      }
    };
    window.navigationScrollCalls = calls;
  });
  await page.evaluate(
    async ({ canvas, navigation }) => {
      const channel = new BroadcastChannel("chalkpilot-display-v1");
      channel.postMessage({
        version: 1,
        type: "snapshot",
        payload: { agentState: "speaking", canvas, navigation },
      });
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      channel.close();
    },
    { canvas, navigation: navigation("navigation-1") },
  );

  const target = page.locator('[data-canvas-target="learning-mechanism"]');
  await expect(target).toBeVisible();
  await expect(target).toHaveAttribute("data-canvas-attention", "focus");
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return `${style.outlineStyle}:${style.outlineWidth}`;
      }),
    )
    .not.toBe("none:0px");
  await expect
    .poll(() => page.evaluate(() => window.navigationScrollCalls ?? []))
    .toEqual([{ target: "learning-mechanism", block: "center" }]);

  await publishNavigation(page, "navigation-2");
  await expect
    .poll(() => page.evaluate(() => window.navigationScrollCalls?.length ?? 0))
    .toBe(2);

  await publishNavigation(page, "navigation-3", "unknown-target");
  const error = page.locator("[data-display-navigation-error]");
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toHaveText("Canvas target is unavailable.");
  await expect
    .poll(() => page.evaluate(() => window.navigationScrollCalls?.length ?? 0))
    .toBe(2);

  await publishNavigation(page, "navigation-4");
  await expect(error).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.navigationScrollCalls?.length ?? 0))
    .toBe(3);
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
});

async function publishNavigation(
  page: import("@playwright/test").Page,
  requestId: string,
  targetId = "learning-mechanism",
) {
  await page.evaluate(
    async ({ id, target }) => {
      const channel = new BroadcastChannel("chalkpilot-display-v1");
      channel.postMessage({
        version: 1,
        type: "navigation",
        payload: {
          requestId: id,
          targetId: target,
          kind: "focus",
          issuedAt: "2026-07-24T10:00:00.000Z",
        },
      });
      await new Promise((resolve) => window.setTimeout(resolve, 50));
      channel.close();
    },
    { id: requestId, target: targetId },
  );
}

function navigation(requestId: string) {
  return {
    requestId,
    targetId: "learning-mechanism",
    kind: "focus" as const,
    issuedAt: "2026-07-24T10:00:00.000Z",
  };
}

async function createArtifactSession(request: APIRequestContext) {
  const sessionResponse = await request.post("/api/sessions");
  expect(sessionResponse.status()).toBe(201);
  const { id } = (await sessionResponse.json()) as { id: string };
  createdSessions.add(id);

  for (const section of artifactSections) {
    const response = await request.post(`/api/sessions/${id}/canvas`, {
      data: { action: "append", section },
    });
    expect(response.ok()).toBe(true);
  }
  const focus = await request.post(`/api/sessions/${id}/canvas`, {
    data: { action: "focus", sectionId: "retrieval-check" },
  });
  expect(focus.ok()).toBe(true);
  return id;
}
