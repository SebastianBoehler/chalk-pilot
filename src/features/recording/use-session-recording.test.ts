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
  const presenter = {
    id: "presenter",
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.7,
  };

  beforeEach(() => {
    mocks.createDerivedVideoStreams.mockReset();
    mocks.RecordingCoordinator.mockReset();
  });

  it("requires a presenter only for a room-wide camera", () => {
    const video = {} as HTMLVideoElement;
    const microphone = {} as MediaStream;
    const boardFocused = renderHook(() =>
      useSessionRecording(
        video,
        "data:image/png;base64,board",
        "session-1",
        microphone,
        "board-focused",
      ),
    );
    const roomWide = renderHook(() =>
      useSessionRecording(
        video,
        "data:image/png;base64,board",
        "session-1",
        microphone,
        "room-wide",
      ),
    );

    expect(boardFocused.result.current.canStart).toBe(true);
    expect(roomWide.result.current.canStart).toBe(false);
    boardFocused.unmount();
    roomWide.unmount();
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
      error: null,
      replayUrl: "/replay/session-1",
      start: vi.fn(async () => manifest()),
      status: "idle",
      stop: vi.fn(async () => manifest("session-1", "complete", 2_000)),
      subscribe: vi.fn(() => () => undefined),
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
        "room-wide",
        presenter,
      ),
    );

    await act(() => result.current.start());
    expect(mocks.createDerivedVideoStreams).toHaveBeenCalledWith(video, {
      cameraUse: "room-wide",
      onTrackingError: expect.any(Function),
      presenter,
    });
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

  it("observes a background track interruption immediately", async () => {
    const board = {} as MediaStream;
    const speaker = {} as MediaStream;
    const microphone = {} as MediaStream;
    const derived = {
      board,
      speaker,
      stop: vi.fn(),
      updateBoard: vi.fn(async () => undefined),
    };
    let listener: () => void = () => undefined;
    const coordinator = {
      error: null as Error | null,
      replayUrl: "/replay/session-1",
      start: vi.fn(async () => manifest()),
      status: "idle",
      stop: vi.fn(async () => manifest("session-1", "interrupted", 2_000)),
      subscribe: vi.fn((next: () => void) => {
        listener = next;
        return () => undefined;
      }),
    };
    mocks.createDerivedVideoStreams.mockReturnValue(derived);
    mocks.RecordingCoordinator.mockImplementation(function () {
      return coordinator;
    });
    const { result } = renderHook(() =>
      useSessionRecording(
        {} as HTMLVideoElement,
        "data:image/png;base64,board",
        "session-1",
        microphone,
        "room-wide",
        presenter,
      ),
    );
    await act(() => result.current.start());

    coordinator.status = "error";
    coordinator.error = new Error("The board track was interrupted.");
    act(() => listener());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("The board track was interrupted.");
    expect(result.current.canStop).toBe(true);
    await act(() => result.current.stop());
    expect(result.current.status).toBe("complete");
    expect(result.current.canStop).toBe(false);
  });

  it("returns to idle when display selection is cancelled", async () => {
    const microphone = {} as MediaStream;
    const derived = {
      board: {} as MediaStream,
      speaker: {} as MediaStream,
      stop: vi.fn(),
      updateBoard: vi.fn(async () => undefined),
    };
    const coordinator = {
      error: null,
      replayUrl: null,
      start: vi.fn(async () => {
        throw new DOMException("cancelled", "AbortError");
      }),
      status: "idle",
      stop: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };
    mocks.createDerivedVideoStreams.mockReturnValue(derived);
    mocks.RecordingCoordinator.mockImplementation(function () {
      return coordinator;
    });
    const { result } = renderHook(() =>
      useSessionRecording(
        {} as HTMLVideoElement,
        "data:image/png;base64,board",
        "session-1",
        microphone,
        "room-wide",
        presenter,
      ),
    );

    await act(() => result.current.start());

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeUndefined();
  });

  it("reports a network AbortError after display selection", async () => {
    const microphone = {} as MediaStream;
    const derived = {
      board: {} as MediaStream,
      speaker: {} as MediaStream,
      stop: vi.fn(),
      updateBoard: vi.fn(async () => undefined),
    };
    const coordinator = {
      error: new DOMException("network aborted", "AbortError"),
      replayUrl: null,
      start: vi.fn(async () => {
        throw new DOMException("network aborted", "AbortError");
      }),
      status: "error",
      stop: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };
    mocks.createDerivedVideoStreams.mockReturnValue(derived);
    mocks.RecordingCoordinator.mockImplementation(function () {
      return coordinator;
    });
    const { result } = renderHook(() =>
      useSessionRecording(
        {} as HTMLVideoElement,
        "data:image/png;base64,board",
        "session-1",
        microphone,
        "room-wide",
        presenter,
      ),
    );

    await act(() => result.current.start());

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("network aborted");
  });
});
