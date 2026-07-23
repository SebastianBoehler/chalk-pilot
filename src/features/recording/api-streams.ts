import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getRecordingPaths } from "../workspace/paths";
import type { RecordingManifest, TrackKind } from "./schema";
import { RecordingHttpError } from "./api-errors";

export async function trackResponse(
  root: string,
  manifest: RecordingManifest,
  track: TrackKind,
  rangeHeader: string | null,
): Promise<Response> {
  assertFinalized(manifest);
  const metadata = manifest.tracks[track];
  if (metadata.byteSize === 0) {
    throw new RecordingHttpError(404, "Recording track not found.");
  }
  const path = join(
    getRecordingPaths(root, manifest.sessionId).tracksDirectory,
    `${track}.webm`,
  );
  const size = (await stat(path)).size;
  const headers = new Headers({
    "accept-ranges": "bytes",
    "content-type": metadata.mimeType ?? defaultMimeType(track),
  });
  const range = parseRange(rangeHeader, size);
  if (range === "invalid") {
    headers.set("content-range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  headers.set("content-length", String(end - start + 1));
  if (range) headers.set("content-range", `bytes ${start}-${end}/${size}`);
  return new Response(webStream(createReadStream(path, { start, end })), {
    status: range ? 206 : 200,
    headers,
  });
}

export async function exportResponse(
  root: string,
  manifest: RecordingManifest,
): Promise<Response> {
  assertFinalized(manifest);
  const paths = getRecordingPaths(root, manifest.sessionId);
  const entries: Array<{ path: string; name: string }> = [
    { path: paths.manifest, name: "manifest.json" },
  ];
  for (const track of Object.values(manifest.tracks)) {
    if (track.byteSize > 0) {
      entries.push({
        path: join(paths.tracksDirectory, `${track.kind}.webm`),
        name: track.path,
      });
    }
  }
  entries.push(
    { path: paths.transcript, name: manifest.transcriptPath },
    { path: paths.canvasEvents, name: manifest.canvasEventsPath },
  );
  await Promise.all(entries.map((entry) => stat(entry.path)));

  const archive = new ZipArchive({ zlib: { level: 9 } });
  for (const entry of entries) {
    archive.append(createReadStream(entry.path), { name: entry.name });
  }
  archive.on("warning", (error) => archive.destroy(error));
  void archive.finalize().catch((error: unknown) => {
    archive.destroy(
      error instanceof Error ? error : new Error("ZIP finalization failed"),
    );
  });
  return new Response(webStream(archive), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${manifest.sessionId}.chalkpilot.zip"`,
    },
  });
}

function assertFinalized(manifest: RecordingManifest) {
  if (!manifest.finalizedAt) {
    throw new RecordingHttpError(409, "The recording is not finalized.");
  }
}

function defaultMimeType(track: TrackKind) {
  return track === "microphone" || track === "desktop-audio"
    ? "audio/webm"
    : "video/webm";
}

function webStream(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

function parseRange(
  value: string | null,
  size: number,
): { start: number; end: number } | "invalid" | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return "invalid";
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (suffixLength <= 0) return "invalid";
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (start >= size || end < start) return "invalid";
    end = Math.min(end, size - 1);
  }
  return { start, end };
}
