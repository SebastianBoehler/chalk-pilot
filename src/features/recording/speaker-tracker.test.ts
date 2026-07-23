import { describe, expect, it } from "vitest";
import { updateSpeakerTarget } from "./speaker-tracker";

describe("updateSpeakerTarget", () => {
  it("moves smoothly toward the largest motion region", () => {
    const width = 8;
    const height = 4;
    const previous = new Uint8Array(width * height);
    const current = previous.slice();
    for (let y = 1; y < 4; y += 1) {
      for (let x = 5; x < 8; x += 1) current[y * width + x] = 255;
    }

    const target = updateSpeakerTarget(previous, current, width, height, {
      x: 0.5,
      y: 0.5,
    });

    expect(target.x).toBeGreaterThan(0.5);
    expect(target.x).toBeLessThan(0.8);
    expect(target.y).toBeGreaterThan(0.5);
  });

  it("holds the crop when the room is static", () => {
    const frame = new Uint8Array(32);

    expect(
      updateSpeakerTarget(frame, frame.slice(), 8, 4, {
        x: 0.35,
        y: 0.6,
      }),
    ).toEqual({ x: 0.35, y: 0.6 });
  });
});
