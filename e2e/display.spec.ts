import { rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type APIRequestContext } from "@playwright/test";

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
      "retrieval-loop",
      "retrieval-check",
      "compare-recall",
      "invalid-diagram",
    ],
    sections: {
      "recall-growth": { kind: "chart" },
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
      payload: { agentState: "speaking", canvas: snapshot },
    });
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    channel.close();
  }, canvas);

  await expect(page.getByText("speaking")).toBeVisible();
  await expect(
    page.getByRole("figure", { name: "Recall growth" }),
  ).toBeVisible();
  await expect(page.getByLabel("Chart legend")).toContainText("Recall");
  await expect(page.getByLabel("Learning sequence")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Retrieve from memory" }),
  ).toBeVisible();
  await expect(page.getByText("Compare with notes")).toHaveCount(0);
  await expect(page.getByLabel("Prediction checkpoint")).toContainText(
    "Which step comes before checking notes?",
  );
  await expect(page.getByText("Recall versus rereading")).toBeVisible();

  await expect(
    page.getByText("This diagram could not be rendered."),
  ).toBeVisible();
  await expect(page.getByText("Syntax error in text")).toHaveCount(0);
  await expect(page.locator('[id^="dchalkpilot-"]')).toHaveCount(0);
  await expect(page.locator('[aria-roledescription="error"]')).toHaveCount(0);
});

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

const artifactSections = [
  {
    id: "recall-growth",
    kind: "chart",
    title: "Recall growth",
    data: {
      variant: "line",
      xLabel: "Practice round",
      yLabel: "Correct recalls",
      series: [
        {
          name: "Recall",
          points: [
            { x: 1, y: 2 },
            { x: 2, y: 5 },
            { x: 3, y: 8 },
          ],
        },
      ],
    },
  },
  {
    id: "retrieval-loop",
    kind: "sequence",
    title: "Retrieval loop",
    data: {
      activeStepId: "recall",
      reveal: "active",
      steps: [
        {
          id: "recall",
          title: "Retrieve from memory",
          content: "Say what you remember before seeing the answer.",
        },
        {
          id: "check",
          title: "Check the evidence",
          content: "Compare with notes and repair only the missing link.",
        },
        {
          id: "apply",
          title: "Apply again",
          content: "Use the idea in a fresh example.",
        },
      ],
    },
  },
  {
    id: "retrieval-check",
    kind: "checkpoint",
    title: "Prediction before feedback",
    data: {
      mode: "prediction",
      prompt: "Which step comes before checking notes?",
      choices: ["Retrieve from memory", "Read the answer first"],
      hint: "Commit to your best guess before seeing feedback.",
      expectedAnswer: "Retrieve from memory.",
      feedback: "Effortful recall makes the gap visible.",
      status: "unanswered",
      showHint: false,
      showAnswer: false,
      showFeedback: false,
    },
  },
  {
    id: "compare-recall",
    kind: "comparison",
    title: "Recall versus rereading",
    data: {
      columns: [
        {
          heading: "Retrieve",
          summary: "Attempt before feedback.",
          points: ["Makes gaps visible", "Strengthens recall routes"],
          emphasis: "positive",
        },
        {
          heading: "Reread",
          summary: "Review without a prior attempt.",
          points: ["Feels fluent", "Can hide gaps"],
          emphasis: "caution",
        },
      ],
    },
  },
  {
    id: "invalid-diagram",
    kind: "mermaid",
    title: "Contained diagram failure",
    content: "flowchart TD\nA -->",
  },
] as const;
