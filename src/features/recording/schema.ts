import { z } from "zod";
import { identifierSchema } from "../workspace/schema";

export const trackKindSchema = z.enum([
  "board",
  "speaker",
  "canvas",
  "microphone",
  "desktop-audio",
]);

export const TRACK_KINDS = trackKindSchema.options;

export const recordingStateSchema = z.enum([
  "recording",
  "complete",
  "interrupted",
]);

export const trackHealthSchema = z.enum(["healthy", "complete", "interrupted"]);

export const chunkMetadataSchema = z
  .object({
    offsetMs: z.number().finite().nonnegative(),
    durationMs: z.number().finite().nonnegative(),
    mimeType: z.string().trim().min(1).max(200),
  })
  .strict();

const interruptionSchema = z
  .object({
    message: z.string().trim().min(1).max(500),
    at: z.iso.datetime(),
  })
  .strict();

export const recordingTrackSchema = z
  .object({
    kind: trackKindSchema,
    health: trackHealthSchema,
    mimeType: z.string().min(1).max(200).nullable(),
    durationMs: z.number().finite().nonnegative(),
    byteSize: z.number().int().nonnegative(),
    path: z.string().regex(/^tracks\/[a-z-]+\.webm$/),
    acknowledgedSequences: z.array(z.number().int().nonnegative()),
    missingSequences: z.array(z.number().int().nonnegative()),
    interruption: interruptionSchema.nullable(),
  })
  .strict();

const recordingTracksSchema = z
  .object({
    board: recordingTrackSchema,
    speaker: recordingTrackSchema,
    canvas: recordingTrackSchema,
    microphone: recordingTrackSchema,
    "desktop-audio": recordingTrackSchema,
  })
  .strict();

export const recordingManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: identifierSchema,
    state: recordingStateSchema,
    startedAt: z.iso.datetime(),
    finalizedAt: z.iso.datetime().nullable(),
    durationMs: z.number().finite().nonnegative(),
    tracks: recordingTracksSchema,
    transcriptPath: z.literal("transcript.json"),
    canvasEventsPath: z.literal("canvas-events.json"),
  })
  .strict();

export const recordingSummarySchema = z
  .object({
    sessionId: identifierSchema,
    state: recordingStateSchema,
    startedAt: z.iso.datetime(),
    finalizedAt: z.iso.datetime().nullable(),
    durationMs: z.number().finite().nonnegative(),
    availableTracks: z.array(trackKindSchema),
  })
  .strict();

const transcriptTimelineEventSchema = z
  .object({
    type: z.literal("transcript"),
    speaker: z.enum(["user", "assistant"]),
    startMs: z.number().finite().nonnegative(),
    endMs: z.number().finite().nonnegative(),
    text: z.string().trim().min(1).max(20_000),
  })
  .strict()
  .refine((event) => event.endMs >= event.startMs, {
    message: "Transcript end must not precede its start",
  });

const canvasTimelineEventSchema = z
  .object({
    type: z.literal("canvas"),
    offsetMs: z.number().finite().nonnegative(),
    revision: z.record(z.string(), z.unknown()),
  })
  .strict();

export const recordingTimelineEventSchema = z.union([
  transcriptTimelineEventSchema,
  canvasTimelineEventSchema,
]);

export type TrackKind = z.infer<typeof trackKindSchema>;
export type TrackHealth = z.infer<typeof trackHealthSchema>;
export type ChunkMetadata = z.infer<typeof chunkMetadataSchema>;
export type RecordingManifest = z.infer<typeof recordingManifestSchema>;
export type RecordingSummary = z.infer<typeof recordingSummarySchema>;
export type RecordingTimelineEvent = z.infer<
  typeof recordingTimelineEventSchema
>;
