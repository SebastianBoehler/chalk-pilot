import { vi } from "vitest";
import type { RecordingManifest, TrackKind } from "./schema";
import type {
  MediaRecorderPort,
  RecordingClientPort,
  UploadChunkInput,
} from "./recording-coordinator";

export class FakeTrack {
  readonly stop = vi.fn(() => {
    this.readyState = "ended";
  });
  readyState: MediaStreamTrackState;
  private readonly ended = new Set<() => void>();

  constructor(
    readonly kind: "audio" | "video",
    live = true,
  ) {
    this.readyState = live ? "live" : "ended";
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === "ended") this.ended.add(listener as () => void);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    if (type === "ended") this.ended.delete(listener as () => void);
  }

  end() {
    this.readyState = "ended";
    this.ended.forEach((listener) => listener());
  }
}

export function stream(...tracks: FakeTrack[]) {
  return {
    getTracks: () => tracks as unknown as MediaStreamTrack[],
    getAudioTracks: () =>
      tracks.filter(
        ({ kind }) => kind === "audio",
      ) as unknown as MediaStreamTrack[],
    getVideoTracks: () =>
      tracks.filter(
        ({ kind }) => kind === "video",
      ) as unknown as MediaStreamTrack[],
  } as MediaStream;
}

export class FakeRecorder implements MediaRecorderPort {
  state: RecordingState = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: ((event: { error?: DOMException }) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly start = vi.fn((timeslice?: number) => {
    this.state = "recording";
    return timeslice;
  });
  readonly stop = vi.fn(() => {
    this.state = "inactive";
    this.onstop?.();
  });

  constructor(readonly source: MediaStream) {}

  emit(label: string, type = "video/webm") {
    this.ondataavailable?.({ data: new Blob([label], { type }) });
  }
}

export class FakeRecordingClient implements RecordingClientPort {
  readonly createRecording = vi.fn(async (sessionId: string) =>
    manifest(sessionId),
  );
  readonly uploadChunk = vi.fn(
    async (input: UploadChunkInput): Promise<void> => {
      void input;
    },
  );
  readonly finalizeRecording = vi.fn(
    async (sessionId: string, durationMs: number) =>
      manifest(sessionId, "complete", durationMs),
  );
  readonly replayUrl = vi.fn(
    (sessionId: string) => `/replay/${encodeURIComponent(sessionId)}`,
  );
}

export function manifest(
  sessionId = "session-1",
  state: RecordingManifest["state"] = "recording",
  durationMs = 0,
): RecordingManifest {
  const tracks = Object.fromEntries(
    (
      [
        "board",
        "speaker",
        "canvas",
        "microphone",
        "desktop-audio",
      ] satisfies TrackKind[]
    ).map((kind) => [
      kind,
      {
        kind,
        health: state === "complete" ? "complete" : "healthy",
        mimeType: null,
        durationMs,
        byteSize: 0,
        path: `tracks/${kind}.webm`,
        acknowledgedSequences: [],
        missingSequences: [],
        interruption: null,
      },
    ]),
  ) as unknown as RecordingManifest["tracks"];
  return {
    schemaVersion: 1,
    sessionId,
    state,
    startedAt: "2026-07-23T10:00:00.000Z",
    finalizedAt: state === "recording" ? null : "2026-07-23T10:00:02.000Z",
    durationMs,
    tracks,
    transcriptPath: "transcript.json",
    canvasEventsPath: "canvas-events.json",
  };
}

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
