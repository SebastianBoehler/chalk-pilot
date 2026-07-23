import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { manifest } from "./recording-test-helpers";
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

describe("useSessionRecording", () => {
  beforeEach(() => {
    mocks.createDerivedVideoStreams.mockReset();
    mocks.RecordingCoordinator.mockReset();
  });

  it("streams five sources through the coordinator and exposes replay", async () => {
    const board = {} as MediaStream;
    const speaker = {} as MediaStream;
    const microphone = {} as MediaStream;
    const derived = {
      board,
      speaker,
      stop: vi.fn(),
      updateBoard: vi.fn(async () => undefined),
    };
    const coordinator = {
      replayUrl: "/replay/session-1",
      start: vi.fn(async () => manifest()),
      status: "idle",
      stop: vi.fn(async () => manifest("session-1", "complete", 2_000)),
    };
    mocks.createDerivedVideoStreams.mockReturnValue(derived);
    mocks.RecordingCoordinator.mockImplementation(function () {
      return coordinator;
    });
    const video = {} as HTMLVideoElement;
    const { result } = renderHook(() =>
      useSessionRecording(
        video,
        "data:image/png;base64,board",
        "session-1",
        microphone,
      ),
    );

    await act(() => result.current.start());
    expect(coordinator.start).toHaveBeenCalledWith({
      sessionId: "session-1",
      board,
      speaker,
      microphone,
    });
    expect(result.current.status).toBe("recording");

    await act(() => result.current.stop());
    expect(result.current.status).toBe("complete");
    expect(result.current.replayUrl).toBe("/replay/session-1");
    expect(derived.stop).toHaveBeenCalledOnce();
  });
});
