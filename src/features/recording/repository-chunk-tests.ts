import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createRecordingRepository } from "./repository";

export const chunkMetadata = {
  offsetMs: 0,
  durationMs: 2_000,
  mimeType: "video/webm;codecs=vp9",
};

export function registerChunkRepositoryTests(getRoot: () => string) {
  it("creates a versioned recording with five fixed tracks", async () => {
    const root = getRoot();
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
      path: "tracks/board.webm",
      acknowledgedSequences: [],
      missingSequences: [],
      interruption: null,
    });
    const stored = JSON.parse(
      await readFile(
        join(root, "sessions/session-1/recordings/manifest.json"),
        "utf8",
      ),
    );
    expect(stored).toEqual(manifest);
  });

  it("combines ordered chunks into the track", async () => {
    const root = getRoot();
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
    const root = getRoot();
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
    const repository = createRecordingRepository(getRoot());
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
}
