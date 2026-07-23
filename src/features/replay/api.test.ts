// @vitest-environment node

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createApiFixture,
  type RecordingApiFixture,
} from "@/features/recording/api-test-helpers";

describe("replay timeline API", () => {
  let fixture: RecordingApiFixture | undefined;

  afterEach(async () => {
    await fixture?.dispose();
    fixture = undefined;
  });

  it("returns separately validated transcript and canvas arrays", async () => {
    fixture = await createApiFixture();
    await fixture.repository.create("session-1");
    await fixture.repository.appendTimeline("session-1", {
      type: "transcript",
      speaker: "assistant",
      startMs: 100,
      endMs: 900,
      text: "A token is a model input unit.",
    });
    await fixture.repository.appendTimeline("session-1", {
      type: "canvas",
      offsetMs: 100,
      revision: {
        version: 1,
        focusId: null,
        order: [],
        sections: {},
      },
    });

    const response = await fixture.api.readTimeline("session-1");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      transcript: [{ type: "transcript" }],
      canvasEvents: [{ type: "canvas" }],
    });
  });

  it("returns an explicit error for malformed persisted evidence", async () => {
    fixture = await createApiFixture();
    await fixture.repository.create("session-1");
    await writeFile(
      join(fixture.root, "sessions/session-1/recordings/canvas-events.json"),
      JSON.stringify([
        { type: "canvas", offsetMs: 0, revision: { version: 99 } },
      ]),
    );

    const response = await fixture.api.readTimeline("session-1");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The recording operation failed.",
    });
  });
});
