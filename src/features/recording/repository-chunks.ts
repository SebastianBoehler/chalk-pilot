import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { z } from "zod";
import { containedPath, getRecordingPaths } from "../workspace/paths";
import {
  TRACK_KINDS,
  chunkMetadataSchema,
  recordingManifestSchema,
  type ChunkMetadata,
  type RecordingManifest,
  type TrackKind,
} from "./schema";
import {
  combineDurableFiles,
  isMissingFile,
  readJson,
  syncDirectory,
} from "./repository-files";

const storedChunkSchema = chunkMetadataSchema
  .extend({
    sequence: z.number().int().nonnegative(),
    byteSize: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type StoredChunk = z.infer<typeof storedChunkSchema>;

export function trackChunkDirectory(chunksDirectory: string, track: TrackKind) {
  return containedPath(chunksDirectory, track);
}

export function getChunkPaths(
  root: string,
  sessionId: string,
  track: TrackKind,
  sequence: number,
) {
  const recording = getRecordingPaths(root, sessionId);
  const directory = trackChunkDirectory(recording.chunksDirectory, track);
  return {
    bytes: containedPath(directory, `${sequence}.webm`),
    metadata: containedPath(directory, `${sequence}.json`),
  };
}

export function storedChunk(
  sequence: number,
  metadata: ChunkMetadata,
  bytes: Uint8Array,
): StoredChunk {
  return storedChunkSchema.parse({
    ...metadata,
    sequence,
    byteSize: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

export async function readStoredChunk(
  metadataPath: string,
): Promise<StoredChunk | null> {
  try {
    return storedChunkSchema.parse(await readJson(metadataPath));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

export async function identicalChunk(
  existing: StoredChunk,
  candidate: StoredChunk,
  bytesPath: string,
  candidateBytes: Uint8Array,
) {
  if (JSON.stringify(existing) !== JSON.stringify(candidate)) return false;
  const existingBytes = await readFile(bytesPath);
  return existingBytes.equals(Buffer.from(candidateBytes));
}

async function assertChunkMatchesSidecar(
  chunk: StoredChunk,
  bytesPath: string,
) {
  let bytes;
  try {
    bytes = await readFile(bytesPath);
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== chunk.byteSize || digest !== chunk.sha256)
    throw new Error(`Corrupt recording chunk sequence ${chunk.sequence}`);
  return true;
}

export function findMissing(sequences: number[]): number[] {
  if (sequences.length === 0) return [];
  const acknowledged = new Set(sequences);
  const missing: number[] = [];
  for (let sequence = 0; sequence < sequences.at(-1)!; sequence += 1) {
    if (!acknowledged.has(sequence)) missing.push(sequence);
  }
  return missing;
}

export async function combineContiguous(
  root: string,
  sessionId: string,
  track: TrackKind,
  acknowledgedSequences: number[],
) {
  const acknowledged = new Set(acknowledgedSequences);
  const sources: string[] = [];
  const chunks: StoredChunk[] = [];
  for (let sequence = 0; acknowledged.has(sequence); sequence += 1) {
    const paths = getChunkPaths(root, sessionId, track, sequence);
    const metadata = await readStoredChunk(paths.metadata);
    if (!metadata)
      throw new Error(`Missing metadata for ${track} chunk ${sequence}`);
    sources.push(paths.bytes);
    chunks.push(metadata);
  }
  if (sources.length > 0) {
    const recording = getRecordingPaths(root, sessionId);
    const destination = containedPath(
      recording.tracksDirectory,
      `${track}.webm`,
    );
    await combineDurableFiles(sources, destination);
    await syncDirectory(destination);
  }
  return {
    byteSize: chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0),
    durationMs: chunks.reduce(
      (end, chunk) => Math.max(end, chunk.offsetMs + chunk.durationMs),
      0,
    ),
  };
}

export async function reconcileDurableChunks(
  root: string,
  manifest: RecordingManifest,
): Promise<RecordingManifest> {
  if (manifest.finalizedAt) return manifest;
  let tracks = manifest.tracks;
  let changed = false;
  for (const track of TRACK_KINDS) {
    const recording = getRecordingPaths(root, manifest.sessionId);
    const directory = trackChunkDirectory(recording.chunksDirectory, track);
    const entries = await readdir(directory);
    const current = tracks[track];
    const acknowledged = new Set(current.acknowledgedSequences);
    const discovered: StoredChunk[] = [];
    for (const entry of entries) {
      const match = /^(\d+)\.json$/.exec(entry);
      if (!match) continue;
      const sequence = Number(match[1]);
      if (acknowledged.has(sequence)) continue;
      const paths = getChunkPaths(root, manifest.sessionId, track, sequence);
      const chunk = await readStoredChunk(paths.metadata);
      if (!chunk || chunk.sequence !== sequence)
        throw new Error(`Invalid ${track} chunk sidecar ${entry}`);
      if (!(await assertChunkMatchesSidecar(chunk, paths.bytes))) continue;
      if (current.mimeType && chunk.mimeType !== current.mimeType)
        throw new Error(`Track ${track} MIME type changed`);
      discovered.push(chunk);
    }
    if (discovered.length === 0) continue;
    changed = true;
    const acknowledgedSequences = [
      ...acknowledged,
      ...discovered.map((chunk) => chunk.sequence),
    ].sort((left, right) => left - right);
    const combined = await combineContiguous(
      root,
      manifest.sessionId,
      track,
      acknowledgedSequences,
    );
    tracks = {
      ...tracks,
      [track]: {
        ...current,
        mimeType: current.mimeType ?? discovered[0]!.mimeType,
        acknowledgedSequences,
        missingSequences: findMissing(acknowledgedSequences),
        durationMs: combined.durationMs,
        byteSize: combined.byteSize,
      },
    };
  }
  return changed
    ? recordingManifestSchema.parse({ ...manifest, tracks })
    : manifest;
}

export async function removeCombinedChunks(
  root: string,
  manifest: RecordingManifest,
) {
  await Promise.all(
    TRACK_KINDS.flatMap((track) => {
      const acknowledged = new Set(
        manifest.tracks[track].acknowledgedSequences,
      );
      const paths = [];
      for (let sequence = 0; acknowledged.has(sequence); sequence += 1) {
        const chunk = getChunkPaths(root, manifest.sessionId, track, sequence);
        paths.push(chunk.bytes, chunk.metadata);
      }
      return paths.map((path) => rm(path, { force: true }));
    }),
  );
}
