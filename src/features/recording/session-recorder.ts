export interface MediaRecorderPort {
  state: RecordingState;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onerror: ((event: { error?: DOMException }) => void) | null;
  onstop: (() => void) | null;
  start(timeslice?: number): void;
  stop(): void;
}

interface CanvasCaptureOptions extends DisplayMediaStreamOptions {
  preferCurrentTab: boolean;
  selfBrowserSurface: "include";
  video: MediaTrackConstraints & { displaySurface: "browser" };
}

interface RecorderDependencies {
  getDisplayMedia: (options: CanvasCaptureOptions) => Promise<MediaStream>;
  createRecorder: (stream: MediaStream, mimeType: string) => MediaRecorderPort;
  now: () => Date;
}

interface DerivedStreams {
  board: MediaStream;
  speaker: MediaStream;
}

interface RecordingFile {
  blob: Blob;
  filename: string;
}

type RecordingKind = keyof SessionRecordings;

interface ActiveRecording {
  kind: RecordingKind;
  recorder: MediaRecorderPort;
  chunks: Blob[];
}

export interface SessionRecordings {
  board: RecordingFile;
  speaker: RecordingFile;
  canvas: RecordingFile;
}

const CANVAS_CAPTURE_OPTIONS: CanvasCaptureOptions = {
  audio: false,
  preferCurrentTab: true,
  selfBrowserSurface: "include",
  video: { displaySurface: "browser", frameRate: 30 },
};

export class SessionRecorder {
  private readonly dependencies: RecorderDependencies;
  private active: ActiveRecording[] = [];
  private canvasStream: MediaStream | null = null;
  private startedAt: Date | null = null;

  constructor(dependencies: Partial<RecorderDependencies> = {}) {
    this.dependencies = {
      getDisplayMedia:
        dependencies.getDisplayMedia ??
        ((options) => navigator.mediaDevices.getDisplayMedia(options)),
      createRecorder:
        dependencies.createRecorder ??
        ((stream, mimeType) =>
          new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined,
          ) as unknown as MediaRecorderPort),
      now: dependencies.now ?? (() => new Date()),
    };
  }

  async start(streams: DerivedStreams): Promise<void> {
    if (this.active.length > 0) {
      throw new Error("The session is already recording.");
    }
    requireVideo(streams.board, "board");
    requireVideo(streams.speaker, "speaker");

    const canvas = await this.dependencies.getDisplayMedia(
      CANVAS_CAPTURE_OPTIONS,
    );
    requireVideo(canvas, "canvas");
    const mimeType = supportedMimeType();
    this.canvasStream = canvas;
    this.startedAt = this.dependencies.now();
    this.active = (
      [
        ["board", streams.board],
        ["speaker", streams.speaker],
        ["canvas", canvas],
      ] as const
    ).map(([kind, stream]) => {
      const chunks: Blob[] = [];
      const recorder = this.dependencies.createRecorder(stream, mimeType);
      recorder.ondataavailable = ({ data }) => {
        if (data.size > 0) chunks.push(data);
      };
      recorder.start(1_000);
      return { kind, recorder, chunks };
    });
  }

  async stop(): Promise<SessionRecordings> {
    if (this.active.length === 0 || !this.startedAt) {
      throw new Error("No session recording is active.");
    }
    const active = this.active;
    const startedAt = this.startedAt;
    await Promise.all(active.map(({ recorder }) => stopRecorder(recorder)));
    this.canvasStream?.getTracks().forEach((track) => track.stop());
    this.active = [];
    this.canvasStream = null;
    this.startedAt = null;

    return Object.fromEntries(
      active.map(({ chunks, kind }) => [
        kind,
        {
          blob: new Blob(chunks, { type: chunks[0]?.type || "video/webm" }),
          filename: recordingFilename(kind, startedAt),
        },
      ]),
    ) as unknown as SessionRecordings;
  }
}

function requireVideo(stream: MediaStream, label: string) {
  if (!stream.getVideoTracks().some((track) => track.readyState === "live")) {
    throw new Error(`The ${label} video stream is unavailable.`);
  }
}

function supportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "video/webm";
  return (
    ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
      (type) => MediaRecorder.isTypeSupported(type),
    ) ?? ""
  );
}

function stopRecorder(recorder: MediaRecorderPort) {
  return new Promise<void>((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = ({ error }) =>
      reject(error ?? new Error("Video recording failed."));
    if (recorder.state === "inactive") resolve();
    else recorder.stop();
  });
}

function recordingFilename(kind: RecordingKind, startedAt: Date) {
  const timestamp = startedAt
    .toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replaceAll(":", "-");
  return `chalkpilot-${kind}-${timestamp}.webm`;
}
