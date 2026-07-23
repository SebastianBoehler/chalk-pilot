import { describe, expect, it } from "vitest";
import {
  advanceBoardChange,
  initialBoardChangeState,
  measureBoardChange,
} from "./change-detector";

describe("board change detection", () => {
  it("returns zero for identical grayscale frames", () => {
    const frame = new Uint8Array([0, 64, 128, 255]);
    expect(measureBoardChange(frame, frame)).toBe(0);
  });

  it("normalizes material frame differences", () => {
    expect(
      measureBoardChange(
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([255, 255, 255, 255]),
      ),
    ).toBe(1);
  });

  it("requires two changed samples before marking the board dirty", () => {
    const once = advanceBoardChange(initialBoardChangeState, 0.12);
    const twice = advanceBoardChange(once, 0.12);

    expect(once.dirty).toBe(false);
    expect(twice.dirty).toBe(true);
    expect(advanceBoardChange(twice, 0.01).consecutiveChanges).toBe(0);
  });
});
