import type { RecordingClientPort, UploadChunkInput } from "./recording-client";
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
  appendRecordingTimeline,
  recordingEpoch,
} from "./recording-coordinator-access";
import {
  coordinatorDependencies,
  type CoordinatorDependencies,
} from "./recording-coordinator-dependencies";
import {
  RecordingCoordinatorState,
  type RecordingCoordinatorStatus,
} from "./recording-coordinator-state";
import { finalizeActiveCapture } from "./recording-finalization";
import { settleInterruptedTrack } from "./recording-interruption";
import {
  DISPLAY_CAPTURE_OPTIONS,
  TrackUnavailableError,
  elapsed,
  isDisplayCancellation,
  selectRequiredTracks,
  toError,
  type CaptureSources,
  type MediaRecorderPort,
} from "./recording-media";
import { startRecorder, stopRecorder } from "./recording-recorder-lifecycle";
import type {
  RecordingManifest,
  RecordingTimelineEvent,
  TrackKind,
} from "./schema";

export type { RecordingClientPort, UploadChunkInput };
export type { MediaRecorderPort };
export type { RecordingCoordinatorStatus };

const CHUNK_INTERVAL_MS = 2_000;

export class RecordingCoordinator {
  replayUrl: string | null = null;
  private readonly dependencies: CoordinatorDependencies;
  private readonly state = new RecordingCoordinatorState();
  private active: ActiveCapture | null = null;

  constructor(dependencies: Partial<CoordinatorDependencies> = {}) {
    this.dependencies = coordinatorDependencies(dependencies);
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

  get recordingEpochMs() {
    return recordingEpoch(this.active);
  }

  subscribe(listener: () => void) {
    return this.state.subscribe(listener);
  }

  appendTimeline(event: RecordingTimelineEvent) {
    return appendRecordingTimeline(
      this.active,
      this.dependencies.client,
      event,
    );
  }

  async start(sources: CaptureSources): Promise<RecordingManifest> {
    if (this.active) throw new Error("A session recording is already active.");
    this.state.change("starting", null);
    this.replayUrl = null;
    let active: ActiveCapture | null = null;
    let display: MediaStream | null = null;
    let displayCancelled = false;
    try {
      try {
        display = await this.dependencies.getDisplayMedia(
          DISPLAY_CAPTURE_OPTIONS,
        );
      } catch (cause) {
        displayCancelled = isDisplayCancellation(cause);
        throw cause;
      }
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
            false,
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
      active.tracks.forEach(({ recorder, recorderLifecycle }) =>
        startRecorder(recorder!, recorderLifecycle!, CHUNK_INTERVAL_MS),
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
          active.tracks.map(({ recorder, recorderLifecycle }) =>
            recorder && recorderLifecycle
              ? stopRecorder(recorder, recorderLifecycle)
              : Promise.resolve(),
          ),
        );
        cleanupCapture(active);
      } else if (display) {
        stopDisplayTracks(display);
      }
      this.active = null;
      this.state.change(
        displayCancelled ? "idle" : "error",
        displayCancelled ? null : error,
      );
      throw error;
    }
  }

  async stop(beforeFinalize?: () => Promise<void>): Promise<RecordingManifest> {
    const active = this.active;
    if (!active || active.epoch === null) {
      throw new Error("No session recording is active.");
    }
    const stoppedAt = this.dependencies.now();
    this.state.change("stopping", this.state.error);
    try {
      const manifest = await finalizeActiveCapture({
        active,
        stoppedAt,
        dependencies: this.dependencies,
        beforeFinalize,
        interruptTrack: (capture, kind, message) =>
          this.interruptTrack(capture, kind, message),
        persistMarkedInterruptions: (capture) =>
          this.persistMarkedInterruptions(capture),
      });
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
    waitForExisting = true,
  ) {
    const track = active.tracks.find((candidate) => candidate.kind === kind)!;
    if (track.interrupting) {
      if (waitForExisting) await track.interrupting;
      return;
    }
    if (!track.interrupted && !track.interrupting) {
      track.message = message;
      this.state.change("error", new Error(message));
      track.interrupting = settleInterruptedTrack(active, track).then(() =>
        this.persistInterruption(active, track),
      );
    }
    await track.interrupting;
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
      active.tracks.map(
        ({ interrupting }) => interrupting ?? Promise.resolve(),
      ),
    );
    await Promise.all(
      active.tracks
        .filter(({ interrupted }) => interrupted)
        .map((track) => this.persistInterruption(active, track)),
    );
  }
}
