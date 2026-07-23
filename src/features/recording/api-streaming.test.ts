// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import {
  chunkRequest,
  createApiFixture,
  jsonRequest,
  type RecordingApiFixture,
} from "./api-test-helpers";

describe("recording API streams", () => {
  let fixture: RecordingApiFixture | undefined;

  afterEach(async () => {
    await fixture?.dispose();
    fixture = undefined;
  });

  it("serves byte ranges from a finalized track", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("0123456789")),
    );
    await fixture.api.finalizeRecording(
      "session-1",
      jsonRequest({ durationMs: 2_000 }),
    );

    const response = await fixture.api.streamTrack(
      "session-1",
      "board",
      new Request("http://localhost/track", {
        headers: { range: "bytes=2-5" },
      }),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("2345");
  });

  it("returns 404 when a finalized track is unavailable", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await fixture.api.finalizeRecording(
      "session-1",
      jsonRequest({ durationMs: 0 }),
    );

    const response = await fixture.api.streamTrack(
      "session-1",
      "speaker",
      new Request("http://localhost/track"),
    );

    expect(response.status).toBe(404);
  });

  it("streams the portable package with stable ZIP entry names", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("board")),
    );
    await fixture.api.appendTimeline(
      "session-1",
      jsonRequest({
        type: "transcript",
        speaker: "user",
        startMs: 0,
        endMs: 500,
        text: "What is a gradient?",
      }),
    );
    await fixture.api.finalizeRecording(
      "session-1",
      jsonRequest({ durationMs: 2_000 }),
    );

    const response = await fixture.api.exportRecording("session-1");
    const entries = readCentralDirectoryNames(
      Buffer.from(await response.arrayBuffer()),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="session-1.chalkpilot.zip"',
    );
    expect(entries).toEqual([
      "manifest.json",
      "tracks/board.webm",
      "transcript.json",
      "canvas-events.json",
    ]);
  });
});

function readCentralDirectoryNames(zip: Buffer): string[] {
  const names: string[] = [];
  for (let offset = 0; offset <= zip.length - 46; offset += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) continue;
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    names.push(zip.subarray(offset + 46, offset + 46 + nameLength).toString());
    offset += 45 + nameLength + extraLength + commentLength;
  }
  return names;
}
