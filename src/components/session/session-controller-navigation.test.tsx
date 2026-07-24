import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardController } from "@/features/board/board-controller";
import type { CanvasState } from "@/features/workspace/schema";
import { SessionController } from "./session-controller";

const { realtimeOptions, recordingState, workspaceProps } = vi.hoisted(() => ({
  realtimeOptions: vi.fn(),
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
    noteNavigation: vi.fn(),
  },
  workspaceProps: vi.fn(),
}));

vi.mock("@/features/realtime/session", () => ({
  ChalkPilotRealtime: class {
    close = vi.fn();
    connect = vi.fn(async () => undefined);
    inspectBoardNow = vi.fn();
    pause = vi.fn();

    constructor(options: unknown) {
      realtimeOptions(options);
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
  useSessionRecording: () => recordingState,
}));

const canvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};
const corners = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
] as const;
const presenter = { id: "presenter", x: 0.1, y: 0.1, width: 0.2, height: 0.7 };

describe("SessionController navigation", () => {
  afterEach(() => {
    cleanup();
    realtimeOptions.mockClear();
    recordingState.noteNavigation.mockClear();
    workspaceProps.mockClear();
  });

  it("records each realtime navigation request before forwarding it to the workspace", async () => {
    const onNavigation = vi.fn();
    render(
      <SessionController
        board={
          {
            getLatestImage: vi.fn(() => null),
            sample: vi.fn().mockResolvedValue(null),
          } as unknown as BoardController
        }
        cameraUse="room-wide"
        canvas={canvas}
        corners={[...corners]}
        displayConnected={false}
        microphone={{} as MediaStream}
        navigation={null}
        onAgentState={vi.fn()}
        onCanvasChanged={vi.fn()}
        onEnd={vi.fn()}
        onNavigation={onNavigation}
        onOpenDisplay={vi.fn()}
        onRecalibrate={vi.fn()}
        presenter={presenter}
        sessionId="session-1"
        video={
          {
            play: vi.fn().mockResolvedValue(undefined),
          } as unknown as HTMLVideoElement
        }
      />,
    );
    await waitFor(() => expect(realtimeOptions).toHaveBeenCalled());
    const options = realtimeOptions.mock.calls.at(-1)?.[0] as {
      onNavigation: (event: unknown) => void;
    };
    const event = { kind: "focus", requestId: "nav-1", targetId: "target" };

    options.onNavigation(event);
    options.onNavigation(event);

    expect(onNavigation).toHaveBeenCalledWith(event);
    expect(recordingState.noteNavigation).toHaveBeenCalledOnce();
    expect(recordingState.noteNavigation).toHaveBeenCalledWith(
      event,
      expect.any(Number),
    );
    expect(workspaceProps.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ navigation: null }),
    );
  });
});
