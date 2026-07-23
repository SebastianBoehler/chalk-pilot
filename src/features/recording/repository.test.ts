// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRecordingRepository,
  type RecordingRepository,
} from "./repository";
import {
  chunkMetadata,
  registerChunkRepositoryTests,
} from "./repository-chunk-tests";
import { recordingManifestSchema } from "./schema";

async function appendRequiredChunks(repository: RecordingRepository) {
  for (const track of [
    "board",
    "speaker",
    "canvas",
    "microphone",
    "desktop-audio",
  ] as const) {
    await repository.appendChunk(
      "session-1",
      track,
      0,
      chunkMetadata,
      Buffer.from(track),
    );
  }
}

describe("RecordingRepository", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-recordings-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  registerChunkRepositoryTests(() => root);

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
    await appendRequiredChunks(repository);

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

  it("interrupts finalization when a required track has no chunks", async () => {
    const repository = createRecordingRepository(root);
    await repository.create("session-1");
    await repository.appendChunk(
      "session-1",
      "board",
      0,
      chunkMetadata,
      Buffer.from("board"),
    );

    const manifest = await repository.finalize("session-1", 2_000);

    expect(manifest.state).toBe("interrupted");
    expect(manifest.tracks.speaker).toMatchObject({
      health: "interrupted",
      interruption: { message: "No chunks acknowledged" },
    });
  });

  it("recovers persisted manifests, chunks, and summaries after restart", async () => {
    const firstRepository = createRecordingRepository(root);
    await firstRepository.create("session-1");
    await appendRequiredChunks(firstRepository);
    await mkdir(join(root, "sessions", "unrecorded"), { recursive: true });

    const recoveredRepository = createRecordingRepository(root);
    const recovered = await recoveredRepository.read("session-1");
    const summaries = await recoveredRepository.list();

    expect(recovered.tracks.canvas.acknowledgedSequences).toEqual([0]);
    expect(summaries).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        state: "recording",
        availableTracks: [
          "board",
          "speaker",
          "canvas",
          "microphone",
          "desktop-audio",
        ],
      }),
    ]);
    expect(
      await recoveredRepository.finalize("session-1", 2_000),
    ).toMatchObject({ state: "complete" });
  });

  it("reconciles a durable chunk sidecar after a pre-acknowledgement crash", async () => {
    const repository = createRecordingRepository(root);
    const created = await repository.create("session-1");
    await appendRequiredChunks(repository);
    const manifestPath = join(
      root,
      "sessions/session-1/recordings/manifest.json",
    );
    const persisted = JSON.parse(await readFile(manifestPath, "utf8"));
    persisted.tracks.board = created.tracks.board;
    await writeFile(manifestPath, JSON.stringify(persisted), "utf8");

    const recoveredRepository = createRecordingRepository(root);
    const recovered = await recoveredRepository.read("session-1");

    expect(recovered.tracks.board).toMatchObject({
      acknowledgedSequences: [0],
      byteSize: 5,
    });
    expect(
      JSON.parse(await readFile(manifestPath, "utf8")).tracks.board
        .acknowledgedSequences,
    ).toEqual([0]);
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

  it("restores chunk bytes when retrying a sidecar-only journal entry", async () => {
    const repository = createRecordingRepository(root);
    const created = await repository.create("session-1");
    await repository.appendChunk(
      "session-1",
      "board",
      0,
      chunkMetadata,
      Buffer.from("board"),
    );
    const recording = join(root, "sessions/session-1/recordings");
    const manifestPath = join(recording, "manifest.json");
    const persisted = JSON.parse(await readFile(manifestPath, "utf8"));
    persisted.tracks.board = created.tracks.board;
    await writeFile(manifestPath, JSON.stringify(persisted), "utf8");
    await rm(join(recording, "chunks/board/0.webm"));

    await createRecordingRepository(root).appendChunk(
      "session-1",
      "board",
      0,
      chunkMetadata,
      Buffer.from("board"),
    );

    expect(await readFile(join(recording, "tracks/board.webm"), "utf8")).toBe(
      "board",
    );
  });

  it.each([
    ["kind", { kind: "speaker" }],
    ["path", { path: "tracks/speaker.webm" }],
  ])("rejects a track whose %s does not match its key", async (_, change) => {
    const manifest = await createRecordingRepository(root).create("session-1");
    const invalid = {
      ...manifest,
      tracks: {
        ...manifest.tracks,
        board: { ...manifest.tracks.board, ...change },
      },
    };

    expect(() => recordingManifestSchema.parse(invalid)).toThrow(
      "Track must match its manifest key",
    );
  });
});
