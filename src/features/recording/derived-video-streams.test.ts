import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDerivedVideoStreams } from "./derived-video-streams";

const { startDetection } = vi.hoisted(() => ({
  startDetection: vi.fn<
    (
      video: HTMLVideoElement,
      detector: unknown,
      callbacks: unknown,
    ) => { stop: ReturnType<typeof vi.fn> }
  >(() => ({ stop: vi.fn() })),
}));

vi.mock("./presenter-detection-loop", () => ({
  startPresenterDetection: startDetection,
}));

describe("createDerivedVideoStreams", () => {
  const drawImage = vi.fn();
  const stopTrack = vi.fn();
  const frames: FrameRequestCallback[] = [];

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
      configurable: true,
      value: () =>
        ({
          getTracks: () => [{ stop: stopTrack }],
        }) as unknown as MediaStream,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    drawImage.mockReset();
    stopTrack.mockReset();
    startDetection.mockClear();
    frames.splice(0);
    vi.restoreAllMocks();
  });

  it("uses the fixed contained source and skips pose tracking in board-focused mode", () => {
    const video = {
      readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
      videoHeight: 1_200,
      videoWidth: 1_920,
    } as HTMLVideoElement;
    const streams = createDerivedVideoStreams(video, {
      cameraUse: "board-focused",
      presenter: null,
    });

    frames.shift()?.(16);

    expect(startDetection).not.toHaveBeenCalled();
    expect(drawImage).toHaveBeenCalledWith(video, 64, 0, 1_152, 720);
    expect(() =>
      streams.confirmPresenter({
        id: "presenter",
        x: 0.1,
        y: 0.1,
        width: 0.2,
        height: 0.7,
      }),
    ).toThrow("does not track");
    streams.stop();
    expect(stopTrack).toHaveBeenCalledTimes(2);
  });

  it("interpolates a confirmed room-wide presenter between detections", () => {
    const video = {
      readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
      videoHeight: 1_080,
      videoWidth: 1_920,
    } as HTMLVideoElement;
    const presenter = {
      id: "presenter",
      x: 0.4,
      y: 0.1,
      width: 0.2,
      height: 0.7,
    };
    createDerivedVideoStreams(video, {
      cameraUse: "room-wide",
      presenter,
    });
    const callbacks = startDetection.mock.calls[0]?.[2] as {
      onBoxes: (boxes: (typeof presenter)[]) => void;
    };

    frames.shift()?.(0);
    callbacks.onBoxes([{ ...presenter, id: "pose-0", x: 0.55 }]);
    frames.shift()?.(16);
    frames.shift()?.(32);
    const cropStarts = drawImage.mock.calls
      .filter((call) => call.length === 9)
      .map((call) => call[1] as number);

    expect(startDetection).toHaveBeenCalledOnce();
    expect(cropStarts).toHaveLength(3);
    expect(cropStarts[1]).toBeGreaterThan(cropStarts[0]);
    expect(cropStarts[2]).toBeGreaterThan(cropStarts[1]);
  });
});
