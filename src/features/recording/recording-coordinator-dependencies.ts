import { RecordingClient, type RecordingClientPort } from "./recording-client";
import type {
  DisplayCaptureOptions,
  MediaRecorderPort,
} from "./recording-media";

export interface CoordinatorDependencies {
  client: RecordingClientPort;
  getDisplayMedia(options: DisplayCaptureOptions): Promise<MediaStream>;
  createMediaStream(tracks: MediaStreamTrack[]): MediaStream;
  createRecorder(stream: MediaStream, mimeType: string): MediaRecorderPort;
  now(): number;
  maxPendingUploads: number;
}

export function coordinatorDependencies(
  dependencies: Partial<CoordinatorDependencies>,
): CoordinatorDependencies {
  return {
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
    maxPendingUploads: dependencies.maxPendingUploads ?? 10,
  };
}
