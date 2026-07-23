import { describe, expect, it, vi } from "vitest";
import { BoardController } from "./board-controller";
import type { BoardCorners } from "./types";

const corners: BoardCorners = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

function image(value: number) {
  return {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([value, value, value, 255, 0, 0, 0, 255]),
  } as ImageData;
}

describe("BoardController", () => {
  it("keeps the first calibrated board eligible for the first turn", async () => {
    const processor = {
      detect: vi.fn(async () => ({ corners, confidence: 0.9 })),
      warp: vi.fn(async (frame: ImageData) => frame),
      dispose: vi.fn(),
    };
    const controller = new BoardController(processor, {
      capture: () => image(30),
      encode: () => "data:image/jpeg;base64,board",
    });

    const calibration = await controller.detect({} as HTMLVideoElement);

    expect(calibration.corners).toEqual(corners);
    expect(controller.hasMaterialChange()).toBe(true);
    expect(controller.getLatestImage()).toContain("data:image/jpeg");
    controller.markSent();
    expect(controller.hasMaterialChange()).toBe(false);
  });

  it("calibrates against each exact runtime camera size", async () => {
    let size = { width: 1_920, height: 1_200 };
    const processor = {
      detect: vi.fn<
        (
          frame: ImageData,
        ) => Promise<{ corners: BoardCorners; confidence: number }>
      >(async () => ({ corners, confidence: 0.9 })),
      warp: vi.fn(async (frame: ImageData) => frame),
      dispose: vi.fn(),
    };
    const controller = new BoardController(processor, {
      capture: () =>
        ({
          data: new Uint8ClampedArray(),
          height: size.height,
          width: size.width,
        }) as ImageData,
      encode: () => "data:image/jpeg;base64,board",
      sample: () => new Uint8Array([0]),
    });

    await expect(
      controller.detect({} as HTMLVideoElement),
    ).resolves.toMatchObject({
      sourceSize: { width: 1_920, height: 1_200 },
    });
    size = { width: 3_840, height: 2_160 };
    await expect(
      controller.detect({} as HTMLVideoElement),
    ).resolves.toMatchObject({
      sourceSize: { width: 3_840, height: 2_160 },
    });
    expect(
      processor.detect.mock.calls.map(([frame]) => [frame.width, frame.height]),
    ).toEqual([
      [1_920, 1_200],
      [3_840, 2_160],
    ]);
  });
});
