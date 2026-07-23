import { readdir } from "node:fs/promises";
import { containedPath, getRecordingPaths } from "../workspace/paths";
import { identifierSchema } from "../workspace/schema";
import {
  TRACK_KINDS,
  recordingManifestSchema,
  recordingSummarySchema,
  type RecordingManifest,
  type RecordingSummary,
} from "./schema";
import { findMissing } from "./repository-chunks";
import { isMissingFile, readJson } from "./repository-files";

export function finalizeManifest(
  manifest: RecordingManifest,
  durationMs: number,
  finalizedAt: string,
): RecordingManifest {
  const tracks = Object.fromEntries(
    TRACK_KINDS.map((kind) => {
      const track = manifest.tracks[kind];
      const missingSequences = findMissing(track.acknowledgedSequences);
      const interrupted =
        track.health === "interrupted" ||
        track.acknowledgedSequences.length === 0 ||
        missingSequences.length > 0;
      return [
        kind,
        {
          ...track,
          health: interrupted ? "interrupted" : "complete",
          missingSequences,
          interruption:
            track.interruption ??
            (track.acknowledgedSequences.length === 0
              ? {
                  message: "No chunks acknowledged",
                  at: finalizedAt,
                }
              : missingSequences.length
                ? {
                    message: `Missing chunk sequence(s): ${missingSequences.join(", ")}`,
                    at: finalizedAt,
                  }
                : null),
        },
      ];
    }),
  );
  const state = Object.values(tracks).some(
    (track) => track.health === "interrupted",
  )
    ? "interrupted"
    : "complete";
  return recordingManifestSchema.parse({
    ...manifest,
    state,
    durationMs,
    finalizedAt,
    tracks,
  });
}

export async function listRecordingSummaries(
  root: string,
): Promise<RecordingSummary[]> {
  const sessionsDirectory = containedPath(root, "sessions");
  let entries;
  try {
    entries = await readdir(sessionsDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
  const summaries: RecordingSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !identifierSchema.safeParse(entry.name).success)
      continue;
    try {
      const manifest = recordingManifestSchema.parse(
        await readJson(getRecordingPaths(root, entry.name).manifest),
      );
      summaries.push(
        recordingSummarySchema.parse({
          sessionId: manifest.sessionId,
          state: manifest.state,
          startedAt: manifest.startedAt,
          finalizedAt: manifest.finalizedAt,
          durationMs: manifest.durationMs,
          availableTracks: TRACK_KINDS.filter(
            (kind) => manifest.tracks[kind].byteSize > 0,
          ),
        }),
      );
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
  }
  return summaries.sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt),
  );
}
