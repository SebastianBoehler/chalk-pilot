import type { ActiveCapture } from "./recording-capture-state";
import type { CoordinatorDependencies } from "./recording-coordinator-dependencies";
import { elapsed, toError } from "./recording-media";
import { stopRecorder } from "./recording-recorder-lifecycle";
import type { RecordingManifest, TrackKind } from "./schema";

interface FinalizationOptions {
  active: ActiveCapture;
  stoppedAt: number;
  dependencies: CoordinatorDependencies;
  beforeFinalize?: () => Promise<void>;
  interruptTrack(
    active: ActiveCapture,
    kind: TrackKind,
    message: string,
  ): Promise<void>;
  persistMarkedInterruptions(active: ActiveCapture): Promise<void>;
}

export async function finalizeActiveCapture({
  active,
  stoppedAt,
  dependencies,
  beforeFinalize,
  interruptTrack,
  persistMarkedInterruptions,
}: FinalizationOptions): Promise<RecordingManifest> {
  const stops = await Promise.allSettled(
    active.tracks.map(({ recorder, recorderLifecycle }) =>
      stopRecorder(recorder!, recorderLifecycle!),
    ),
  );
  await Promise.all(
    stops.map((result, index) =>
      result.status === "rejected"
        ? interruptTrack(
            active,
            active.tracks[index]!.kind,
            toError(result.reason).message,
          )
        : Promise.resolve(),
    ),
  );
  await active.uploads.drain();
  await persistMarkedInterruptions(active);
  if (active.controlFailure) throw active.controlFailure;
  await beforeFinalize?.();
  return dependencies.client.finalizeRecording(
    active.sessionId,
    elapsed(stoppedAt, active.epoch!),
  );
}
