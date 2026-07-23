import type { UploadChunkInput } from "./recording-client";
import {
  selectRequiredTracks,
  supportedMimeType,
  type CaptureSources,
  type MediaRecorderPort,
} from "./recording-media";
import { RecorderLifecycle } from "./recording-recorder-lifecycle";
import { RecordingUploadQueue } from "./recording-upload-queue";
import type { TrackKind } from "./schema";

export interface ActiveTrack {
  kind: TrackKind;
  stream: MediaStream;
  recorder: MediaRecorderPort | null;
  recorderLifecycle: RecorderLifecycle | null;
  mimeType: string;
  sequence: number;
  offsetMs: number;
  interrupting: Promise<void> | null;
  interrupted: boolean;
  message: string | null;
  interruption: Promise<void> | null;
}

export interface ActiveCapture {
  sessionId: string;
  epoch: number | null;
  display: MediaStream;
  tracks: ActiveTrack[];
  listeners: Array<{ track: MediaStreamTrack; listener: () => void }>;
  uploads: RecordingUploadQueue;
  recordingCreated: boolean;
  controlFailure: Error | null;
  displayCleaned: boolean;
}

interface CaptureStateOptions {
  sources: CaptureSources;
  display: MediaStream;
  selected: ReturnType<typeof selectRequiredTracks>;
  createMediaStream(tracks: MediaStreamTrack[]): MediaStream;
  maxPendingUploads: number;
  upload(input: UploadChunkInput): Promise<void>;
  onUploadFailure(
    active: ActiveCapture,
    input: UploadChunkInput,
    error: unknown,
  ): Promise<void>;
}

export function createActiveCapture(
  options: CaptureStateOptions,
): ActiveCapture {
  const tracks = captureStreams(options).map(([kind, stream]) => ({
    kind,
    stream,
    recorder: null,
    recorderLifecycle: null,
    mimeType: supportedMimeType(kind),
    sequence: 0,
    offsetMs: 0,
    interrupting: null,
    interrupted: false,
    message: null,
    interruption: null,
  }));
  const reference: { active?: ActiveCapture } = {};
  const uploads = new RecordingUploadQueue(
    options.maxPendingUploads,
    options.upload,
    (input, error) => options.onUploadFailure(reference.active!, input, error),
  );
  const active: ActiveCapture = {
    sessionId: options.sources.sessionId,
    epoch: null,
    display: options.display,
    tracks,
    listeners: [],
    uploads,
    recordingCreated: false,
    controlFailure: null,
    displayCleaned: false,
  };
  reference.active = active;
  return active;
}

export function bindCaptureSources(
  active: ActiveCapture,
  entries: Array<[TrackKind, MediaStreamTrack]>,
  onEnded: (kind: TrackKind) => void,
) {
  entries.forEach(([kind, track]) => {
    const listener = () => onEnded(kind);
    track.addEventListener("ended", listener, { once: true });
    active.listeners.push({ track, listener });
  });
}

export function createCaptureRecorders(
  active: ActiveCapture,
  createRecorder: (stream: MediaStream, mimeType: string) => MediaRecorderPort,
  onData: (track: ActiveTrack, data: Blob) => void,
  onError: (track: ActiveTrack, error?: DOMException) => void,
) {
  active.tracks.forEach((track) => {
    track.recorder = createRecorder(track.stream, track.mimeType);
    const lifecycle = new RecorderLifecycle();
    track.recorderLifecycle = lifecycle;
    track.recorder.ondataavailable = ({ data }) => onData(track, data);
    track.recorder.onerror = ({ error }) => onError(track, error);
    track.recorder.onstop = () => lifecycle.observeStop();
  });
}

export function cleanupCapture(active: ActiveCapture) {
  active.listeners.forEach(({ track, listener }) =>
    track.removeEventListener("ended", listener),
  );
  active.listeners = [];
  if (active.displayCleaned) return;
  active.displayCleaned = true;
  stopDisplayTracks(active.display);
}

export function stopDisplayTracks(display: MediaStream) {
  display.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Continue cleaning the remaining display tracks.
    }
  });
}

function captureStreams(
  options: Pick<
    CaptureStateOptions,
    "sources" | "selected" | "createMediaStream"
  >,
): Array<[TrackKind, MediaStream]> {
  return [
    ["board", options.sources.board],
    ["speaker", options.sources.speaker],
    ["canvas", options.createMediaStream([options.selected.displayVideo])],
    ["microphone", options.sources.microphone],
    [
      "desktop-audio",
      options.createMediaStream([options.selected.displayAudio]),
    ],
  ];
}
