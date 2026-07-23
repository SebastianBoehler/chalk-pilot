import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { deferred, manifest } from "./recording-test-helpers";
import { useSessionRecording } from "./use-session-recording";

const mocks = vi.hoisted(() => ({
  createDerivedVideoStreams: vi.fn(),
  RecordingCoordinator: vi.fn(),
}));

vi.mock("./derived-video-streams", () => ({
  createDerivedVideoStreams: mocks.createDerivedVideoStreams,
}));

vi.mock("./recording-coordinator", () => ({
  RecordingCoordinator: mocks.RecordingCoordinator,
}));

const initialCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};
const latestCanvas = { ...initialCanvas, focusId: "latest" };

describe("useSessionRecording start", () => {
  beforeEach(() => {
    mocks.createDerivedVideoStreams.mockReset();
    mocks.RecordingCoordinator.mockReset();
  });

  it("records the latest canvas after a pending display selection", async () => {
    const creation = deferred<ReturnType<typeof manifest>>();
    const derived = {
      board: {} as MediaStream,
      speaker: {} as MediaStream,
      stop: vi.fn(),
      updateBoard: vi.fn(async () => undefined),
    };
    const coordinator = {
      appendTimeline: vi.fn(async () => undefined),
      error: null,
      recordingEpochMs: 1_000,
      replayUrl: "/replay/session-1",
      start: vi.fn(() => creation.promise),
      status: "idle",
      stop: vi.fn(async (beforeFinalize?: () => Promise<void>) => {
        await beforeFinalize?.();
        return manifest("session-1", "complete", 1_000);
      }),
      subscribe: vi.fn(() => () => undefined),
    };
    mocks.createDerivedVideoStreams.mockReturnValue(derived);
    mocks.RecordingCoordinator.mockImplementation(function () {
      return coordinator;
    });
    const base = {
      boardPreview: "data:image/png;base64,board",
      cameraUse: "board-focused" as const,
      microphone: {} as MediaStream,
      sessionId: "session-1",
      video: {} as HTMLVideoElement,
    };
    const hook = renderHook(
      ({ canvas }: { canvas: CanvasState }) =>
        useSessionRecording({ ...base, canvas }),
      { initialProps: { canvas: initialCanvas } },
    );

    let starting!: Promise<void>;
    act(() => {
      starting = hook.result.current.start();
    });
    await waitFor(() => expect(coordinator.start).toHaveBeenCalledOnce());
    hook.rerender({ canvas: latestCanvas });
    creation.resolve(manifest());
    await act(() => starting);
    await waitFor(() => expect(coordinator.appendTimeline).toHaveBeenCalled());

    expect(coordinator.appendTimeline).toHaveBeenNthCalledWith(1, {
      type: "canvas",
      offsetMs: 0,
      revision: latestCanvas,
    });
    await act(() => hook.result.current.stop());
  });
});
