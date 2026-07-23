import { describe, expect, it, vi } from "vitest";
import { startPresenterDetection } from "./presenter-detection-loop";

describe("presenter detection loop", () => {
  it("downscales frames and submits no more than eight detections per second", async () => {
    const scheduled: FrameRequestCallback[] = [];
    const detect = vi.fn(async () => []);
    const createBitmap = vi.fn(async () => ({}) as ImageBitmap);
    const loop = startPresenterDetection(
      {
        readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
        videoHeight: 1_200,
        videoWidth: 1_920,
      } as HTMLVideoElement,
      { detect, dispose: vi.fn() },
      { onBoxes: vi.fn(), onError: vi.fn() },
      {
        cancelFrame: vi.fn(),
        createBitmap,
        requestFrame: (callback) => {
          scheduled.push(callback);
          return scheduled.length;
        },
      },
    );

    await runFrame(scheduled, 0);
    await runFrame(scheduled, 100);
    await runFrame(scheduled, 125);

    expect(detect).toHaveBeenCalledTimes(2);
    expect(createBitmap).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resizeHeight: 400, resizeWidth: 640 }),
    );
    loop.stop();
  });

  it("reports detector errors without stopping future frame scheduling", async () => {
    const scheduled: FrameRequestCallback[] = [];
    const onError = vi.fn();
    const detect = vi
      .fn()
      .mockRejectedValueOnce(new Error("model unavailable"));
    const loop = startPresenterDetection(
      {
        readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
        videoHeight: 2_160,
        videoWidth: 3_840,
      } as HTMLVideoElement,
      { detect, dispose: vi.fn() },
      { onBoxes: vi.fn(), onError },
      {
        cancelFrame: vi.fn(),
        createBitmap: vi.fn(async () => ({}) as ImageBitmap),
        requestFrame: (callback) => {
          scheduled.push(callback);
          return scheduled.length;
        },
      },
    );

    await runFrame(scheduled, 0);

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith("model unavailable"),
    );
    expect(scheduled.length).toBeGreaterThan(0);
    loop.stop();
  });
});

async function runFrame(scheduled: FrameRequestCallback[], timestamp: number) {
  const callback = scheduled.shift();
  expect(callback).toBeDefined();
  callback?.(timestamp);
  await Promise.resolve();
  await Promise.resolve();
}
