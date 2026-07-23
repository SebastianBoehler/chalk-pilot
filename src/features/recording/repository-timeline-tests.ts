import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createRecordingRepository } from "./repository";

export function registerTimelineRepositoryTests(getRoot: () => string) {
  it("persists validated transcript and canvas timeline events", async () => {
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
      revision: { version: 1, order: [] },
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
    ).toHaveLength(1);
  });
}
