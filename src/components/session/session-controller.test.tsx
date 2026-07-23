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

const { realtimeInstances, realtimeOptions, workspaceProps } = vi.hoisted(
  () => ({
    realtimeInstances: [] as RealtimeInstance[],
    realtimeOptions: vi.fn(),
    workspaceProps: vi.fn(),
  }),
);

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
      canvas={emptyCanvas}
      corners={[...corners]}
      displayConnected={false}
      microphone={microphone}
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
