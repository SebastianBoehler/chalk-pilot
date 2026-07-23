import {
  RecordingClient,
  type RecordingClientPort,
  type UploadChunkInput,
} from "./recording-client";
import {
  bindCaptureSources,
  cleanupCapture,
  createActiveCapture,
  createCaptureRecorders,
  stopDisplayTracks,
  type ActiveCapture,
  type ActiveTrack,
} from "./recording-capture-state";
import {
  RecordingCoordinatorState,
  type RecordingCoordinatorStatus,
} from "./recording-coordinator-state";
import {
  DISPLAY_CAPTURE_OPTIONS,
  TrackUnavailableError,
  elapsed,
  isDisplayCancellation,
  selectRequiredTracks,
  stopRecorder,
  toError,
  type CaptureSources,
  type DisplayCaptureOptions,
  type MediaRecorderPort,
} from "./recording-media";
import type { RecordingManifest, TrackKind } from "./schema";

export type { RecordingClientPort, UploadChunkInput };
export type { MediaRecorderPort };
export type { RecordingCoordinatorStatus };

interface CoordinatorDependencies {
  client: RecordingClientPort;
  getDisplayMedia(options: DisplayCaptureOptions): Promise<MediaStream>;
  createMediaStream(tracks: MediaStreamTrack[]): MediaStream;
  createRecorder(stream: MediaStream, mimeType: string): MediaRecorderPort;
  now(): number;
  maxPendingUploads: number;
}

const CHUNK_INTERVAL_MS = 2_000;
const DEFAULT_MAX_PENDING_UPLOADS = 10;

export class RecordingCoordinator {
  replayUrl: string | null = null;
  private readonly dependencies: CoordinatorDependencies;
  private readonly state = new RecordingCoordinatorState();
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
  }

  get status() {
    return this.state.status;
  }

  get error() {
    return this.state.error;
  }

  get pendingUploadCount() {
    return this.active?.uploads.pendingInputs.length ?? 0;
  }

  get pendingUploadJobs() {
    return this.active?.uploads.pendingInputs ?? [];
  }

  subscribe(listener: () => void) {
    return this.state.subscribe(listener);
  }

  async start(sources: CaptureSources): Promise<RecordingManifest> {
    if (this.active) throw new Error("A session recording is already active.");
    this.state.change("starting", null);
    this.replayUrl = null;
    let active: ActiveCapture | null = null;
    let display: MediaStream | null = null;
    try {
      display = await this.dependencies.getDisplayMedia(
        DISPLAY_CAPTURE_OPTIONS,
      );
      const selected = selectRequiredTracks(sources, display);
      active = createActiveCapture({
        sources,
        display,
        selected,
        createMediaStream: this.dependencies.createMediaStream,
        maxPendingUploads: this.dependencies.maxPendingUploads,
        upload: (input) => this.dependencies.client.uploadChunk(input),
        onUploadFailure: (capture, input, error) =>
          this.interruptTrack(
            capture,
            input.track,
            `${input.track} upload failed: ${toError(error).message}`,
          ),
      });
      this.active = active;
      bindCaptureSources(active, selected.entries, (kind) => {
        void this.interruptTrack(
          active!,
          kind,
          `The ${kind} track was interrupted.`,
        );
      });
      const manifest = await this.dependencies.client.createRecording(
        sources.sessionId,
      );
      active.recordingCreated = true;
      await this.persistMarkedInterruptions(active);
      selectRequiredTracks(sources, active.display);
      createCaptureRecorders(
        active,
        this.dependencies.createRecorder,
        (track, data) => this.upload(active!, track, data),
        (track, error) =>
          void this.interruptTrack(
            active!,
            track.kind,
            error?.message ?? `${track.kind} recording failed.`,
          ),
      );
      selectRequiredTracks(sources, active.display);
      const interrupted = active.tracks.find(({ interrupted }) => interrupted);
      if (interrupted) {
        await this.persistInterruption(active, interrupted);
        throw new Error(
          interrupted.message ??
            `The ${interrupted.kind} track was interrupted.`,
        );
      }
      active.epoch = this.dependencies.now();
      active.tracks.forEach(({ recorder }) =>
        recorder!.start(CHUNK_INTERVAL_MS),
      );
      this.replayUrl = this.dependencies.client.replayUrl(sources.sessionId);
      this.state.change("recording", null);
      return manifest;
    } catch (cause) {
      const error = toError(cause);
      if (active) {
        if (cause instanceof TrackUnavailableError) {
          await this.interruptTrack(active, cause.track, error.message);
        }
        await this.persistMarkedInterruptions(active);
        await Promise.allSettled(
          active.tracks.map(({ recorder }) =>
            recorder ? stopRecorder(recorder) : Promise.resolve(),
          ),
        );
        cleanupCapture(active);
      } else if (display) {
        stopDisplayTracks(display);
      }
      this.active = null;
      const cancelled = isDisplayCancellation(cause);
      this.state.change(cancelled ? "idle" : "error", cancelled ? null : error);
      throw error;
    }
  }

  async stop(): Promise<RecordingManifest> {
    const active = this.active;
    if (!active || active.epoch === null) {
      throw new Error("No session recording is active.");
    }
    const stoppedAt = this.dependencies.now();
    this.state.change("stopping", this.state.error);
    try {
      const stops = await Promise.allSettled(
        active.tracks.map(({ recorder }) => stopRecorder(recorder!)),
      );
      await Promise.all(
        stops.map((result, index) =>
          result.status === "rejected"
            ? this.interruptTrack(
                active,
                active.tracks[index]!.kind,
                toError(result.reason).message,
              )
            : Promise.resolve(),
        ),
      );
      await active.uploads.drain();
      await this.persistMarkedInterruptions(active);
      if (active.controlFailure) throw active.controlFailure;
      const manifest = await this.dependencies.client.finalizeRecording(
        active.sessionId,
        elapsed(stoppedAt, active.epoch),
      );
      this.state.change("complete", null);
      return manifest;
    } catch (cause) {
      const error = toError(cause);
      this.state.change("error", error);
      throw error;
    } finally {
      cleanupCapture(active);
      this.active = null;
    }
  }

  private upload(active: ActiveCapture, track: ActiveTrack, data: Blob) {
    if (data.size === 0 || track.interrupted || this.active !== active) return;
    const observedAt = elapsed(this.dependencies.now(), active.epoch!);
    const input: UploadChunkInput = {
      sessionId: active.sessionId,
      track: track.kind,
      sequence: track.sequence,
      offsetMs: track.offsetMs,
      durationMs: Math.max(0, observedAt - track.offsetMs),
      mimeType: data.type || track.mimeType,
      data,
    };
    if (!active.uploads.enqueue(input)) {
      void this.interruptTrack(
        active,
        track.kind,
        `The ${track.kind} upload queue could not keep up.`,
      );
      return;
    }
    track.sequence += 1;
    track.offsetMs = observedAt;
  }

  private async interruptTrack(
    active: ActiveCapture,
    kind: TrackKind,
    message: string,
  ) {
    const track = active.tracks.find((candidate) => candidate.kind === kind)!;
    if (!track.interrupted) {
      track.interrupted = true;
      track.message = message;
      this.state.change("error", new Error(message));
      const recorder = track.recorder;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Explicit stop retries this recorder and still persists interruption.
        }
      }
    }
    if (active.recordingCreated) await this.persistInterruption(active, track);
  }

  private persistInterruption(active: ActiveCapture, track: ActiveTrack) {
    if (!active.recordingCreated || !track.interrupted || track.interruption) {
      return track.interruption ?? Promise.resolve();
    }
    track.interruption = this.dependencies.client
      .interrupt(
        active.sessionId,
        track.kind,
        track.message ?? `The ${track.kind} track was interrupted.`,
      )
      .then(() => undefined)
      .catch((cause) => {
        active.controlFailure = toError(cause);
        this.state.change("error", active.controlFailure);
      });
    return track.interruption;
  }

  private async persistMarkedInterruptions(active: ActiveCapture) {
    await Promise.all(
      active.tracks
        .filter(({ interrupted }) => interrupted)
        .map((track) => this.persistInterruption(active, track)),
    );
  }
}
