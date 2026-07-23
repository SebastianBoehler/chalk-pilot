import type { TrackKind } from "./schema";

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
  const board = requireLive(sources.board.getVideoTracks(), "board video");
  const speaker = requireLive(
    sources.speaker.getVideoTracks(),
    "speaker video",
  );
  const microphone = requireLive(
    sources.microphone.getAudioTracks(),
    "microphone audio",
  );
  const displayVideo = requireLive(display.getVideoTracks(), "display video");
  const displayAudio = requireLive(display.getAudioTracks(), "desktop audio");
  return {
    displayAudio,
    displayVideo,
    all: [board, speaker, displayVideo, microphone, displayAudio],
  };
}

function requireLive(tracks: MediaStreamTrack[], label: string) {
  const track = tracks.find(({ readyState }) => readyState === "live");
  if (!track) throw new Error(`The ${label} stream is unavailable.`);
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

export function stopRecorder(recorder: MediaRecorderPort) {
  return new Promise<void>((resolve, reject) => {
    if (recorder.state === "inactive") {
      resolve();
      return;
    }
    recorder.onstop = resolve;
    recorder.onerror = ({ error }) =>
      reject(error ?? new Error("Recording could not stop cleanly."));
    recorder.stop();
  });
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
