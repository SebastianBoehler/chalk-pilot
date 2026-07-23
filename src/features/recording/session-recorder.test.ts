import { describe, expect, it, vi } from "vitest";
import { SessionRecorder, type MediaRecorderPort } from "./session-recorder";

class FakeMediaRecorder implements MediaRecorderPort {
  state: RecordingState = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: ((event: { error?: DOMException }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn(() => {
    this.state = "recording";
  });
  stop = vi.fn(() => {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([this.label], { type: "video/webm" }),
    });
    this.onstop?.();
  });

  constructor(
    readonly stream: MediaStream,
    private readonly label: string,
  ) {}
}

function stream(label: string) {
  const track = {
    kind: "video",
    readyState: "live",
    stop: vi.fn(),
  } as unknown as MediaStreamTrack;
  return {
    label,
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
    track,
  };
}

describe("SessionRecorder", () => {
  it("records board, tracked speaker, and selected canvas separately", async () => {
    const board = stream("board");
    const speaker = stream("speaker");
    const canvas = stream("canvas");
    const recorders: FakeMediaRecorder[] = [];
    const getDisplayMedia = vi.fn().mockResolvedValue(canvas.stream);
    const recorder = new SessionRecorder({
      createRecorder: (mediaStream) => {
        const created = new FakeMediaRecorder(
          mediaStream,
          mediaStream === board.stream
            ? "board"
            : mediaStream === speaker.stream
              ? "speaker"
              : "canvas",
        );
        recorders.push(created);
        return created;
      },
      getDisplayMedia,
      now: () => new Date("2026-07-23T11:30:00.000Z"),
    });

    await recorder.start({
      board: board.stream,
      speaker: speaker.stream,
    });
    const result = await recorder.stop();

    expect(recorders.map(({ stream }) => stream)).toEqual([
      board.stream,
      speaker.stream,
      canvas.stream,
    ]);
    expect(getDisplayMedia).toHaveBeenCalledWith({
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      video: { displaySurface: "browser", frameRate: 30 },
    });
    expect(recorders.every(({ start }) => start.mock.calls.length === 1)).toBe(
      true,
    );
    expect(result.board.filename).toBe(
      "chalkpilot-board-2026-07-23T11-30-00.webm",
    );
    expect(result.speaker.filename).toBe(
      "chalkpilot-speaker-2026-07-23T11-30-00.webm",
    );
    expect(result.canvas.filename).toBe(
      "chalkpilot-canvas-2026-07-23T11-30-00.webm",
    );
    expect(result.board.blob.size).toBeGreaterThan(0);
    expect(result.speaker.blob.size).toBeGreaterThan(0);
    expect(result.canvas.blob.size).toBeGreaterThan(0);
    expect(canvas.track.stop).toHaveBeenCalledOnce();
    expect(board.track.stop).not.toHaveBeenCalled();
    expect(speaker.track.stop).not.toHaveBeenCalled();
  });
});
