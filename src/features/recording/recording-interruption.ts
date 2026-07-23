import type { ActiveCapture, ActiveTrack } from "./recording-capture-state";
import { stopRecorder } from "./recording-media";

export async function settleInterruptedTrack(
  active: ActiveCapture,
  track: ActiveTrack,
) {
  const recorder = track.recorder;
  if (recorder && recorder.state !== "inactive") {
    try {
      await stopRecorder(recorder);
    } catch {
      // The track is still marked interrupted after a failed stop.
    }
  }
  await active.uploads.drainTrack(track.kind);
  track.interrupted = true;
}
