import { z } from "zod";
import { identifierSchema } from "../workspace/schema";
import type { RecordingRepository } from "./repository";
import { recordingTimelineEventSchema, trackKindSchema } from "./schema";
import {
  parseRecordingRequest,
  parseRecordingRequestAsync,
  RecordingHttpError,
  recordingResponse,
} from "./api-errors";
import { MAX_CHUNK_BYTES, parseChunkInput, readBoundedBody } from "./api-input";
import { exportResponse, trackResponse } from "./api-streams";

export { MAX_CHUNK_BYTES };

interface RecordingApiDependencies {
  repository: RecordingRepository;
  rootDirectory: string;
  sessionExists(sessionId: string): Promise<boolean>;
}

const finalizeSchema = z
  .object({ durationMs: z.number().finite().nonnegative() })
  .strict();

const interruptionSchema = z
  .object({ message: z.string().trim().min(1).max(500) })
  .strict();

export function createRecordingApi(dependencies: RecordingApiDependencies) {
  const { repository, rootDirectory, sessionExists } = dependencies;

  async function listRecordings() {
    return recordingResponse(async () =>
      Response.json(await repository.list()),
    );
  }

  async function createRecording(rawSessionId: string) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      if (!(await sessionExists(sessionId))) {
        throw new RecordingHttpError(404, "Session not found.");
      }
      return Response.json(await repository.create(sessionId), { status: 201 });
    });
  }

  async function readManifest(rawSessionId: string) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      return Response.json(await repository.read(sessionId));
    });
  }

  async function appendChunk(
    rawSessionId: string,
    rawTrack: string,
    rawSequence: string,
    request: Request,
  ) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      const { track, sequence, metadata } = parseRecordingRequest(() =>
        parseChunkInput(rawTrack, rawSequence, request.headers),
      );
      const bytes = await readBoundedBody(request);
      await repository.appendChunk(sessionId, track, sequence, metadata, bytes);
      return new Response(null, { status: 204 });
    });
  }

  async function appendTimeline(rawSessionId: string, request: Request) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      const event = await parseRecordingRequestAsync(async () =>
        recordingTimelineEventSchema.parse(await request.json()),
      );
      await repository.appendTimeline(sessionId, event);
      return Response.json(event, { status: 201 });
    });
  }

  async function interruptRecording(
    rawSessionId: string,
    rawTrack: string,
    request: Request,
  ) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      const track = parseRecordingRequest(() =>
        trackKindSchema.parse(rawTrack),
      );
      const { message } = await parseRecordingRequestAsync(async () =>
        interruptionSchema.parse(await request.json()),
      );
      return Response.json(
        await repository.interrupt(sessionId, track, message),
      );
    });
  }

  async function finalizeRecording(rawSessionId: string, request: Request) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      const { durationMs } = await parseRecordingRequestAsync(async () =>
        finalizeSchema.parse(await request.json()),
      );
      return Response.json(await repository.finalize(sessionId, durationMs));
    });
  }

  async function streamTrack(
    rawSessionId: string,
    rawTrack: string,
    request: Request,
  ) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      const track = parseRecordingRequest(() =>
        trackKindSchema.parse(rawTrack),
      );
      const manifest = await repository.read(sessionId);
      return trackResponse(
        rootDirectory,
        manifest,
        track,
        request.headers.get("range"),
      );
    });
  }

  async function exportRecording(rawSessionId: string) {
    return recordingResponse(async () => {
      const sessionId = parseRecordingRequest(() =>
        identifierSchema.parse(rawSessionId),
      );
      const manifest = await repository.read(sessionId);
      return exportResponse(rootDirectory, manifest);
    });
  }

  return {
    listRecordings,
    createRecording,
    readManifest,
    appendChunk,
    appendTimeline,
    interruptRecording,
    finalizeRecording,
    streamTrack,
    exportRecording,
  };
}

export type RecordingApi = ReturnType<typeof createRecordingApi>;
