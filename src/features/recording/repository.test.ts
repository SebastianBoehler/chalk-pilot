// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRecordingRepository } from "./repository";

const chunkMetadata = {
  offsetMs: 0,
  durationMs: 2_000,
  mimeType: "video/webm;codecs=vp9",
};

describe("RecordingRepository", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-recordings-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  it("creates a versioned recording with five fixed tracks", async () => {
    const manifest = await createRecordingRepository(root).create("session-1");

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      sessionId: "session-1",
      state: "recording",
      durationMs: 0,
      finalizedAt: null,
      transcriptPath: "transcript.json",
      canvasEventsPath: "canvas-events.json",
    });
    expect(Object.keys(manifest.tracks)).toEqual([
      "board",
      "speaker",
      "canvas",
      "microphone",
      "desktop-audio",
    ]);
    expect(manifest.tracks.board).toMatchObject({
      kind: "board",
      health: "healthy",
      mimeType: null,
      durationMs: 0,
      byteSize: 0,
      path: "tracks/board.webm",
      acknowledgedSequences: [],
      missingSequences: [],
      interruption: null,
    });

    const stored = JSON.parse(
      await readFile(
        join(root, "sessions", "session-1", "recordings", "manifest.json"),
        "utf8",
      ),
    );
    expect(stored).toEqual(manifest);
  });

  it("combines ordered chunks into the track", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");

    await repository.appendChunk(
      "session-1",
      "board",
      0,
      chunkMetadata,
      Buffer.from("first"),
    );
    await repository.appendChunk(
      "session-1",
      "board",
      1,
      { ...chunkMetadata, offsetMs: 2_000 },
      Buffer.from("second"),
    );

    expect(
      await readFile(
        join(root, "sessions/session-1/recordings/tracks/board.webm"),
        "utf8",
      ),
    ).toBe("firstsecond");
    expect((await repository.read("session-1")).tracks.board).toMatchObject({
      acknowledgedSequences: [0, 1],
      byteSize: 11,
      durationMs: 4_000,
    });
  });

  it("accepts an identical repeated chunk without duplicating bytes", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");
    const bytes = Buffer.from("one");

    await repository.appendChunk("session-1", "board", 0, chunkMetadata, bytes);
    await repository.appendChunk("session-1", "board", 0, chunkMetadata, bytes);

    expect(
      await readFile(
        join(root, "sessions/session-1/recordings/tracks/board.webm"),
        "utf8",
      ),
    ).toBe("one");
  });

  it("rejects a conflicting repeated sequence", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");
    await repository.appendChunk(
      "session-1",
      "board",
      0,
      chunkMetadata,
      Buffer.from("original"),
    );

    await expect(
      repository.appendChunk(
        "session-1",
        "board",
        0,
        chunkMetadata,
        Buffer.from("changed"),
      ),
    ).rejects.toThrow("Conflicting chunk sequence 0");
  });

  it("records sequence gaps and combines only the contiguous prefix", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");
    await repository.appendChunk(
      "session-1",
      "board",
      0,
      chunkMetadata,
      Buffer.from("zero"),
    );
    await repository.appendChunk(
      "session-1",
      "board",
      2,
      { ...chunkMetadata, offsetMs: 4_000 },
      Buffer.from("two"),
    );

    const manifest = await repository.finalize("session-1", 6_000);

    expect(manifest.state).toBe("interrupted");
    expect(manifest.tracks.board).toMatchObject({
      health: "interrupted",
      missingSequences: [1],
      acknowledgedSequences: [0, 2],
      byteSize: 4,
      durationMs: 2_000,
    });
    expect(
      await readFile(
        join(root, "sessions/session-1/recordings/tracks/board.webm"),
        "utf8",
      ),
    ).toBe("zero");
  });

  it("marks an interrupted track without stopping healthy tracks", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");

    const manifest = await repository.interrupt(
      "session-1",
      "speaker",
      "Presenter track ended",
    );

    expect(manifest.state).toBe("interrupted");
    expect(manifest.tracks.speaker).toMatchObject({
      health: "interrupted",
      interruption: { message: "Presenter track ended" },
    });
    expect(manifest.tracks.board.health).toBe("healthy");
  });

  it("finalizes healthy tracks and is idempotent", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");
    await repository.appendChunk(
      "session-1",
      "microphone",
      0,
      { ...chunkMetadata, mimeType: "audio/webm;codecs=opus" },
      Buffer.from("audio"),
    );

    const first = await repository.finalize("session-1", 2_000);
    const repeated = await repository.finalize("session-1", 2_000);

    expect(repeated).toEqual(first);
    expect(first).toMatchObject({
      state: "complete",
      durationMs: 2_000,
    });
    expect(first.finalizedAt).not.toBeNull();
    expect(first.tracks.microphone.health).toBe("complete");
    await expect(
      repository.appendChunk(
        "session-1",
        "microphone",
        1,
        chunkMetadata,
        Buffer.from("late"),
      ),
    ).rejects.toThrow("already finalized");
  });

  it("recovers persisted manifests, chunks, and summaries after restart", async () => {
    const firstRepository = createRecordingRepository(root);
    await firstRepository.create("session-1");
    await firstRepository.appendChunk(
      "session-1",
      "canvas",
      0,
      chunkMetadata,
      Buffer.from("canvas"),
    );
    await mkdir(join(root, "sessions", "unrecorded"), { recursive: true });

    const recoveredRepository = createRecordingRepository(root);
    const recovered = await recoveredRepository.read("session-1");
    const summaries = await recoveredRepository.list();

    expect(recovered.tracks.canvas.acknowledgedSequences).toEqual([0]);
    expect(summaries).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        state: "recording",
        availableTracks: ["canvas"],
      }),
    ]);
    expect(
      await recoveredRepository.finalize("session-1", 2_000),
    ).toMatchObject({ state: "complete" });
  });

  it("persists validated transcript and canvas timeline events", async () => {
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

  it("rejects traversal without writing outside the recording root", async () => {
    const repository = createRecordingRepository(root);

    await expect(repository.create("../escaped")).rejects.toThrow(
      "Invalid identifier",
    );
    await expect(repository.read("/tmp/escaped")).rejects.toThrow(
      "Invalid identifier",
    );
  });
});
