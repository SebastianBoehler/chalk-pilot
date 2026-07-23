import { mkdir } from "node:fs/promises";
import { getRecordingPaths } from "../workspace/paths";
import {
  TRACK_KINDS,
  chunkMetadataSchema,
  recordingManifestSchema,
  recordingTimelineEventSchema,
  trackKindSchema,
  type ChunkMetadata,
  type RecordingManifest,
  type RecordingTimelineEvent,
  type TrackKind,
} from "./schema";
import {
  atomicWriteJson,
  isMissingFile,
  readJson,
  syncDirectory,
  writeManifest,
  writeDurableBytes,
} from "./repository-files";
import {
  combineContiguous,
  findMissing,
  getChunkPaths,
  identicalChunk,
  readStoredChunk,
  removeCombinedChunks,
  storedChunk,
  trackChunkDirectory,
} from "./repository-chunks";
import {
  finalizeManifest,
  listRecordingSummaries,
} from "./repository-manifests";

export function createRecordingRepository(root: string) {
  const queues = new Map<string, Promise<unknown>>();

  async function queue<T>(key: string, operation: () => Promise<T>) {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    queues.set(key, current);
    try {
      return await current;
    } finally {
      if (queues.get(key) === current) queues.delete(key);
    }
  }

  async function read(sessionId: string): Promise<RecordingManifest> {
    const paths = getRecordingPaths(root, sessionId);
    try {
      return recordingManifestSchema.parse(await readJson(paths.manifest));
    } catch (error) {
      if (isMissingFile(error))
        throw new Error(`Unknown recording: ${sessionId}`);
      throw error;
    }
  }

  async function create(sessionId: string): Promise<RecordingManifest> {
    const paths = getRecordingPaths(root, sessionId);
    return queue(sessionId, async () => {
      try {
        return await read(sessionId);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith("Unknown "))
          throw error;
      }

      await Promise.all([
        mkdir(paths.tracksDirectory, { recursive: true }),
        mkdir(paths.chunksDirectory, { recursive: true }),
      ]);
      await Promise.all(
        TRACK_KINDS.map((track) =>
          mkdir(trackChunkDirectory(paths.chunksDirectory, track), {
            recursive: true,
          }),
        ),
      );
      const manifest = recordingManifestSchema.parse({
        schemaVersion: 1,
        sessionId,
        state: "recording",
        startedAt: new Date().toISOString(),
        finalizedAt: null,
        durationMs: 0,
        tracks: Object.fromEntries(
          TRACK_KINDS.map((kind) => [
            kind,
            {
              kind,
              health: "healthy",
              mimeType: null,
              durationMs: 0,
              byteSize: 0,
              path: `tracks/${kind}.webm`,
              acknowledgedSequences: [],
              missingSequences: [],
              interruption: null,
            },
          ]),
        ),
        transcriptPath: "transcript.json",
        canvasEventsPath: "canvas-events.json",
      });
      await Promise.all([
        atomicWriteJson(paths.transcript, []),
        atomicWriteJson(paths.canvasEvents, []),
      ]);
      await writeManifest(paths.manifest, manifest);
      return manifest;
    });
  }

  async function appendChunk(
    sessionId: string,
    rawTrack: TrackKind,
    sequence: number,
    rawMetadata: ChunkMetadata,
    rawBytes: Uint8Array,
  ): Promise<void> {
    const track = trackKindSchema.parse(rawTrack);
    const metadata = chunkMetadataSchema.parse(rawMetadata);
    if (!Number.isInteger(sequence) || sequence < 0)
      throw new Error("Invalid chunk sequence");
    const bytes = Buffer.from(rawBytes);
    if (bytes.length === 0) throw new Error("Recording chunks cannot be empty");

    await queue(sessionId, async () => {
      const manifest = await read(sessionId);
      assertMutable(manifest);
      const currentTrack = manifest.tracks[track];
      if (currentTrack.health === "interrupted")
        throw new Error(`Track ${track} is interrupted`);
      if (currentTrack.mimeType && currentTrack.mimeType !== metadata.mimeType)
        throw new Error(`Track ${track} MIME type changed`);

      const stored = storedChunk(sequence, metadata, bytes);
      const chunkPaths = getChunkPaths(root, sessionId, track, sequence);
      const existing = await readStoredChunk(chunkPaths.metadata);
      if (existing) {
        if (!(await identicalChunk(existing, stored, chunkPaths.bytes, bytes)))
          throw new Error(`Conflicting chunk sequence ${sequence}`);
      } else {
        await writeDurableBytes(chunkPaths.bytes, bytes);
        await atomicWriteJson(chunkPaths.metadata, stored);
        await syncDirectory(chunkPaths.bytes);
      }

      const acknowledgedSequences = [
        ...new Set([...currentTrack.acknowledgedSequences, sequence]),
      ].sort((left, right) => left - right);
      const combined = await combineContiguous(
        root,
        sessionId,
        track,
        acknowledgedSequences,
      );
      const next = recordingManifestSchema.parse({
        ...manifest,
        tracks: {
          ...manifest.tracks,
          [track]: {
            ...currentTrack,
            mimeType: currentTrack.mimeType ?? metadata.mimeType,
            acknowledgedSequences,
            missingSequences: findMissing(acknowledgedSequences),
            durationMs: combined.durationMs,
            byteSize: combined.byteSize,
          },
        },
      });
      await writeManifest(getRecordingPaths(root, sessionId).manifest, next);
    });
  }

  async function appendTimeline(
    sessionId: string,
    rawEvent: RecordingTimelineEvent,
  ): Promise<void> {
    const event = recordingTimelineEventSchema.parse(rawEvent);
    await queue(sessionId, async () => {
      assertMutable(await read(sessionId));
      const paths = getRecordingPaths(root, sessionId);
      const path =
        event.type === "transcript" ? paths.transcript : paths.canvasEvents;
      const existing = recordingTimelineEventSchema
        .array()
        .parse(await readJson(path));
      await atomicWriteJson(path, [...existing, event]);
      await syncDirectory(path);
    });
  }

  async function interrupt(
    sessionId: string,
    rawTrack: TrackKind,
    message: string,
  ): Promise<RecordingManifest> {
    const track = trackKindSchema.parse(rawTrack);
    const trimmedMessage = message.trim();
    if (!trimmedMessage) throw new Error("Interruption message is required");
    return queue(sessionId, async () => {
      const manifest = await read(sessionId);
      assertMutable(manifest);
      const next = recordingManifestSchema.parse({
        ...manifest,
        state: "interrupted",
        tracks: {
          ...manifest.tracks,
          [track]: {
            ...manifest.tracks[track],
            health: "interrupted",
            interruption: {
              message: trimmedMessage,
              at: new Date().toISOString(),
            },
          },
        },
      });
      await writeManifest(getRecordingPaths(root, sessionId).manifest, next);
      return next;
    });
  }

  async function finalize(
    sessionId: string,
    durationMs: number,
  ): Promise<RecordingManifest> {
    if (!Number.isFinite(durationMs) || durationMs < 0)
      throw new Error("Invalid recording duration");
    return queue(sessionId, async () => {
      const manifest = await read(sessionId);
      if (manifest.finalizedAt) {
        if (manifest.durationMs === durationMs) return manifest;
        throw new Error("Recording already finalized with another duration");
      }
      const finalizedAt = new Date().toISOString();
      const next = finalizeManifest(manifest, durationMs, finalizedAt);
      await writeManifest(getRecordingPaths(root, sessionId).manifest, next);
      await removeCombinedChunks(root, next);
      return next;
    });
  }

  async function list() {
    return listRecordingSummaries(root);
  }

  return {
    create,
    appendChunk,
    appendTimeline,
    interrupt,
    finalize,
    read,
    list,
  };
}

export type RecordingRepository = ReturnType<typeof createRecordingRepository>;

function assertMutable(manifest: RecordingManifest) {
  if (manifest.finalizedAt) throw new Error("Recording is already finalized");
}
