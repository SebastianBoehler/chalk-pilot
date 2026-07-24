import { expect, type APIRequestContext, type Locator } from "@playwright/test";

export async function addNavigableTimeline(
  request: APIRequestContext,
  sessionId: string,
) {
  const url = `/api/sessions/${sessionId}/recording/timeline`;
  const revision = {
    focusId: "explanation",
    order: ["explanation"],
    sections: {
      explanation: {
        id: "explanation",
        kind: "markdown",
        title: "Explanation",
        content: "A durable semantic target.",
        createdAt: "2026-07-24T10:00:00.000Z",
        updatedAt: "2026-07-24T10:00:00.000Z",
      },
    },
    version: 1,
  };
  for (const event of [
    { type: "canvas", offsetMs: 0, revision },
    {
      type: "navigation",
      offsetMs: 2_000,
      navigation: {
        requestId: "navigation-1",
        targetId: "explanation",
        kind: "focus",
        issuedAt: "2026-07-24T10:00:00.000Z",
      },
    },
    {
      type: "canvas",
      offsetMs: 3_000,
      revision: {
        ...revision,
        sections: {
          explanation: {
            ...revision.sections.explanation,
            content: "A later revision without another navigation request.",
          },
        },
      },
    },
  ]) {
    expect((await request.post(url, { data: event })).status()).toBe(201);
  }
}

export async function seekReplay(canvas: Locator, currentTime: number) {
  await canvas.evaluate((media: HTMLMediaElement, time: number) => {
    media.currentTime = time;
    media.dispatchEvent(new Event("timeupdate"));
  }, currentTime);
}
