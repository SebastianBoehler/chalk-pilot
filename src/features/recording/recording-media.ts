import type { TrackKind } from "./schema";

export class TrackUnavailableError extends Error {
  constructor(
    readonly track: TrackKind,
    label: string,
  ) {
    super(`The ${label} stream is unavailable.`);
  }
}

export interface MediaRecorderPort {
  state: RecordingState;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onerror: ((event: { error?: DOMException }) => void) | null;
  onstop: (() => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

export interface CaptureSources {
  sessionId: string;
  board: MediaStream;
  speaker: MediaStream;
  microphone: MediaStream;
}

export interface DisplayCaptureOptions extends DisplayMediaStreamOptions {
  audio: true;
  selfBrowserSurface: "include";
  systemAudio: "include";
  video: true;
}

export const DISPLAY_CAPTURE_OPTIONS: DisplayCaptureOptions = {
  audio: true,
  selfBrowserSurface: "include",
  systemAudio: "include",
  video: true,
};

export function selectRequiredTracks(
  sources: CaptureSources,
  display: MediaStream,
) {
  const board = requireLive(
    sources.board.getVideoTracks(),
    "board",
    "board video",
  );
  const speaker = requireLive(
    sources.speaker.getVideoTracks(),
    "speaker",
    "speaker video",
  );
  const microphone = requireLive(
    sources.microphone.getAudioTracks(),
    "microphone",
    "microphone audio",
  );
  const displayVideo = requireLive(
    display.getVideoTracks(),
    "canvas",
    "display video",
  );
  const displayAudio = requireLive(
    display.getAudioTracks(),
    "desktop-audio",
    "desktop audio",
  );
  return {
    displayAudio,
    displayVideo,
    entries: [
      ["board", board],
      ["speaker", speaker],
      ["canvas", displayVideo],
      ["microphone", microphone],
      ["desktop-audio", displayAudio],
    ] as Array<[TrackKind, MediaStreamTrack]>,
  };
}

function requireLive(
  tracks: MediaStreamTrack[],
  kind: TrackKind,
  label: string,
) {
  const track = tracks.find(({ readyState }) => readyState === "live");
  if (!track) throw new TrackUnavailableError(kind, label);
  return track;
}

export function supportedMimeType(kind: TrackKind) {
  const audio = kind === "microphone" || kind === "desktop-audio";
  const candidates = audio
    ? ["audio/webm;codecs=opus", "audio/webm"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  if (typeof MediaRecorder === "undefined") return candidates.at(-1) ?? "";
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function elapsed(now: number, epoch: number) {
  return Math.max(0, now - epoch);
}

export function toError(cause: unknown) {
  if (cause instanceof Error) return cause;
  if (
    cause &&
    typeof cause === "object" &&
    "message" in cause &&
    typeof cause.message === "string"
  ) {
    return new Error(cause.message);
  }
  return new Error("Recording failed.");
}

export function isDisplayCancellation(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return error.name === "NotAllowedError" || error.name === "AbortError";
}
