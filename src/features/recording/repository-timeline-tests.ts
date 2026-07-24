import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createRecordingRepository } from "./repository";

export function registerTimelineRepositoryTests(getRoot: () => string) {
  it("partitions validated transcript, canvas, and navigation timeline events", async () => {
    const root = getRoot();
    const repository = createRecordingRepository(root);
    await repository.create("session-1");

    await repository.appendTimeline("session-1", {
      type: "transcript",
      speaker: "user",
      startMs: 100,
      endMs: 900,
      text: "Differentiate the outside first.",
    });
    await repository.appendTimeline("session-1", {
      type: "canvas",
      offsetMs: 1_000,
      revision: { version: 1, focusId: null, order: [], sections: {} },
    });
    await repository.appendTimeline("session-1", {
      type: "navigation",
      offsetMs: 1_200,
      navigation: {
        requestId: "navigation-1",
        targetId: "derivative",
        kind: "focus",
        issuedAt: "2026-07-24T10:00:00.000Z",
      },
    });

    expect(
      JSON.parse(
        await readFile(
          join(root, "sessions/session-1/recordings/transcript.json"),
          "utf8",
        ),
      ),
    ).toHaveLength(1);
    expect(
      JSON.parse(
        await readFile(
          join(root, "sessions/session-1/recordings/canvas-events.json"),
          "utf8",
        ),
      ),
    ).toEqual([
      {
        type: "canvas",
        offsetMs: 1_000,
        revision: { version: 1, focusId: null, order: [], sections: {} },
      },
      {
        type: "navigation",
        offsetMs: 1_200,
        navigation: {
          requestId: "navigation-1",
          targetId: "derivative",
          kind: "focus",
          issuedAt: "2026-07-24T10:00:00.000Z",
        },
      },
    ]);
    await expect(repository.readTimeline("session-1")).resolves.toEqual({
      transcript: [
        {
          type: "transcript",
          speaker: "user",
          startMs: 100,
          endMs: 900,
          text: "Differentiate the outside first.",
        },
      ],
      canvasEvents: [
        {
          type: "canvas",
          offsetMs: 1_000,
          revision: { version: 1, focusId: null, order: [], sections: {} },
        },
      ],
      navigationEvents: [
        {
          type: "navigation",
          offsetMs: 1_200,
          navigation: {
            requestId: "navigation-1",
            targetId: "derivative",
            kind: "focus",
            issuedAt: "2026-07-24T10:00:00.000Z",
          },
        },
      ],
    });
  });
}
