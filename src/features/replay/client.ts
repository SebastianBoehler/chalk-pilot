import {
  recordingManifestSchema,
  recordingSummarySchema,
  replayTimelineSchema,
  type RecordingManifest,
  type RecordingSummary,
  type ReplayTimeline,
  type TrackKind,
} from "@/features/recording/schema";

export interface ReplayClientPort {
  list(): Promise<RecordingSummary[]>;
  manifest(sessionId: string): Promise<RecordingManifest>;
  timeline(sessionId: string): Promise<ReplayTimeline>;
  trackUrl(sessionId: string, track: TrackKind): string;
  exportUrl(sessionId: string): string;
}

export class ReplayClient implements ReplayClientPort {
  constructor(
    private readonly fetcher: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
  ) {}

  async list() {
    const value = await responseJson(await this.fetcher("/api/recordings"));
    return parseOrThrow(
      recordingSummarySchema.array(),
      value,
      "recording list",
    );
  }

  async manifest(sessionId: string) {
    const value = await responseJson(
      await this.fetcher(recordingUrl(sessionId)),
    );
    return parseOrThrow(recordingManifestSchema, value, "recording manifest");
  }

  async timeline(sessionId: string) {
    const value = await responseJson(
      await this.fetcher(`${recordingUrl(sessionId)}/timeline`),
    );
    return parseOrThrow(replayTimelineSchema, value, "replay timeline");
  }

  trackUrl(sessionId: string, track: TrackKind) {
    return `${recordingUrl(sessionId)}/tracks/${track}`;
  }

  exportUrl(sessionId: string) {
    return `${recordingUrl(sessionId)}/export`;
  }
}

function recordingUrl(sessionId: string) {
  return `/api/sessions/${encodeURIComponent(sessionId)}/recording`;
}

async function responseJson(response: Response) {
  const value = await response.json().catch(() => null);
  if (response.ok) return value;
  const message =
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
      ? value.error
      : `Replay request failed (${response.status}).`;
  throw new Error(message);
}

function parseOrThrow<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  value: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(`The server returned an invalid ${label}.`);
  return parsed.data;
}
