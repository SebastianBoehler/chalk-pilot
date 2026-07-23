// @vitest-environment node

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  chunkRequest,
  createApiFixture,
  jsonRequest,
  type RecordingApiFixture,
} from "./api-test-helpers";
import { createRecordingApi, MAX_CHUNK_BYTES } from "./api";

describe("recording API mutations", () => {
  let fixture: RecordingApiFixture | undefined;

  afterEach(async () => {
    await fixture?.dispose();
    fixture = undefined;
  });

  it("rejects recording creation for an unknown session", async () => {
    fixture = await createApiFixture();

    const response = await fixture.api.createRecording("missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Session not found." });
  });

  it("rejects malformed chunk metadata headers", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");

    const response = await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("chunk"), {
        "x-chalkpilot-duration-ms": "not-a-number",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a malformed declared content length", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");

    const response = await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("chunk"), {
        "content-length": "12x",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects unsupported chunk MIME types", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");

    const response = await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("chunk"), {
        "content-type": "video/mp4",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects chunks larger than 16 MiB", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");

    const response = await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(new Uint8Array(MAX_CHUNK_BYTES + 1)),
    );

    expect(response.status).toBe(413);
  });

  it("accepts an identical chunk retry without duplicating bytes", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    const bytes = Buffer.from("same chunk");

    const first = await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(bytes),
    );
    const repeated = await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(bytes),
    );
    const manifest = await (await fixture.api.readManifest("session-1")).json();

    expect(first.status).toBe(204);
    expect(repeated.status).toBe(204);
    expect(manifest.tracks.board).toMatchObject({
      acknowledgedSequences: [0],
      byteSize: bytes.length,
    });
  });

  it("durably interrupts one track and preserves it through finalization", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("board")),
    );

    const interrupted = await fixture.api.interruptRecording(
      "session-1",
      "speaker",
      jsonRequest({ message: "The speaker video track ended." }),
    );
    const finalized = await fixture.api.finalizeRecording(
      "session-1",
      jsonRequest({ durationMs: 2_000 }),
    );

    expect(interrupted.status).toBe(200);
    expect(await interrupted.json()).toMatchObject({
      state: "interrupted",
      tracks: {
        board: { health: "healthy" },
        speaker: {
          health: "interrupted",
          interruption: { message: "The speaker video track ended." },
        },
      },
    });
    expect(await finalized.json()).toMatchObject({
      state: "interrupted",
      tracks: {
        board: { health: "complete" },
        speaker: { health: "interrupted" },
      },
    });
  });

  it("rejects chunk and timeline mutations after finalization", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await fixture.api.appendChunk(
      "session-1",
      "board",
      "0",
      chunkRequest(Buffer.from("chunk")),
    );
    expect(
      (
        await fixture.api.finalizeRecording(
          "session-1",
          jsonRequest({ durationMs: 2_000 }),
        )
      ).status,
    ).toBe(200);

    const chunk = await fixture.api.appendChunk(
      "session-1",
      "board",
      "1",
      chunkRequest(Buffer.from("late")),
    );
    const timeline = await fixture.api.appendTimeline(
      "session-1",
      jsonRequest({
        type: "canvas",
        offsetMs: 2_000,
        revision: { focusId: null },
      }),
    );

    expect(chunk.status).toBe(409);
    expect(timeline.status).toBe(409);
  });

  it("returns an explicit server error for unexpected repository failures", async () => {
    fixture = await createApiFixture();
    const repository = {
      ...fixture.repository,
      list: async () => {
        throw new Error("disk unavailable");
      },
    };
    const api = createRecordingApi({
      repository,
      rootDirectory: fixture.root,
      sessionExists: async () => true,
    });

    const response = await api.listRecordings();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The recording operation failed.",
    });
  });

  it("maps a corrupt persisted manifest to a server error", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await writeFile(
      join(fixture.root, "sessions/session-1/recordings/manifest.json"),
      "{}",
    );

    const response = await fixture.api.readManifest("session-1");

    expect(response.status).toBe(500);
  });

  it("maps corrupt persisted timeline JSON to a server error", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");
    await writeFile(
      join(fixture.root, "sessions/session-1/recordings/transcript.json"),
      "{",
    );

    const response = await fixture.api.appendTimeline(
      "session-1",
      jsonRequest({
        type: "transcript",
        speaker: "user",
        startMs: 0,
        endMs: 100,
        text: "hello",
      }),
    );

    expect(response.status).toBe(500);
  });

  it("keeps malformed client JSON mapped to a client error", async () => {
    fixture = await createApiFixture();
    await fixture.api.createRecording("session-1");

    const response = await fixture.api.finalizeRecording(
      "session-1",
      new Request("http://localhost/finalize", {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
  });
});
