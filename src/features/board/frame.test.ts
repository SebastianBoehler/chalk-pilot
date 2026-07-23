import { describe, expect, it } from "vitest";
import { grayscaleSample } from "./frame";

describe("board frame sampling", () => {
  it("creates a deterministic grayscale sample", () => {
    const image = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
      ]),
      width: 2,
      height: 2,
    } as ImageData;

    expect([...grayscaleSample(image, 2, 2)]).toEqual([54, 182, 18, 255]);
  });
});
