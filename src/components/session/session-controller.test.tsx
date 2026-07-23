import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BoardController } from "@/features/board/board-controller";
import type { CanvasState } from "@/features/workspace/schema";
import { SessionController } from "./session-controller";

const { realtimeOptions } = vi.hoisted(() => ({
  realtimeOptions: vi.fn(),
}));

vi.mock("@/features/realtime/session", () => ({
  ChalkPilotRealtime: class {
    constructor(options: unknown) {
      realtimeOptions(options);
    }
    connect = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
    inspectBoardNow = vi.fn();
    pause = vi.fn();
  },
}));

vi.mock("./learning-workspace", () => ({
  LearningWorkspace: () => null,
}));

const emptyCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

describe("SessionController", () => {
  afterEach(() => {
    cleanup();
    realtimeOptions.mockClear();
  });

  it("passes the confirmed microphone to the Realtime adapter by identity", async () => {
    const microphone = {} as MediaStream;
    const board = {
      getLatestImage: vi.fn(() => null),
      sample: vi.fn().mockResolvedValue(null),
    } as unknown as BoardController;
    const video = {
      play: vi.fn().mockResolvedValue(undefined),
    } as unknown as HTMLVideoElement;

    render(
      <SessionController
        board={board}
        canvas={emptyCanvas}
        corners={[
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ]}
        displayConnected={false}
        microphone={microphone}
        onAgentState={vi.fn()}
        onCanvasChanged={vi.fn()}
        onEnd={vi.fn()}
        onOpenDisplay={vi.fn()}
        onRecalibrate={vi.fn()}
        sessionId="session-1"
        video={video}
      />,
    );

    await waitFor(() => expect(realtimeOptions).toHaveBeenCalled());
    expect(realtimeOptions.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ microphone }),
    );
  });
});
