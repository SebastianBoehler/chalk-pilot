import { z } from "zod";
import { chunkMetadataSchema, trackKindSchema } from "./schema";
import { RecordingHttpError } from "./api-errors";

export const MAX_CHUNK_BYTES = 16 * 1024 * 1024;

const sequenceSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().nonnegative().safe());

const numericHeaderSchema = z
  .string()
  .trim()
  .min(1)
  .transform(Number)
  .pipe(z.number().finite().nonnegative());

const videoTracks = new Set(["board", "speaker", "canvas"]);

export function parseChunkInput(
  rawTrack: string,
  rawSequence: string,
  headers: Headers,
) {
  const track = trackKindSchema.parse(rawTrack);
  const sequence = sequenceSchema.parse(rawSequence);
  const mimeType = headers.get("content-type")?.trim() ?? "";
  const baseMimeType = mimeType.split(";", 1)[0]?.trim().toLowerCase();
  const expectedMimeType = videoTracks.has(track) ? "video/webm" : "audio/webm";
  if (baseMimeType !== expectedMimeType || mimeType.length > 200) {
    throw new RecordingHttpError(400, "The request was invalid.");
  }
  const metadata = chunkMetadataSchema.parse({
    offsetMs: numericHeaderSchema.parse(headers.get("x-chalkpilot-offset-ms")),
    durationMs: numericHeaderSchema.parse(
      headers.get("x-chalkpilot-duration-ms"),
    ),
    mimeType,
  });
  return { track, sequence, metadata };
}

export async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new RecordingHttpError(400, "The request was invalid.");
    }
    if (BigInt(declaredLength) > BigInt(MAX_CHUNK_BYTES)) {
      throw new RecordingHttpError(413, "The recording chunk is too large.");
    }
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_CHUNK_BYTES) {
      await reader.cancel();
      throw new RecordingHttpError(413, "The recording chunk is too large.");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
