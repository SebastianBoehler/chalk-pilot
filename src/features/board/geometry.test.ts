import { describe, expect, it } from "vitest";
import { orderCorners, outputBoardSize } from "./geometry";

describe("board geometry", () => {
  it("orders shuffled normalized corners clockwise from top-left", () => {
    expect(
      orderCorners([
        { x: 0.9, y: 0.85 },
        { x: 0.12, y: 0.15 },
        { x: 0.08, y: 0.9 },
        { x: 0.88, y: 0.1 },
      ]),
    ).toEqual([
      { x: 0.12, y: 0.15 },
      { x: 0.88, y: 0.1 },
      { x: 0.9, y: 0.85 },
      { x: 0.08, y: 0.9 },
    ]);
  });

  it("rejects duplicate and out-of-bounds corners", () => {
    expect(() =>
      orderCorners([
        { x: 0.1, y: 0.1 },
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ]),
    ).toThrow("distinct");
    expect(() =>
      orderCorners([
        { x: -0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ]),
    ).toThrow("normalized");
  });

  it("calculates a bounded rectified output size", () => {
    expect(
      outputBoardSize(
        [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.6 },
          { x: 0.1, y: 0.6 },
        ],
        3840,
        2160,
      ),
    ).toEqual({ width: 1920, height: 675 });
  });
});
