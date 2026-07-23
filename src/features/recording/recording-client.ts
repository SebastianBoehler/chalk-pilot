import {
  recordingManifestSchema,
  type RecordingManifest,
  type RecordingTimelineEvent,
  type TrackKind,
} from "./schema";

export interface UploadChunkInput {
  sessionId: string;
  track: TrackKind;
  sequence: number;
  offsetMs: number;
  durationMs: number;
  mimeType: string;
  data: Blob;
}

export interface RecordingClientPort {
  createRecording(sessionId: string): Promise<RecordingManifest>;
  uploadChunk(input: UploadChunkInput): Promise<void>;
  interrupt(
    sessionId: string,
    track: TrackKind,
    message: string,
  ): Promise<RecordingManifest>;
  finalizeRecording(
    sessionId: string,
    durationMs: number,
  ): Promise<RecordingManifest>;
  appendTimeline(
    sessionId: string,
    event: RecordingTimelineEvent,
  ): Promise<void>;
  replayUrl(sessionId: string): string;
}

export class RecordingClient implements RecordingClientPort {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async createRecording(sessionId: string) {
    return this.manifest(
      await this.fetcher(recordingUrl(sessionId), { method: "POST" }),
    );
  }

  async uploadChunk(input: UploadChunkInput) {
    const response = await this.fetcher(
      `${recordingUrl(input.sessionId)}/tracks/${input.track}/chunks/${input.sequence}`,
      {
        method: "PUT",
        body: input.data,
        headers: {
          "content-type": input.mimeType,
          "x-chalkpilot-duration-ms": String(input.durationMs),
          "x-chalkpilot-offset-ms": String(input.offsetMs),
        },
      },
    );
    await requireOk(response);
  }

  async finalizeRecording(sessionId: string, durationMs: number) {
    return this.manifest(
      await this.fetcher(`${recordingUrl(sessionId)}/finalize`, {
        method: "POST",
        body: JSON.stringify({ durationMs }),
        headers: { "content-type": "application/json" },
      }),
    );
  }

  async appendTimeline(sessionId: string, event: RecordingTimelineEvent) {
    await requireOk(
      await this.fetcher(`${recordingUrl(sessionId)}/timeline`, {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "content-type": "application/json" },
      }),
    );
  }

  async interrupt(sessionId: string, track: TrackKind, message: string) {
    return this.manifest(
      await this.fetcher(
        `${recordingUrl(sessionId)}/tracks/${track}/interrupt`,
        {
          method: "POST",
          body: JSON.stringify({ message }),
          headers: { "content-type": "application/json" },
        },
      ),
    );
  }

  replayUrl(sessionId: string) {
    return `/replay/${encodeURIComponent(sessionId)}`;
  }

  private async manifest(response: Response) {
    await requireOk(response);
    const parsed = recordingManifestSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("The server returned an invalid recording manifest.");
    }
    return parsed.data;
  }
}

function recordingUrl(sessionId: string) {
  return `/api/sessions/${encodeURIComponent(sessionId)}/recording`;
}

async function requireOk(response: Response) {
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  const message =
    typeof body?.error === "string"
      ? body.error
      : `Recording request failed (${response.status}).`;
  throw new Error(message);
}
