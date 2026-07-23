import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardController } from "@/features/board/board-controller";
import type { CanvasState } from "@/features/workspace/schema";
import { SessionController } from "./session-controller";

interface RealtimeInstance {
  close: ReturnType<typeof vi.fn>;
  reject: (error: unknown) => void;
  resolve: () => void;
}

const {
  realtimeInstances,
  realtimeOptions,
  recordingOptions,
  recordingState,
  workspaceProps,
} = vi.hoisted(() => ({
  realtimeInstances: [] as RealtimeInstance[],
  realtimeOptions: vi.fn(),
  recordingOptions: vi.fn(),
  recordingState: {
    canStart: true,
    canStop: false,
    durationMs: 0,
    error: undefined,
    replayUrl: undefined,
    start: vi.fn(async () => undefined),
    status: "idle" as const,
    stop: vi.fn(async () => undefined),
    noteCueStart: vi.fn(),
    noteCueEnd: vi.fn(),
    attachTranscript: vi.fn(),
    noteCanvas: vi.fn(),
  },
  workspaceProps: vi.fn(),
}));

vi.mock("@/features/realtime/session", () => ({
  ChalkPilotRealtime: class {
    connect: ReturnType<typeof vi.fn>;
    close = vi.fn();
    inspectBoardNow = vi.fn();
    pause = vi.fn();

    constructor(options: unknown) {
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const connection = new Promise<void>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      this.connect = vi.fn(() => connection);
      realtimeOptions(options);
      realtimeInstances.push({
        close: this.close,
        reject,
        resolve,
      });
    }
  },
}));

vi.mock("./learning-workspace", () => ({
  LearningWorkspace: (props: unknown) => {
    workspaceProps(props);
    return null;
  },
}));

vi.mock("@/features/recording/use-session-recording", () => ({
  useSessionRecording: (options: unknown) => {
    recordingOptions(options);
    return recordingState;
  },
}));

const corners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
] as const;

const emptyCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};
const presenter = { id: "presenter", x: 0.1, y: 0.1, width: 0.2, height: 0.7 };

function controller(microphone = {} as MediaStream) {
  const board = {
    getLatestImage: vi.fn(() => null),
    sample: vi.fn().mockResolvedValue(null),
  } as unknown as BoardController;
  const video = {
    play: vi.fn().mockResolvedValue(undefined),
  } as unknown as HTMLVideoElement;
  return (
    <SessionController
      board={board}
      cameraUse="room-wide"
      canvas={emptyCanvas}
      corners={[...corners]}
      displayConnected={false}
      microphone={microphone}
      presenter={presenter}
      onAgentState={vi.fn()}
      onCanvasChanged={vi.fn()}
      onEnd={vi.fn()}
      onOpenDisplay={vi.fn()}
      onRecalibrate={vi.fn()}
      sessionId="session-1"
      video={video}
    />
  );
}

describe("SessionController", () => {
  afterEach(() => {
    cleanup();
    realtimeInstances.splice(0);
    realtimeOptions.mockClear();
    recordingOptions.mockClear();
    recordingState.noteCueStart.mockClear();
    recordingState.noteCueEnd.mockClear();
    recordingState.attachTranscript.mockClear();
    recordingState.noteCanvas.mockClear();
    workspaceProps.mockClear();
  });

  it("passes the confirmed microphone to the Realtime adapter by identity", async () => {
    const microphone = {} as MediaStream;

    render(controller(microphone));

    await waitFor(() => expect(realtimeOptions).toHaveBeenCalled());
    expect(realtimeOptions.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ microphone }),
    );
  });

  it("owns recording above the workspace and reuses the exact session sources", async () => {
    const microphone = {} as MediaStream;

    render(controller(microphone));

    await waitFor(() => expect(recordingOptions).toHaveBeenCalled());
    expect(recordingOptions.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        cameraUse: "room-wide",
        canvas: emptyCanvas,
        microphone,
        presenter,
        sessionId: "session-1",
        video: expect.any(Object),
      }),
    );
    expect(workspaceProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ recording: recordingState }),
    );
  });

  it("forwards Realtime cue bounds into the controller-owned recording", async () => {
    render(controller());
    await waitFor(() => expect(realtimeOptions).toHaveBeenCalled());
    const options = realtimeOptions.mock.calls[0]?.[0] as {
      onCueStart: (speaker: "user", atMs: number) => void;
      onCueEnd: (speaker: "user", atMs: number) => void;
    };

    options.onCueStart("user", 100);
    options.onCueEnd("user", 900);

    expect(recordingState.noteCueStart).toHaveBeenCalledWith("user", 100);
    expect(recordingState.noteCueEnd).toHaveBeenCalledWith("user", 900);
  });

  it("ignores the connection result from the disposed Strict Mode generation", async () => {
    render(<StrictMode>{controller()}</StrictMode>);
    await waitFor(() => expect(realtimeInstances).toHaveLength(2));
    const [stale, active] = realtimeInstances;
    expect(stale.close).toHaveBeenCalledOnce();

    await act(async () => stale.resolve());
    expect(workspaceProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ realtimeConnected: false }),
    );

    await act(async () => active.resolve());
    expect(workspaceProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ realtimeConnected: true }),
    );
  });

  it("ignores a stale failure but surfaces the active connection error", async () => {
    render(<StrictMode>{controller()}</StrictMode>);
    await waitFor(() => expect(realtimeInstances).toHaveLength(2));
    const [stale, active] = realtimeInstances;

    await act(async () => stale.reject(new Error("stale failure")));
    expect(workspaceProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ error: undefined }),
    );

    await act(async () => active.reject(new Error("active failure")));
    expect(workspaceProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ error: "active failure" }),
    );
  });
});
