import {
  RecordingClient,
  type RecordingClientPort,
  type UploadChunkInput,
} from "./recording-client";
import {
  DISPLAY_CAPTURE_OPTIONS,
  elapsed,
  selectRequiredTracks,
  stopRecorder,
  supportedMimeType,
  toError,
  type CaptureSources,
  type DisplayCaptureOptions,
  type MediaRecorderPort,
} from "./recording-media";
import type { RecordingManifest, TrackKind } from "./schema";

export type { RecordingClientPort, UploadChunkInput };
export type { MediaRecorderPort };

export type RecordingCoordinatorStatus =
  "idle" | "starting" | "recording" | "stopping" | "complete" | "error";

interface CoordinatorDependencies {
  client: RecordingClientPort;
  getDisplayMedia(options: DisplayCaptureOptions): Promise<MediaStream>;
  createMediaStream(tracks: MediaStreamTrack[]): MediaStream;
  createRecorder(stream: MediaStream, mimeType: string): MediaRecorderPort;
  now(): number;
  maxPendingUploads: number;
}

interface ActiveTrack {
  kind: TrackKind;
  recorder: MediaRecorderPort;
  mimeType: string;
  sequence: number;
  offsetMs: number;
}

interface ActiveCapture {
  sessionId: string;
  epoch: number;
  display: MediaStream;
  tracks: ActiveTrack[];
  sourceListeners: Array<{
    track: MediaStreamTrack;
    listener: () => void;
  }>;
  pending: Set<Promise<void>>;
  failure: Error | null;
  displayCleaned: boolean;
}

const CHUNK_INTERVAL_MS = 2_000;
const DEFAULT_MAX_PENDING_UPLOADS = 10;

export class RecordingCoordinator {
  status: RecordingCoordinatorStatus = "idle";
  replayUrl: string | null = null;
  private readonly dependencies: CoordinatorDependencies;
  private active: ActiveCapture | null = null;

  constructor(dependencies: Partial<CoordinatorDependencies> = {}) {
    this.dependencies = {
      client: dependencies.client ?? new RecordingClient(),
      getDisplayMedia:
        dependencies.getDisplayMedia ??
        ((options) => navigator.mediaDevices.getDisplayMedia(options)),
      createMediaStream:
        dependencies.createMediaStream ?? ((tracks) => new MediaStream(tracks)),
      createRecorder:
        dependencies.createRecorder ??
        ((stream, mimeType) =>
          new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined,
          ) as unknown as MediaRecorderPort),
      now: dependencies.now ?? (() => performance.now()),
      maxPendingUploads:
        dependencies.maxPendingUploads ?? DEFAULT_MAX_PENDING_UPLOADS,
    };
    if (
      !Number.isInteger(this.dependencies.maxPendingUploads) ||
      this.dependencies.maxPendingUploads < 1
    ) {
      throw new Error("The pending upload limit must be a positive integer.");
    }
  }

  get pendingUploadCount() {
    return this.active?.pending.size ?? 0;
  }

  async start(sources: CaptureSources): Promise<RecordingManifest> {
    if (
      this.active ||
      ["starting", "recording", "stopping"].includes(this.status)
    ) {
      throw new Error("A session recording is already active.");
    }
    this.status = "starting";
    this.replayUrl = null;
    let display: MediaStream | null = null;
    try {
      display = await this.dependencies.getDisplayMedia(
        DISPLAY_CAPTURE_OPTIONS,
      );
      const selected = selectRequiredTracks(sources, display);
      const streams: Array<[TrackKind, MediaStream]> = [
        ["board", sources.board],
        ["speaker", sources.speaker],
        [
          "canvas",
          this.dependencies.createMediaStream([selected.displayVideo]),
        ],
        ["microphone", sources.microphone],
        [
          "desktop-audio",
          this.dependencies.createMediaStream([selected.displayAudio]),
        ],
      ];
      const manifest = await this.dependencies.client.createRecording(
        sources.sessionId,
      );
      const epoch = this.dependencies.now();
      const active: ActiveCapture = {
        sessionId: sources.sessionId,
        epoch,
        display,
        tracks: streams.map(([kind, stream]) => {
          const mimeType = supportedMimeType(kind);
          return {
            kind,
            mimeType,
            offsetMs: 0,
            recorder: this.dependencies.createRecorder(stream, mimeType),
            sequence: 0,
          };
        }),
        sourceListeners: [],
        pending: new Set(),
        failure: null,
        displayCleaned: false,
      };
      this.active = active;
      this.bind(active, selected.all);
      active.tracks.forEach((track) => {
        track.recorder.ondataavailable = ({ data }) =>
          this.upload(active, track, data);
        track.recorder.onerror = ({ error }) =>
          this.fail(
            active,
            error ?? new Error(`${track.kind} recording failed.`),
          );
      });
      active.tracks.forEach(({ recorder }) =>
        recorder.start(CHUNK_INTERVAL_MS),
      );
      this.status = "recording";
      this.replayUrl = this.dependencies.client.replayUrl(sources.sessionId);
      return manifest;
    } catch (cause) {
      const error = toError(cause);
      if (this.active) this.fail(this.active, error);
      else display?.getTracks().forEach((track) => track.stop());
      this.active = null;
      this.status = "error";
      throw error;
    }
  }

  async stop(): Promise<RecordingManifest> {
    const active = this.active;
    if (!active) throw new Error("No session recording is active.");
    if (!active.failure) this.status = "stopping";
    const stops = await Promise.allSettled(
      active.tracks.map(({ recorder }) => stopRecorder(recorder)),
    );
    while (active.pending.size > 0) {
      await Promise.allSettled([...active.pending]);
    }
    this.cleanup(active);
    this.active = null;
    const rejectedStop = stops.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (rejectedStop) {
      this.status = "error";
      throw toError(rejectedStop.reason);
    }
    if (active.failure) {
      this.status = "error";
      throw active.failure;
    }
    const durationMs = elapsed(this.dependencies.now(), active.epoch);
    try {
      const manifest = await this.dependencies.client.finalizeRecording(
        active.sessionId,
        durationMs,
      );
      this.status = "complete";
      return manifest;
    } catch (cause) {
      this.status = "error";
      throw toError(cause);
    }
  }

  private bind(active: ActiveCapture, tracks: MediaStreamTrack[]) {
    tracks.forEach((track, index) => {
      const kind = active.tracks[index]?.kind ?? "recording";
      const listener = () =>
        this.fail(active, new Error(`The ${kind} track was interrupted.`));
      track.addEventListener("ended", listener, { once: true });
      active.sourceListeners.push({ track, listener });
    });
  }

  private upload(active: ActiveCapture, track: ActiveTrack, data: Blob) {
    if (data.size === 0 || active.failure || this.active !== active) return;
    if (active.pending.size >= this.dependencies.maxPendingUploads) {
      this.fail(
        active,
        new Error(`The ${track.kind} upload queue could not keep up.`),
      );
      return;
    }
    const observedAt = elapsed(this.dependencies.now(), active.epoch);
    const input: UploadChunkInput = {
      sessionId: active.sessionId,
      track: track.kind,
      sequence: track.sequence,
      offsetMs: track.offsetMs,
      durationMs: Math.max(0, observedAt - track.offsetMs),
      mimeType: data.type || track.mimeType,
      data,
    };
    track.sequence += 1;
    track.offsetMs = observedAt;
    const pending = this.dependencies.client
      .uploadChunk(input)
      .catch((cause) => this.fail(active, toError(cause)))
      .finally(() => active.pending.delete(pending));
    active.pending.add(pending);
  }

  private fail(active: ActiveCapture, error: Error) {
    if (active.failure) return;
    active.failure = error;
    this.status = "error";
    active.tracks.forEach(({ recorder }) => {
      if (recorder.state !== "inactive") recorder.stop();
    });
    this.cleanup(active);
  }

  private cleanup(active: ActiveCapture) {
    active.sourceListeners.forEach(({ track, listener }) =>
      track.removeEventListener("ended", listener),
    );
    active.sourceListeners = [];
    if (active.displayCleaned) return;
    active.displayCleaned = true;
    active.display.getTracks().forEach((track) => track.stop());
  }
}
