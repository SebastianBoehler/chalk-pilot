import { z } from "zod";

export class RecordingHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function recordingResponse(
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    const mapped = mapRecordingError(error);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}

function mapRecordingError(error: unknown): RecordingHttpError {
  if (error instanceof RecordingHttpError) return error;
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return new RecordingHttpError(400, "The request was invalid.");
  }
  if (isMissingFile(error) || hasMessage(error, "Unknown recording:")) {
    return new RecordingHttpError(404, "Recording not found.");
  }
  if (
    hasMessage(error, "Recording is already finalized") ||
    hasMessage(error, "Recording already finalized") ||
    hasMessage(error, "Conflicting chunk sequence") ||
    hasMessage(error, "MIME type changed") ||
    (error instanceof Error && /^Track .+ is interrupted$/.test(error.message))
  ) {
    return new RecordingHttpError(409, "The recording cannot be changed.");
  }
  if (
    hasMessage(error, "Invalid chunk sequence") ||
    hasMessage(error, "Recording chunks cannot be empty") ||
    hasMessage(error, "Invalid recording duration")
  ) {
    return new RecordingHttpError(400, "The request was invalid.");
  }
  return new RecordingHttpError(500, "The recording operation failed.");
}

function hasMessage(error: unknown, prefix: string): boolean {
  return error instanceof Error && error.message.startsWith(prefix);
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
