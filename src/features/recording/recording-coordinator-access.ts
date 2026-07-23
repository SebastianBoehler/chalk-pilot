import type { RecordingClientPort } from "./recording-client";
import type { ActiveCapture } from "./recording-capture-state";
import type { RecordingTimelineEvent } from "./schema";

export function recordingEpoch(active: ActiveCapture | null) {
  return active?.epoch ?? null;
}

export function appendRecordingTimeline(
  active: ActiveCapture | null,
  client: RecordingClientPort,
  event: RecordingTimelineEvent,
) {
  if (!active?.recordingCreated) {
    throw new Error("No session recording is active.");
  }
  return client.appendTimeline(active.sessionId, event);
}
