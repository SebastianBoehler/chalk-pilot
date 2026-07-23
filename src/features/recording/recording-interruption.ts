import type { ActiveCapture, ActiveTrack } from "./recording-capture-state";
import { stopRecorder } from "./recording-recorder-lifecycle";

export async function settleInterruptedTrack(
  active: ActiveCapture,
  track: ActiveTrack,
) {
  const recorder = track.recorder;
  if (recorder && track.recorderLifecycle) {
    try {
      await stopRecorder(recorder, track.recorderLifecycle);
    } catch {
      // The track is still marked interrupted after a failed stop.
    }
  }
  await active.uploads.drainTrack(track.kind);
  track.interrupted = true;
}
